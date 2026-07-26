$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\dev-common.ps1")

$preferred = 49152
$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $preferred
)
$listener.Start()
try {
    $available = Get-AvailableTcpPort -PreferredPort $preferred
    if ($available -le $preferred) {
        throw "Expected an available port above the occupied preferred port."
    }
}
finally {
    $listener.Stop()
}

$workspace = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$python = Resolve-PythonRuntime -WorkspaceRoot $workspace.Path
if (-not $python.EndsWith("python.exe")) {
    throw "Expected the project Python executable without requiring pnpm."
}

$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace.Path
if (-not $runtime.Python.EndsWith("python.exe")) {
    throw "Expected a Python executable."
}
if (-not $runtime.Pnpm.EndsWith("pnpm.cmd")) {
    throw "Expected a pnpm executable."
}

$verifyScript = Get-Content -Raw (Join-Path $workspace.Path "scripts\verify.ps1")
if (-not $verifyScript.Contains('$PSNativeCommandUseErrorActionPreference = $true')) {
    throw "Expected verify.ps1 to stop when a native verification command fails."
}

$setupScript = Get-Content -Raw (Join-Path $workspace.Path "scripts\setup.ps1")
if (-not $setupScript.Contains('$PSNativeCommandUseErrorActionPreference = $true')) {
    throw "Expected setup.ps1 to stop when a native installation command fails."
}

$boardScript = Get-Content -Raw (Join-Path $workspace.Path "scripts\run-board.ps1")
if (-not $boardScript.Contains('VITE_ARCHRESEARCH_BROWSER_ENDPOINT')) {
    throw "Expected the board launcher to expose the selected API port to browser pairing."
}

Write-Output "dev-common tests passed"
