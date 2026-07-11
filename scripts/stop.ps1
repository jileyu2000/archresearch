$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = (Join-Path $workspace ".archresearch")
$statePath = Join-Path $runtimeDir "dev-processes.json"
if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Output "No ArchResearch development processes are recorded."
    exit 0
}

$resolvedState = (Resolve-Path -LiteralPath $statePath).Path
$runtimeBoundary = $runtimeDir.TrimEnd([char]'\', [char]'/') + [System.IO.Path]::DirectorySeparatorChar
if (-not $resolvedState.StartsWith($runtimeBoundary, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to read process state outside the workspace runtime directory."
}

$state = Get-Content -Raw -LiteralPath $resolvedState | ConvertFrom-Json
$ports = @(
    foreach ($entry in @($state.api, $state.board)) {
        $port = [int]$entry.port
        if ($port -lt 1 -or $port -gt 65535) {
            throw "Invalid port in process state: $port"
        }
        $port
    }
)

$stoppedProcessIds = @(Stop-WorkspaceTcpListeners -WorkspaceRoot $workspace -Ports $ports)
if ($stoppedProcessIds.Count -eq 0) {
    Write-Warning "No listening ArchResearch processes matched the recorded ports and workspace."
}

Remove-Item -LiteralPath $resolvedState -Force
Write-Output "ArchResearch development processes stopped."
