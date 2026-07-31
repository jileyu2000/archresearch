$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$buildPath = Join-Path $workspace "scripts\build-windows-installer.ps1"
$smokePath = Join-Path $workspace "scripts\test-windows-installer-package.ps1"
$installerPath = Join-Path $workspace "packaging\windows\ArchResearch.iss"
$launcherPath = Join-Path $workspace "packaging\windows\launcher.py"
$desktopPath = Join-Path $workspace "apps\api\src\archresearch_api\desktop.py"
$iconBuilderPath = Join-Path $workspace "scripts\build-windows-icon.py"

foreach ($requiredPath in @(
    $buildPath,
    $smokePath,
    $installerPath,
    $launcherPath,
    $desktopPath,
    $iconBuilderPath
)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing Windows installer source: $requiredPath"
    }
}

$build = Get-Content -Raw -LiteralPath $buildPath
$smoke = Get-Content -Raw -LiteralPath $smokePath
$installer = Get-Content -Raw -LiteralPath $installerPath
$launcher = Get-Content -Raw -LiteralPath $launcherPath
$desktop = Get-Content -Raw -LiteralPath $desktopPath
$iconBuilder = Get-Content -Raw -LiteralPath $iconBuilderPath

foreach ($contract in @(
    @{ Source = $build; Pattern = '--onedir'; Message = "The app runtime must use a PyInstaller onedir bundle." }
    @{ Source = $build; Pattern = 'build-windows-icon\.py'; Message = "The Windows build must generate the branded application icon." }
    @{ Source = $build; Pattern = '--icon'; Message = "PyInstaller must embed the branded Windows icon." }
    @{ Source = $build; Pattern = 'packaging[\\/]windows[\\/]launcher\.py|launcherPath'; Message = "PyInstaller must enter through the package-safe launcher." }
    @{ Source = $build; Pattern = '\$addBoard\s*=.*boardRoot.*dist'; Message = "The production Board must be bundled." }
    @{ Source = $build; Pattern = '\$addAlembic(Config)?\s*=.*apiRoot.*alembic'; Message = "Database migrations must be bundled." }
    @{ Source = $installer; Pattern = 'PrivilegesRequired=lowest'; Message = "The installer must not require administrator access." }
    @{ Source = $installer; Pattern = '\{localappdata\}\\Programs\\ArchResearch'; Message = "The app must install per user." }
    @{ Source = $installer; Pattern = '\{autoprograms\}'; Message = "The installer must create a Start Menu shortcut." }
    @{ Source = $installer; Pattern = '\{autodesktop\}'; Message = "The installer must create a desktop shortcut." }
    @{ Source = $installer; Pattern = 'SetupIconFile=\{#IconFile\}'; Message = "The installer executable must use the branded ArchResearch icon." }
    @{ Source = $desktop; Pattern = 'Windows Credential Manager'; Message = "The first-run surface must name the secure Key destination." }
    @{ Source = $desktop; Pattern = 'API 接口地址'; Message = "The first-run surface must require the user's API endpoint." }
    @{ Source = $desktop; Pattern = '模型名称（从上游获取）'; Message = "The first-run surface must expose an upstream-backed model field." }
    @{ Source = $desktop; Pattern = '获取模型列表'; Message = "The first-run surface must fetch the upstream model list." }
    @{ Source = $desktop; Pattern = '模型 ID 不可手输'; Message = "The first-run surface must not ask users to type model IDs." }
    @{ Source = $desktop; Pattern = '验证所选模型'; Message = "The first-run surface must test the selected model before saving." }
    @{ Source = $desktop; Pattern = 'tk\.Button\('; Message = "The first-run actions must use buttons with reliable Windows text rendering." }
    @{ Source = $desktop; Pattern = 'foreground\s*=\s*"#ffffff"'; Message = "The primary first-run action must have explicit high-contrast text." }
    @{ Source = $desktop; Pattern = 'background\s*=\s*"#2f5bff"'; Message = "The primary first-run action must use the committed blueprint color." }
    @{ Source = $desktop; Pattern = 'DESKTOP_PORT\s*=\s*8000'; Message = "The installed edition must retain 8000 as its preferred local port." }
    @{ Source = $desktop; Pattern = 'select_desktop_port'; Message = "The installed edition must recover automatically when its preferred port is occupied." }
    @{ Source = $desktop; Pattern = 'desktop_board_url'; Message = "The installed Board and extension must share the selected local API port." }
    @{ Source = $desktop; Pattern = 'log_config\s*=\s*None'; Message = "The windowed launcher must not initialize Uvicorn's console formatter." }
    @{ Source = $launcher; Pattern = 'from archresearch_api\.desktop import main'; Message = "The frozen launcher must import the desktop package absolutely." }
    @{ Source = $smoke; Pattern = '--self-test'; Message = "The installed executable must pass its embedded self-test." }
    @{ Source = $smoke; Pattern = 'manifest\.json'; Message = "The installed package smoke must reject a bundled Chrome extension." }
    @{ Source = $smoke; Pattern = 'unins000\.exe'; Message = "The package smoke must uninstall the tested application." }
    @{ Source = $smoke; Pattern = '\$env:PATH'; Message = "The package smoke must prove the app does not rely on development tools in PATH." }
    @{ Source = $iconBuilder; Pattern = '#2f5bff'; Message = "The Windows icon must use the ArchResearch blueprint color." }
    @{ Source = $iconBuilder; Pattern = '16,\s*20,\s*24,\s*32,\s*48,\s*64,\s*128,\s*256'; Message = "The Windows icon must include common small and large ICO sizes." }
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
