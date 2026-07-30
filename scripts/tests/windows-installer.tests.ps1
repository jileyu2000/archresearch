$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$buildPath = Join-Path $workspace "scripts\build-windows-installer.ps1"
$smokePath = Join-Path $workspace "scripts\test-windows-installer-package.ps1"
$installerPath = Join-Path $workspace "packaging\windows\ArchResearch.iss"
$launcherPath = Join-Path $workspace "packaging\windows\launcher.py"
$desktopPath = Join-Path $workspace "apps\api\src\archresearch_api\desktop.py"

foreach ($requiredPath in @($buildPath, $smokePath, $installerPath, $launcherPath, $desktopPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing Windows installer source: $requiredPath"
    }
}

$build = Get-Content -Raw -LiteralPath $buildPath
$smoke = Get-Content -Raw -LiteralPath $smokePath
$installer = Get-Content -Raw -LiteralPath $installerPath
$launcher = Get-Content -Raw -LiteralPath $launcherPath
$desktop = Get-Content -Raw -LiteralPath $desktopPath

foreach ($contract in @(
    @{ Source = $build; Pattern = '--onedir'; Message = "The app runtime must use a PyInstaller onedir bundle." }
    @{ Source = $build; Pattern = 'packaging[\\/]windows[\\/]launcher\.py|launcherPath'; Message = "PyInstaller must enter through the package-safe launcher." }
    @{ Source = $build; Pattern = '\$addBoard\s*=.*boardRoot.*dist'; Message = "The production Board must be bundled." }
    @{ Source = $build; Pattern = '\$addAlembic(Config)?\s*=.*apiRoot.*alembic'; Message = "Database migrations must be bundled." }
    @{ Source = $installer; Pattern = 'PrivilegesRequired=lowest'; Message = "The installer must not require administrator access." }
    @{ Source = $installer; Pattern = '\{localappdata\}\\Programs\\ArchResearch'; Message = "The app must install per user." }
    @{ Source = $installer; Pattern = '\{autoprograms\}'; Message = "The installer must create a Start Menu shortcut." }
    @{ Source = $installer; Pattern = '\{autodesktop\}'; Message = "The installer must create a desktop shortcut." }
    @{ Source = $desktop; Pattern = 'Windows Credential Manager'; Message = "The first-run surface must name the secure Key destination." }
    @{ Source = $desktop; Pattern = 'DESKTOP_PORT\s*=\s*8000'; Message = "The installed Board and extension must share the stable local API port." }
    @{ Source = $launcher; Pattern = 'from archresearch_api\.desktop import main'; Message = "The frozen launcher must import the desktop package absolutely." }
    @{ Source = $smoke; Pattern = '--self-test'; Message = "The installed executable must pass its embedded self-test." }
    @{ Source = $smoke; Pattern = 'manifest\.json'; Message = "The installed package smoke must reject a bundled Chrome extension." }
    @{ Source = $smoke; Pattern = 'unins000\.exe'; Message = "The package smoke must uninstall the tested application." }
    @{ Source = $smoke; Pattern = '\$env:PATH'; Message = "The package smoke must prove the app does not rely on development tools in PATH." }
)) {
    if ($contract.Source -notmatch $contract.Pattern) {
        throw $contract.Message
    }
}

if ($build -match 'apps[\\/]extension|extension-only|manifest\.json') {
    throw "The Windows installer must not bundle the separately downloaded Chrome extension."
}
if ($build -match '--onefile') {
    throw "The installed runtime must not unpack itself on every launch."
}
if ($installer -match '\{localappdata\}\\ArchResearch\\data') {
    throw "Uninstall must not delete durable ArchResearch user data."
}

Write-Output "windows installer tests passed"
