param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$taskPath = Join-Path $repoRoot "fixtures/queries/research_tasks.jsonl"
$classificationRoot = Join-Path $repoRoot "fixtures/evaluation/classification"
$datasetPath = Join-Path $classificationRoot "dataset.json"
$generatorPath = Join-Path $classificationRoot "generate.ps1"
$generatedRoot = Join-Path $classificationRoot "generated"
$allowedGoals = @("precedent_research", "visual_reference_search")
$allowedModes = @("quick", "balanced", "deep")
$allowedAssetTypes = @("plan", "section", "elevation", "site_plan", "axonometric", "circulation", "analysis_diagram", "render", "photograph")

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$taskLines = @(Get-Content -LiteralPath $taskPath | Where-Object { $_.Trim().Length -gt 0 })
$tasks = @($taskLines | ForEach-Object { $_ | ConvertFrom-Json })
Assert-Condition ($tasks.Count -eq 25) "Expected exactly 25 research tasks; found $($tasks.Count)."
Assert-Condition ((@($tasks.id | Sort-Object -Unique)).Count -eq 25) "Research task IDs must be unique."

foreach ($task in $tasks) {
    Assert-Condition ($task.schema_version -eq "1.0.0") "Task $($task.id) has an unsupported schema version."
    Assert-Condition ($task.evaluation_date -match '^\d{4}-\d{2}-\d{2}$') "Task $($task.id) has an invalid evaluation date."
    Assert-Condition ($allowedGoals -contains $task.goal) "Task $($task.id) has an invalid goal."
    Assert-Condition ($allowedModes -contains $task.mode) "Task $($task.id) has an invalid mode."
    Assert-Condition ($task.question.Trim().Length -ge 3) "Task $($task.id) has an empty question."
    foreach ($assetType in @($task.asset_types)) {
        Assert-Condition ($allowedAssetTypes -contains $assetType) "Task $($task.id) uses unknown asset type $assetType."
    }
    foreach ($assetType in @($task.expected_coverage.required_asset_types)) {
        Assert-Condition ($allowedAssetTypes -contains $assetType) "Task $($task.id) expects unknown asset type $assetType."
        Assert-Condition (@($task.asset_types) -contains $assetType) "Task $($task.id) requires $assetType but does not request it."
    }
    Assert-Condition ([int]$task.expected_coverage.min_usable_assets -ge 1) "Task $($task.id) needs a positive usable-asset target."
    Assert-Condition ([int]$task.expected_coverage.min_projects -ge 1) "Task $($task.id) needs a positive project target."
    Assert-Condition ([int]$task.expected_coverage.min_verified_or_partial -ge 1) "Task $($task.id) needs a positive evidence target."
    Assert-Condition (@($task.expected_coverage.expected_gaps).Count -ge 1) "Task $($task.id) must name at least one evidence boundary."
}

$goalCounts = $tasks | Group-Object goal -AsHashTable -AsString
foreach ($goal in $allowedGoals) {
    Assert-Condition ($goalCounts.ContainsKey($goal)) "Research fixtures do not cover goal $goal."
}
foreach ($assetType in $allowedAssetTypes) {
    Assert-Condition (@($tasks | Where-Object { @($_.asset_types) -contains $assetType }).Count -gt 0) "Research fixtures do not cover asset type $assetType."
}

$dataset = Get-Content -Raw -LiteralPath $datasetPath | ConvertFrom-Json
Assert-Condition ($dataset.schema_version -eq "1.0.0") "Classification dataset schema version is unsupported."
Assert-Condition ([int]$dataset.variants_per_class -ge 12) "Classification dataset needs at least 12 variants per class."
Assert-Condition ((@($dataset.asset_types.id | Sort-Object -Unique)).Count -eq 9) "Classification dataset must define exactly nine unique classes."
foreach ($assetType in $allowedAssetTypes) {
    Assert-Condition (@($dataset.asset_types.id) -contains $assetType) "Classification dataset is missing $assetType."
}

& $generatorPath -OutputRoot $generatedRoot | Out-Host
$samplePath = Join-Path $generatedRoot "samples.jsonl"
$sampleLines = @(Get-Content -LiteralPath $samplePath | Where-Object { $_.Trim().Length -gt 0 })
$samples = @($sampleLines | ForEach-Object { $_ | ConvertFrom-Json })
Assert-Condition ($samples.Count -ge 100) "Expected at least 100 classification samples; found $($samples.Count)."
Assert-Condition ((@($samples.id | Sort-Object -Unique)).Count -eq $samples.Count) "Classification sample IDs must be unique."
Assert-Condition ((@($samples.image_sha256 | Sort-Object -Unique)).Count -eq $samples.Count) "Classification sample images must have unique hashes."

foreach ($assetType in $allowedAssetTypes) {
    $classSamples = @($samples | Where-Object { $_.asset_type -eq $assetType })
    Assert-Condition ($classSamples.Count -ge 12) "Classification class $assetType has fewer than 12 samples."
}
foreach ($sample in $samples) {
    Assert-Condition ($allowedAssetTypes -contains $sample.asset_type) "Sample $($sample.id) has an invalid class."
    Assert-Condition ([bool]$sample.synthetic) "Sample $($sample.id) must be marked synthetic."
    Assert-Condition ($sample.rights_status -eq "user_owned") "Sample $($sample.id) has an unexpected rights status."
    Assert-Condition ([int]$sample.expected_relevance -ge 0 -and [int]$sample.expected_relevance -le 4) "Sample $($sample.id) has invalid relevance."
    $imagePath = Join-Path $generatedRoot ($sample.image_path -replace '/', [System.IO.Path]::DirectorySeparatorChar)
    Assert-Condition (Test-Path -LiteralPath $imagePath -PathType Leaf) "Sample $($sample.id) image is missing."
    try {
        $svg = [xml](Get-Content -Raw -LiteralPath $imagePath)
    }
    catch {
        throw "Sample $($sample.id) is not valid SVG XML: $($_.Exception.Message)"
    }
    Assert-Condition ($svg.DocumentElement.LocalName -eq "svg") "Sample $($sample.id) does not have an SVG root element."
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $imagePath).Hash.ToLowerInvariant()
    Assert-Condition ($actualHash -eq $sample.image_sha256) "Sample $($sample.id) image hash does not match."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("archresearch-eval-" + [guid]::NewGuid().ToString("N"))
try {
    & $generatorPath -OutputRoot $tempRoot | Out-Host
    $expectedFiles = @(Get-ChildItem -LiteralPath $generatedRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($generatedRoot.Length).TrimStart('\', '/') } | Sort-Object)
    $actualFiles = @(Get-ChildItem -LiteralPath $tempRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($tempRoot.Length).TrimStart('\', '/') } | Sort-Object)
    Assert-Condition (@(Compare-Object $expectedFiles $actualFiles).Count -eq 0) "Classification generator produced a different file set."
    foreach ($relativePath in $expectedFiles) {
        $expectedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $generatedRoot $relativePath)).Hash
        $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $tempRoot $relativePath)).Hash
        Assert-Condition ($expectedHash -eq $actualHash) "Classification generator is not deterministic for $relativePath."
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTemp = [System.IO.Path]::GetFullPath($tempRoot)
        $resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
        Assert-Condition ($resolvedTemp.StartsWith($resolvedSystemTemp, [System.StringComparison]::OrdinalIgnoreCase)) "Refusing to clean a path outside the system temp directory."
        Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
}

Write-Output "Evaluation fixtures valid: $($tasks.Count) research tasks and $($samples.Count) deterministic classification samples across nine classes."
