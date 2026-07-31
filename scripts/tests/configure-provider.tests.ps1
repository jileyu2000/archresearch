Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "..\configure-provider.ps1"
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Provider configuration script is missing."
}

$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
    $scriptPath,
    [ref]$tokens,
    [ref]$parseErrors
) | Out-Null
if ($parseErrors.Count -ne 0) {
    throw "Provider configuration script does not parse in Windows PowerShell."
}

$script = Get-Content -Raw -LiteralPath $scriptPath
if ($script -notmatch 'Read-Host\s+[^\r\n]+-AsSecureString') {
    throw "Key input is not hidden."
}
if ($script -notmatch 'RedirectStandardInput\s*=\s*\$true') {
    throw "Key is not sent via stdin."
}
if ($script -notmatch 'ZeroFreeBSTR') {
    throw "SecureString memory is not cleared."
}
if ($script -match '--api-key') {
    throw "Key must not be passed as an argument."
}
if ($script -match '\$env:[A-Za-z0-9_]*API[_A-Za-z0-9]*KEY') {
    throw "Key must not be written to an environment variable."
}
if ($script -notmatch 'archresearch_api\.provider_setup') {
    throw "Provider setup helper is not invoked."
}
if ($script -match 'Read-Host\s+"Enter model name"|ArgumentList\.Add\("--model"\)') {
    throw "The model name must come from the upstream model list, not user input."
}
if ($script -notmatch 'automatically discovers a compatible model') {
    throw "The provider setup script must explain automatic upstream model discovery."
}

Write-Host "Provider configuration security contract passed."
