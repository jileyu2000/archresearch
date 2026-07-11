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

Write-Output "dev-common tests passed"
