param(
    [string]$Version = "",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$apiRoot = Join-Path $workspace "apps\api"
$boardRoot = Join-Path $workspace "apps\board"
$launcherPath = Join-Path $workspace "packaging\windows\launcher.py"
$pythonProject = Get-Content -Raw -LiteralPath (Join-Path $apiRoot "pyproject.toml")
$versionMatch = [regex]::Match(
    $pythonProject,
    '(?m)^version\s*=\s*"(?<version>[0-9]+\.[0-9]+\.[0-9]+)"\s*$'
)
if (-not $versionMatch.Success) {
    throw "Could not read the ArchResearch version from apps/api/pyproject.toml."
}
$projectVersion = $versionMatch.Groups["version"].Value
if (-not $Version) {
    $Version = $projectVersion
}
if ($Version -ne $projectVersion) {
    throw "Requested installer version $Version does not match project version $projectVersion."
}

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $workspace ".artifacts\releases"
}
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$buildRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $workspace ".artifacts\build\windows")
)
$workspacePrefix = $workspace.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
foreach ($target in @($outputRoot, $buildRoot)) {
    if (-not $target.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Windows packaging output must stay inside the workspace: $target"
    }
}

$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace
$distRoot = Join-Path $buildRoot "dist"
$workRoot = Join-Path $buildRoot "work"
$specRoot = Join-Path $buildRoot "spec"
$bundleRoot = Join-Path $distRoot "ArchResearch"
$executablePath = Join-Path $bundleRoot "ArchResearch.exe"

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $distRoot, $workRoot, $specRoot, $outputRoot |
    Out-Null

& $runtime.Pnpm --filter @archresearch/board build
if ($LASTEXITCODE -ne 0) {
    throw "The production Board build failed."
}

& $runtime.Python -m pip install --disable-pip-version-check "pyinstaller==6.21.0"
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller installation failed."
}

$addBoard = "$(Join-Path $boardRoot 'dist'):board"
$addAlembicConfig = "$(Join-Path $apiRoot 'alembic.ini'):."
$addAlembic = "$(Join-Path $apiRoot 'alembic'):alembic"
& $runtime.Python -m PyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --windowed `
    --name ArchResearch `
    --distpath $distRoot `
    --workpath $workRoot `
    --specpath $specRoot `
    --paths (Join-Path $apiRoot "src") `
    --collect-all keyring `
    --collect-submodules keyring.backends `
    --collect-all playwright `
    --add-data $addBoard `
    --add-data $addAlembicConfig `
    --add-data $addAlembic `
    $launcherPath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "The self-contained ArchResearch runtime build failed."
}

$selfTest = Start-Process `
    -FilePath $executablePath `
    -ArgumentList "--self-test" `
    -WindowStyle Hidden `
    -Wait `
    -PassThru
if ($selfTest.ExitCode -ne 0) {
    throw "The packaged ArchResearch runtime failed its embedded resource self-test."
}

$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if ($null -eq $iscc) {
    $isccCandidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
    )
    $isccPath = $isccCandidates |
        Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
        Select-Object -First 1
}
else {
    $isccPath = $iscc.Source
}
if (-not $isccPath) {
    throw (
        "Inno Setup 6 is required on the build machine. Install it with: " +
        "winget install --id JRSoftware.InnoSetup --exact --source winget"
    )
}

$installerScript = Join-Path $workspace "packaging\windows\ArchResearch.iss"
& $isccPath `
    "/DAppVersion=$Version" `
    "/DSourceDir=$bundleRoot" `
    "/DOutputDir=$outputRoot" `
    $installerScript
if ($LASTEXITCODE -ne 0) {
    throw "The ArchResearch Windows installer compilation failed."
}

$installer = Join-Path $outputRoot "ArchResearch-Windows-x64-Setup-v$Version.exe"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "Expected installer was not created: $installer"
}
$hash = Get-FileHash -LiteralPath $installer -Algorithm SHA256
Write-Output "Installer: $installer"
Write-Output "SHA-256: $($hash.Hash)"
