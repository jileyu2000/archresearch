$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
}
if ($null -eq $pnpm) {
    throw "pnpm was not found. Install pnpm 11 before running the Web Edition gate."
}

Set-Location -LiteralPath $workspace

& $pnpm.Source test:coverage
& $pnpm.Source --dir apps/extension lint
& $pnpm.Source --dir apps/extension typecheck
& $pnpm.Source --dir apps/extension test:e2e
& $pnpm.Source --filter @archresearch/web lint
& $pnpm.Source --filter @archresearch/web typecheck
& $pnpm.Source --filter @archresearch/web test
& $pnpm.Source --filter @archresearch/web build
& $pnpm.Source --filter @archresearch/edge lint
& $pnpm.Source --filter @archresearch/edge typecheck
& $pnpm.Source --filter @archresearch/edge test
& $pnpm.Source --filter @archresearch/edge build

Write-Output "Web Edition checks passed."
