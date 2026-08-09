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
    @{ Pattern = '\./scripts/verify\.ps1'; Message = "CI must run the authoritative local repository gate." }
    @{ Pattern = '\./scripts/build-windows-installer\.ps1'; Message = "CI must build the self-contained Windows installer." }
    @{ Pattern = '\./scripts/test-windows-installer-package\.ps1'; Message = "CI must install-smoke and uninstall the packaged Windows application." }
    @{ Pattern = '\./scripts/build-extension-package\.ps1'; Message = "CI must build the separately distributed Chrome extension package." }
    @{ Pattern = 'actions/upload-artifact@v4'; Message = "CI must upload release artifacts." }
    @{ Pattern = 'ArchResearch-Windows-x64-Setup-v2\.3\.0\.exe'; Message = "CI must publish the clearly named v2.3.0 Windows installer artifact." }
    @{ Pattern = 'archresearch-chrome-extension-only-v2\.3\.0\.zip'; Message = "CI must keep the clearly named v2.3.0 Chrome extension package separate." }
)
foreach ($contract in $workflowContracts) {
    if ($workflow -notmatch $contract.Pattern) {
        throw $contract.Message
    }
}
if ($workflow -match 'OPENAI_API_KEY|ARCHRESEARCH_PROVIDER_MODE\s*:\s*live') {
    throw "Default CI must not require or enable live provider credentials."
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
foreach ($localBuild in @(
    'pnpm --filter @archresearch/board build',
    'pnpm --filter @archresearch/extension build'
)) {
    if ($rootBuild -notmatch [regex]::Escape($localBuild)) {
        throw "The root build must include the local product build: $localBuild."
    }
}
if ($rootBuild -match '@archresearch/(web|edge)') {
    throw "The root build must not include the retired Web or Edge workspaces."
}

$workspaceConfig = Get-Content -Raw -LiteralPath (Join-Path $workspace "pnpm-workspace.yaml")
foreach ($localWorkspace in @('apps/board', 'apps/extension')) {
    if ($workspaceConfig -notmatch [regex]::Escape($localWorkspace)) {
        throw "The pnpm workspace is missing the local package: $localWorkspace."
    }
}
if ($workspaceConfig -match 'apps/(web|edge)|workerd|cloudflare') {
    throw "The pnpm workspace must not include retired Web/Edge or Cloudflare build configuration."
}
foreach ($retiredPath in @(
    "apps\web",
    "apps\edge",
    "scripts\verify-web.ps1"
)) {
    if (Test-Path -LiteralPath (Join-Path $workspace $retiredPath)) {
        throw "Retired Web Edition path still exists: $retiredPath"
    }
}

$verifyScript = Get-Content -Raw -LiteralPath (Join-Path $workspace "scripts\verify.ps1")
foreach ($localVerifyContract in @(
    'release\.tests\.ps1',
    'windows-installer\.tests\.ps1',
    'apps/api/tests',
    'apps/extension test:e2e'
)) {
    if ($verifyScript -notmatch $localVerifyContract) {
        throw "The authoritative gate is missing local contract: $localVerifyContract."
    }
}
if ($verifyScript -match '@archresearch/(web|edge)|verify-web|wrangler') {
    throw "The authoritative local gate must not invoke the retired Web or Edge runtime."
}

$expectedVersion = "2.3.0"
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

$readme = Get-Content -Raw -LiteralPath (Join-Path $workspace "README.md")
foreach ($readmeContract in @(
    'Windows 11 \+ Google Chrome',
    'ArchResearch-Windows-x64-Setup-v2\.3\.0\.exe',
    'Windows 安装器不会捆绑扩展',
    '不需要另外安装 Python 或 Node\.js',
    'OpenAI-compatible API 地址和 API Key',
    '模型列表中选择模型',
    '## 可以用它做什么',
    '## ArchResearch 怎样完成一次研究',
    '## 两种研究方式',
    '## 一次研究会留下什么',
    '## 使用步骤',
    '## 本地数据与安全',
    '真实项目和来源链接',
    '图纸类型和视觉方向',
    '\[下载 Windows 安装版 v2\.3\.0\]',
    '\[下载 Chrome 扩展 v2\.3\.0\]',
    '\[Chrome 扩展安装说明\]\(docs/chrome-extension\.md\)',
    '\[从源码运行与维护\]\(docs/development\.md\)'
)) {
    if ($readme -notmatch $readmeContract) {
        throw "README must explain the user-facing product contract: $readmeContract"
    }
}
$installHeadingIndex = $readme.IndexOf("## 下载与安装", [StringComparison]::Ordinal)
$capabilitiesHeadingIndex = $readme.IndexOf("## 可以用它做什么", [StringComparison]::Ordinal)
$workflowHeadingIndex = $readme.IndexOf("## ArchResearch 怎样完成一次研究", [StringComparison]::Ordinal)
if (
    $installHeadingIndex -lt 0 -or
    $capabilitiesHeadingIndex -lt 0 -or
    $workflowHeadingIndex -lt 0 -or
    $installHeadingIndex -ge $capabilitiesHeadingIndex -or
    $capabilitiesHeadingIndex -ge $workflowHeadingIndex
) {
    throw "README must lead from installation to product capabilities and then explain the workflow."
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
foreach ($developerSection in @(
    "## Agent 架构",
    "## 验证",
    "## 完成度与边界",
    "## 设计与计划"
)) {
    if ($readme.Contains($developerSection, [StringComparison]::Ordinal)) {
        throw "README product homepage must not contain developer section: $developerSection"
    }
}
if ($readme -match 'scripts/setup\.ps1|scripts/configure-autostart\.ps1|scripts/update\.ps1|scripts/verify\.ps1|workflow\.py|LangGraph|Firecrawl|Provider 原生 `web_search`') {
    throw "Implementation choices, retired technologies, and maintenance commands belong in developer documentation."
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
    'ArchResearch 本地页面',
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
