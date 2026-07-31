$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace
$pwsh = Resolve-PowerShell7Runtime
Set-Location -LiteralPath $workspace

& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/tests/dev-common.tests.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/tests/release.tests.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/tests/configure-provider.tests.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/tests/process-lifecycle.tests.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/tests/autostart.tests.ps1
& $pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/validate-evaluation-fixtures.ps1
& $runtime.Python -m pytest apps/api/tests
& $runtime.Python -m ruff check apps/api apps/extension/tests/e2e/support/full-stack-api.py
& $runtime.Python -m ruff format --check apps/api apps/extension/tests/e2e/support/full-stack-api.py
& $runtime.Python -m mypy apps/api/src
& $runtime.Pnpm run check
& $runtime.Pnpm --dir apps/extension test:e2e
& $runtime.Pnpm --filter @archresearch/web test
& $runtime.Pnpm --filter @archresearch/web typecheck
& $runtime.Pnpm --filter @archresearch/web build
& $runtime.Pnpm --filter @archresearch/edge test
& $runtime.Pnpm --filter @archresearch/edge typecheck
& $runtime.Pnpm --filter @archresearch/edge build

Write-Output "All ArchResearch checks passed."
