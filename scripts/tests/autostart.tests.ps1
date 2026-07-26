$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$configureScript = Join-Path $workspace "scripts\configure-autostart.ps1"
$startScript = Join-Path $workspace "scripts\start.ps1"
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
$testRoot = Join-Path $workspace ".archresearch\autostart-test"
$startupDirectory = Join-Path $testRoot "Startup"
$shortcutPath = Join-Path $startupDirectory "ArchResearch.lnk"
$shell = New-Object -ComObject WScript.Shell

try {
    New-Item -ItemType Directory -Force -Path $startupDirectory | Out-Null

    & $pwsh -NoProfile -ExecutionPolicy Bypass -File $configureScript `
        -StartupDirectory $startupDirectory

    if (-not (Test-Path -LiteralPath $shortcutPath)) {
        throw "Expected the ArchResearch startup shortcut to be created."
    }

    $shortcut = $shell.CreateShortcut($shortcutPath)
    $expectedArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
    if ($shortcut.TargetPath -ne $pwsh) {
        throw "Startup shortcut must use the resolved PowerShell 7 runtime."
    }
    if ($shortcut.Arguments -ne $expectedArguments) {
        throw "Startup shortcut arguments do not point to the verified start script."
    }
    if ($shortcut.WorkingDirectory -ne $workspace) {
        throw "Startup shortcut must run from the workspace root."
    }
    if ($shortcut.WindowStyle -ne 7) {
        throw "Startup shortcut must avoid opening a normal console window."
    }

    & $pwsh -NoProfile -ExecutionPolicy Bypass -File $configureScript `
        -StartupDirectory $startupDirectory
    $ownedShortcuts = @(Get-ChildItem -LiteralPath $startupDirectory -Filter "ArchResearch.lnk")
    if ($ownedShortcuts.Count -ne 1) {
        throw "Repeated autostart registration must remain idempotent."
    }

    & $pwsh -NoProfile -ExecutionPolicy Bypass -File $configureScript `
        -StartupDirectory $startupDirectory `
        -Disable
    if (Test-Path -LiteralPath $shortcutPath) {
        throw "Disabling autostart must remove the managed shortcut."
    }

    $foreignShortcut = $shell.CreateShortcut($shortcutPath)
    $foreignShortcut.TargetPath = "$env:SystemRoot\System32\notepad.exe"
    $foreignShortcut.Save()
    $disableFailed = $false
    try {
        & $pwsh -NoProfile -ExecutionPolicy Bypass -File $configureScript `
            -StartupDirectory $startupDirectory `
            -Disable 2>$null
    }
    catch {
        $disableFailed = $true
    }
    if (-not $disableFailed -or -not (Test-Path -LiteralPath $shortcutPath)) {
        throw "Autostart removal must refuse to delete an unmanaged shortcut."
    }
}
finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output "autostart tests passed"
