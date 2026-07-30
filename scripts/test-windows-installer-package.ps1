param(
    [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not $InstallerPath) {
    $pythonProject = Get-Content -Raw -LiteralPath (
        Join-Path $workspace "apps\api\pyproject.toml"
    )
    $versionMatch = [regex]::Match(
        $pythonProject,
        '(?m)^version\s*=\s*"(?<version>[0-9]+\.[0-9]+\.[0-9]+)"\s*$'
    )
    if (-not $versionMatch.Success) {
        throw "Could not determine the Windows installer version."
    }
    $InstallerPath = Join-Path (
        $workspace
    ) ".artifacts\releases\ArchResearch-Windows-x64-Setup-v$(
        $versionMatch.Groups["version"].Value
    ).exe"
}

$installer = [System.IO.Path]::GetFullPath($InstallerPath)
$releaseRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $workspace ".artifacts\releases")
)
$releasePrefix = $releaseRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
if (-not $installer.StartsWith($releasePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Installer smoke only accepts packages inside $releaseRoot."
}
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "Windows installer not found: $installer"
}

$appRoot = Join-Path $env:LOCALAPPDATA "Programs\ArchResearch"
$appExecutable = Join-Path $appRoot "ArchResearch.exe"
$uninstaller = Join-Path $appRoot "unins000.exe"
$desktopShortcut = Join-Path (
    [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
) "ArchResearch.lnk"
$startMenuShortcut = Join-Path (
    [Environment]::GetFolderPath([Environment+SpecialFolder]::Programs)
) "ArchResearch.lnk"

foreach ($existingPath in @(
    $appExecutable,
    $uninstaller,
    $desktopShortcut,
    $startMenuShortcut
)) {
    if (Test-Path -LiteralPath $existingPath) {
        throw "Refusing to replace an existing ArchResearch installation during smoke: $existingPath"
    }
}

$installAttempted = $false
$smokePassed = $false
try {
    $installAttempted = $true
    $install = Start-Process `
        -FilePath $installer `
        -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/SP-" `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($install.ExitCode -ne 0) {
        throw "Windows installer exited with code $($install.ExitCode)."
    }
    foreach ($installedPath in @(
        $appExecutable,
        $uninstaller,
        $desktopShortcut,
        $startMenuShortcut
    )) {
        if (-not (Test-Path -LiteralPath $installedPath)) {
            throw "Installed package is missing: $installedPath"
        }
    }

    $previousPath = $env:PATH
    try {
        $env:PATH = Join-Path $env:SystemRoot "System32"
        $selfTest = Start-Process `
            -FilePath $appExecutable `
            -ArgumentList "--self-test" `
            -WindowStyle Hidden `
            -Wait `
            -PassThru
        if ($selfTest.ExitCode -ne 0) {
            throw "Installed runtime self-test exited with code $($selfTest.ExitCode)."
        }
    }
    finally {
        $env:PATH = $previousPath
    }

    $bundledManifest = Get-ChildItem `
        -LiteralPath $appRoot `
        -Recurse `
        -File `
        -Filter "manifest.json" |
        Select-Object -First 1
    if ($null -ne $bundledManifest) {
        throw "Windows package must not contain the separately installed Chrome extension."
    }
    $smokePassed = $true
}
finally {
    if ($installAttempted -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        $uninstall = Start-Process `
            -FilePath $uninstaller `
            -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" `
            -WindowStyle Hidden `
            -Wait `
            -PassThru
        if ($uninstall.ExitCode -ne 0) {
            throw "Windows uninstaller exited with code $($uninstall.ExitCode)."
        }
    }
}

foreach ($removedPath in @(
    $appRoot,
    $desktopShortcut,
    $startMenuShortcut
)) {
    if (Test-Path -LiteralPath $removedPath) {
        throw "Windows uninstall left a program artifact behind: $removedPath"
    }
}
if (-not $smokePassed) {
    throw "Windows installer smoke did not complete."
}

Write-Output "windows installer package smoke passed"
