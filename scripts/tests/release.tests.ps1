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
    @{ Pattern = 'pnpm install'; Message = "CI must install the Web Edition workspace from a fresh checkout." }
    @{ Pattern = 'pnpm --dir apps/extension exec playwright install chromium'; Message = "CI must install Playwright Chromium for packaged Extension E2E." }
    @{ Pattern = '\./scripts/verify-web\.ps1'; Message = "CI must run the focused Web Edition gate." }
    @{ Pattern = '\./scripts/build-extension-package\.ps1'; Message = "CI must build the separately distributed Chrome extension package." }
    @{ Pattern = 'actions/upload-artifact@v4'; Message = "CI must upload the Chrome extension artifact." }
    @{ Pattern = 'archresearch-chrome-extension-only-v2\.2\.1\.zip'; Message = "CI must keep the clearly named v2.2.1 Chrome extension package separate." }
)
foreach ($contract in $workflowContracts) {
    if ($workflow -notmatch $contract.Pattern) {
        throw $contract.Message
    }
}
if ($workflow -match 'OPENAI_API_KEY|ARCHRESEARCH_PROVIDER_MODE\s*:\s*live') {
    throw "Default CI must not require or enable live provider credentials."
}
if ($workflow -match 'build-windows-installer|test-windows-installer-package|ArchResearch-Windows-x64-Setup') {
    throw "Public CI must not build or publish the retired Windows installer."
}

$extensionBuildPath = Join-Path $workspace "scripts\build-extension-package.ps1"
if (-not (Test-Path -LiteralPath $extensionBuildPath -PathType Leaf)) {
    throw "Expected scripts/build-extension-package.ps1 to create the separate extension artifact."
}
$extensionBuild = Get-Content -Raw -LiteralPath $extensionBuildPath
foreach ($extensionContract in @(
    'archresearch-chrome-extension-only-v\$Version\.zip',
    '@archresearch/extension',
    'manifest\.json'
)) {
    if ($extensionBuild -notmatch $extensionContract) {
        throw "The extension package builder is missing contract: $extensionContract"
    }
}
if ($extensionBuild -match 'build-windows-installer|ArchResearch-Windows-x64-Setup') {
    throw "The extension package builder must stay independent from the Windows installer."
}

$rootPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "package.json") |
    ConvertFrom-Json
$rootBuild = [string]$rootPackage.scripts.build
$webBuild = "pnpm --filter @archresearch/web build"
$edgeBuild = "pnpm --filter @archresearch/edge build"
$webBuildIndex = $rootBuild.IndexOf($webBuild, [StringComparison]::Ordinal)
$edgeBuildIndex = $rootBuild.IndexOf($edgeBuild, [StringComparison]::Ordinal)
if ($webBuildIndex -lt 0 -or $edgeBuildIndex -lt 0 -or $webBuildIndex -ge $edgeBuildIndex) {
    throw "The root build must create Web assets before the Edge Wrangler build consumes them."
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

$webVerifyPath = Join-Path $workspace "scripts\verify-web.ps1"
if (-not (Test-Path -LiteralPath $webVerifyPath -PathType Leaf)) {
    throw "Expected scripts/verify-web.ps1 to provide the focused Web Edition gate."
}
$webVerify = Get-Content -Raw -LiteralPath $webVerifyPath
foreach ($webVerifyContract in @(
    'test:coverage',
    'apps/extension test:e2e',
    '@archresearch/web lint',
    '@archresearch/web typecheck',
    '@archresearch/web test',
    '@archresearch/web build',
    '@archresearch/edge lint',
    '@archresearch/edge typecheck',
    '@archresearch/edge test',
    '@archresearch/edge build'
)) {
    if ($webVerify -notmatch [regex]::Escape($webVerifyContract)) {
        throw "Focused Web Edition gate is missing: $webVerifyContract."
    }
}
if ($webVerify -match 'windows-installer|configure-provider|apps/api/tests') {
    throw "Focused Web Edition gate must not depend on the retired local deployment."
}

$edgeConfig = Get-Content -Raw -LiteralPath (
    Join-Path $workspace "apps\edge\wrangler.jsonc"
) | ConvertFrom-Json
if ($edgeConfig.assets.run_worker_first -ne $true) {
    throw "Every Web Edition response must pass through the Worker security-header wrapper."
}

$expectedVersion = "2.2.1"
$boardPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\board\package.json") |
    ConvertFrom-Json
$webPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\web\package.json") |
    ConvertFrom-Json
$edgePackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\edge\package.json") |
    ConvertFrom-Json
$extensionPackage = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\extension\package.json") |
    ConvertFrom-Json
$extensionManifest = Get-Content -Raw -LiteralPath (Join-Path $workspace "apps\extension\public\manifest.json") |
    ConvertFrom-Json
foreach ($version in @(
    $boardPackage.version,
    $webPackage.version,
    $edgePackage.version,
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

$readme = Get-Content -Raw -LiteralPath (Join-Path $workspace "README.md")
foreach ($readmeContract in @(
    'Web Edition',
    'Web Edition 访问地址由项目方私下提供',
    '不需要本地安装',
    '\[下载 Chrome 扩展 v2\.2\.1\]',
    '\[Chrome 扩展安装说明\]\(docs/chrome-extension\.md\)',
    'Chrome Web Store 尚未上架'
)) {
    if ($readme -notmatch $readmeContract) {
        throw "README must document the Web Edition distribution contract: $readmeContract"
    }
}
$installHeadingIndex = $readme.IndexOf("## 网页版与 Chrome 扩展", [StringComparison]::Ordinal)
$firstScreenshotIndex = $readme.IndexOf("![ArchResearch 首页]", [StringComparison]::Ordinal)
$positioningHeadingIndex = $readme.IndexOf("## 项目定位", [StringComparison]::Ordinal)
if (
    $installHeadingIndex -lt 0 -or
    $installHeadingIndex -ge $firstScreenshotIndex -or
    $installHeadingIndex -ge $positioningHeadingIndex
) {
    throw "The Web Edition and extension path must appear before screenshots and product architecture."
}
foreach ($obsoleteInstallHeading in @(
    "## 快速开始",
    "### 从源码开发",
    "### 更新已有安装",
    "### 安装扩展与配对"
)) {
    if ($readme.Contains($obsoleteInstallHeading, [StringComparison]::Ordinal)) {
        throw "README ordinary-user path must not mix in obsolete section: $obsoleteInstallHeading"
    }
}
if ($readme -match 'ArchResearch-Windows-x64-Setup|下载 Windows 安装版|127\.0\.0\.1:8000|scripts/setup\.ps1|scripts/configure-autostart\.ps1|scripts/update\.ps1') {
    throw "README must not publish the retired local deployment path."
}

$chromeExtensionGuidePath = Join-Path $workspace "docs\chrome-extension.md"
$developmentGuidePath = Join-Path $workspace "docs\development.md"
foreach ($guidePath in @($chromeExtensionGuidePath, $developmentGuidePath)) {
    if (-not (Test-Path -LiteralPath $guidePath -PathType Leaf)) {
        throw "README linked guide is missing: $guidePath"
    }
}
$chromeExtensionGuide = Get-Content -Raw -LiteralPath $chromeExtensionGuidePath
foreach ($extensionGuideContract in @(
    'chrome://extensions',
    'manifest\.json',
    '连接当前 ArchResearch 网页',
    '连接成功后'
)) {
    if ($chromeExtensionGuide -notmatch $extensionGuideContract) {
        throw "Chrome extension guide is missing contract: $extensionGuideContract"
    }
}
$developmentGuide = Get-Content -Raw -LiteralPath $developmentGuidePath
foreach ($developmentGuideContract in @(
    'scripts/setup\.ps1',
    'scripts/start\.ps1',
    'scripts/update\.ps1',
    'scripts/configure-provider\.ps1'
)) {
    if ($developmentGuide -notmatch $developmentGuideContract) {
        throw "Development guide is missing contract: $developmentGuideContract"
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
