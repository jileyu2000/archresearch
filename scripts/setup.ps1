$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$venvPython = Join-Path $workspace ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $venvPython)) {
    $basePython = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($null -eq $basePython) {
        $basePython = Get-Command python -ErrorAction SilentlyContinue
    }
    if ($null -eq $basePython) {
        throw "Python 3.12 was not found."
    }
    & $basePython.Source -m venv (Join-Path $workspace ".venv")
}

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}
if ($null -eq $pnpm) {
    throw "pnpm 11 was not found."
}

Set-Location -LiteralPath $workspace
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -e "apps/api[dev]"
& $pnpm.Source install
& $pnpm.Source --dir apps/extension run build

Write-Output "Setup complete. Start with scripts\start.ps1"
