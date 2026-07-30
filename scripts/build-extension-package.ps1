param(
    [string]$Version = "",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$extensionRoot = Join-Path $workspace "apps\extension"
$manifestPath = Join-Path $extensionRoot "public\manifest.json"
$packagePath = Join-Path $extensionRoot "package.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json

if (-not $Version) {
    $Version = [string]$manifest.version
}
if ($Version -ne [string]$manifest.version -or $Version -ne [string]$package.version) {
    throw "Requested extension version $Version does not match its manifest and package versions."
}

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $workspace ".artifacts\releases"
}
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$workspacePrefix = $workspace.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
if (-not $outputRoot.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Extension packaging output must stay inside the workspace: $outputRoot"
}

$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace
& $runtime.Pnpm --filter @archresearch/extension build
if ($LASTEXITCODE -ne 0) {
    throw "The production Chrome extension build failed."
}

$distRoot = Join-Path $extensionRoot "dist"
$distManifestPath = Join-Path $distRoot "manifest.json"
if (-not (Test-Path -LiteralPath $distManifestPath -PathType Leaf)) {
    throw "The extension build must place manifest.json at the package root."
}
$distManifest = Get-Content -Raw -LiteralPath $distManifestPath | ConvertFrom-Json
if ([string]$distManifest.version -ne $Version) {
    throw "The built extension manifest version does not match $Version."
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$archivePath = Join-Path $outputRoot "archresearch-chrome-extension-only-v$Version.zip"
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $distRoot,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $rootManifest = $archive.Entries |
        Where-Object { $_.FullName -eq "manifest.json" } |
        Select-Object -First 1
    if ($null -eq $rootManifest) {
        throw "The extension ZIP must contain manifest.json at its root."
    }
}
finally {
    $archive.Dispose()
}

$hash = Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
Write-Output "Extension: $archivePath"
Write-Output "SHA-256: $($hash.Hash)"
