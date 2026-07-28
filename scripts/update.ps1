$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pwsh = Resolve-PowerShell7Runtime
Set-Location -LiteralPath $workspace

& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/stop.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1

Write-Output "ArchResearch update verified and running."
