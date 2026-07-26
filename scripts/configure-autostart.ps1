[CmdletBinding()]
param(
    [switch]$Disable,
    [string]$StartupDirectory = [Environment]::GetFolderPath("Startup")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$startScript = (Resolve-Path (Join-Path $PSScriptRoot "start.ps1")).Path
$pwsh = Resolve-PowerShell7Runtime
$shortcutPath = Join-Path $StartupDirectory "ArchResearch.lnk"
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$shell = New-Object -ComObject WScript.Shell

function Test-ManagedShortcut {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Shortcut
    )

    return [System.IO.Path]::GetFileName($Shortcut.TargetPath) -eq "pwsh.exe" -and
        $Shortcut.Arguments -eq $arguments -and
        $Shortcut.WorkingDirectory -eq $workspace
}

if ($Disable) {
    if (-not (Test-Path -LiteralPath $shortcutPath)) {
        Write-Output "ArchResearch automatic startup is already disabled."
        exit 0
    }

    $existingShortcut = $shell.CreateShortcut($shortcutPath)
    if (-not (Test-ManagedShortcut -Shortcut $existingShortcut)) {
        throw "Refusing to remove an unmanaged startup shortcut: $shortcutPath"
    }

    Remove-Item -LiteralPath $shortcutPath -Force
    Write-Output "ArchResearch automatic startup disabled."
    exit 0
}

New-Item -ItemType Directory -Force -Path $StartupDirectory | Out-Null
if (Test-Path -LiteralPath $shortcutPath) {
    $existingShortcut = $shell.CreateShortcut($shortcutPath)
    if (-not (Test-ManagedShortcut -Shortcut $existingShortcut)) {
        throw "Refusing to overwrite an unmanaged startup shortcut: $shortcutPath"
    }
}

$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pwsh
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $workspace
$shortcut.WindowStyle = 7
$shortcut.Description = "Start ArchResearch local services after Windows sign-in"
$shortcut.Save()

$savedShortcut = $shell.CreateShortcut($shortcutPath)
if (-not (Test-ManagedShortcut -Shortcut $savedShortcut)) {
    throw "ArchResearch automatic startup shortcut verification failed."
}

Write-Output "ArchResearch automatic startup enabled."
Write-Output "Startup shortcut: $shortcutPath"
