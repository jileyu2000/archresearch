$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$updateScript = Join-Path $workspace "scripts\update.ps1"
if (-not (Test-Path -LiteralPath $updateScript)) {
    throw "Expected scripts/update.ps1 to provide the supported local update path."
}

$workflowPath = Join-Path $workspace ".github\workflows\verify.yml"
if (-not (Test-Path -LiteralPath $workflowPath)) {
    throw "Expected the Windows verification workflow."
}
$workflow = Get-Content -Raw -LiteralPath $workflowPath
$workflowContracts = @(
    @{ Pattern = '(?m)^permissions:\s*\r?$'; Message = "CI must declare least-privilege permissions." }
    @{ Pattern = '(?m)^\s+contents:\s+read\s*\r?$'; Message = "CI must grant contents read only." }
    @{ Pattern = '(?m)^\s+workflow_dispatch:\s*\r?$'; Message = "CI must support a manual verification run." }
    @{ Pattern = 'runs-on:\s+windows-latest'; Message = "CI must exercise the supported Windows environment." }
    @{ Pattern = "python-version:\s+'3\.12'"; Message = "CI must use the supported Python version." }
    @{ Pattern = "node-version:\s+'24'"; Message = "CI must use the supported Node version." }
    @{ Pattern = 'pnpm test:coverage'; Message = "CI must enforce Board and Extension coverage thresholds." }
    @{ Pattern = '\./scripts/setup\.ps1'; Message = "CI must prove setup.ps1 from a fresh checkout." }
    @{ Pattern = 'pnpm --dir apps/extension exec playwright install chromium'; Message = "CI must install Playwright Chromium for packaged Extension E2E." }
    @{ Pattern = '\./scripts/verify\.ps1'; Message = "CI must run the authoritative repository gate." }
)
foreach ($contract in $workflowContracts) {
    if ($workflow -notmatch $contract.Pattern) {
        throw $contract.Message
    }
}
if ($workflow -match 'OPENAI_API_KEY|ARCHRESEARCH_PROVIDER_MODE\s*:\s*live') {
    throw "Default CI must not require or enable live provider credentials."
}

$verifyScript = Get-Content -Raw -LiteralPath (Join-Path $workspace "scripts\verify.ps1")
if ($verifyScript -notmatch 'release\.tests\.ps1') {
    throw "The authoritative gate must include release workflow contracts."
}
foreach ($webContract in @(
    '@archresearch/web test',
    '@archresearch/web typecheck',
    '@archresearch/edge test',
    '@archresearch/edge typecheck',
    '@archresearch/edge build'
)) {
    if ($verifyScript -notmatch [regex]::Escape($webContract)) {
        throw "The authoritative gate must include Web/Edge contract: $webContract."
    }
}

$edgeConfig = Get-Content -Raw -LiteralPath (
    Join-Path $workspace "apps\edge\wrangler.jsonc"
) | ConvertFrom-Json
if ($edgeConfig.assets.run_worker_first -ne $true) {
    throw "Every Web Edition response must pass through the Worker security-header wrapper."
}

$expectedVersion = "2.1.0"
$boardPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\board\package.json") |
    ConvertFrom-Json
$extensionPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\extension\package.json") |
    ConvertFrom-Json
$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\extension\public\manifest.json") |
    ConvertFrom-Json
foreach ($version in @(
    $boardPackage.version,
    $extensionPackage.version,
    $extensionManifest.version
)) {
    if ($version -ne $expectedVersion) {
        throw "Expected every frontend release surface to use version $expectedVersion, found $version."
    }
}
$pythonProject = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\api\pyproject.toml")
$pythonPackage = Get-Content -Raw -LiteralPath (
    Join-Path $workspace "apps\api\src\archresearch_api\__init__.py"
)
$pythonApp = Get-Content -Raw -LiteralPath (
    Join-Path $workspace "apps\api\src\archresearch_api\main.py"
)
foreach ($versionSource in @($pythonProject, $pythonPackage, $pythonApp)) {
    if ($versionSource -notmatch [regex]::Escape($expectedVersion)) {
        throw "Expected every API release surface to use version $expectedVersion."
    }
}

$updateSource = Get-Content -Raw -LiteralPath $updateScript
foreach ($unsafeGitCommand in @('git pull', 'git reset', 'git clean', 'git checkout')) {
    if ($updateSource.IndexOf($unsafeGitCommand, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "update.ps1 must not mutate the user's Git worktree with $unsafeGitCommand."
    }
}

$testRoot = Join-Path (
    [System.IO.Path]::GetTempPath()
) "archresearch-update-contract-$([guid]::NewGuid().ToString('N'))"
$testScripts = Join-Path $testRoot "scripts"
$logPath = Join-Path $testRoot "update.log"
$previousLog = $env:ARCHRESEARCH_UPDATE_TEST_LOG
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $testScripts | Out-Null
Copy-Item -LiteralPath $updateScript -Destination (Join-Path $testScripts "update.ps1")
Copy-Item -LiteralPath (Join-Path $workspace "scripts\dev-common.ps1") `
    -Destination (Join-Path $testScripts "dev-common.ps1")

function Write-StubScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [int]$ExitCode = 0
    )

    @"
Add-Content -LiteralPath `$env:ARCHRESEARCH_UPDATE_TEST_LOG -Value '$Name'
exit $ExitCode
"@ | Set-Content -LiteralPath (Join-Path $testScripts "$Name.ps1") -Encoding UTF8
}

try {
    $env:ARCHRESEARCH_UPDATE_TEST_LOG = $logPath
    foreach ($name in @("stop", "setup", "verify", "start")) {
        Write-StubScript -Name $name
    }

    $success = Start-Process -FilePath $pwsh -ArgumentList @(
        "-NoProfile", "-File", (Join-Path $testScripts "update.ps1")
    ) -WindowStyle Hidden -Wait -PassThru
    if ($success.ExitCode -ne 0) {
        throw "Expected the update path to succeed with passing child scripts."
    }
    $successOrder = @(Get-Content -LiteralPath $logPath)
    if (($successOrder -join ',') -ne 'stop,setup,verify,start') {
        throw "Expected stop, setup, verify, start order; got $($successOrder -join ',')."
    }

    Remove-Item -LiteralPath $logPath -Force
    Write-StubScript -Name "verify" -ExitCode 23
    $failure = Start-Process -FilePath $pwsh -ArgumentList @(
        "-NoProfile", "-File", (Join-Path $testScripts "update.ps1")
    ) -WindowStyle Hidden -Wait -PassThru
    if ($failure.ExitCode -eq 0) {
        throw "Expected update.ps1 to preserve a failed verification exit."
    }
    $failureOrder = @(Get-Content -LiteralPath $logPath)
    if (($failureOrder -join ',') -ne 'stop,setup,verify') {
        throw "A failed verification must stop before start; got $($failureOrder -join ',')."
    }
}
finally {
    $env:ARCHRESEARCH_UPDATE_TEST_LOG = $previousLog
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output "release tests passed"
