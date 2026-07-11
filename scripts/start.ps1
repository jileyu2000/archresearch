$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace
$pwsh = Resolve-PowerShell7Runtime
$apiPort = Get-AvailableTcpPort -PreferredPort 8000
$boardPort = Get-AvailableTcpPort -PreferredPort 5173
$runtimeDir = Join-Path $workspace ".archresearch"
$logDir = Join-Path $runtimeDir "logs"
$statePath = Join-Path $runtimeDir "dev-processes.json"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$apiProcess = Start-Process `
    -FilePath $runtime.Python `
    -ArgumentList @(
        "-m", "uvicorn", "archresearch_api.main:app",
        "--app-dir", (Join-Path $workspace "apps\api\src"),
        "--host", "127.0.0.1", "--port", "$apiPort"
    ) `
    -WorkingDirectory $workspace `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "api.stdout.log") `
    -RedirectStandardError (Join-Path $logDir "api.stderr.log") `
    -PassThru

try {
    $boardProcess = Start-Process `
        -FilePath $pwsh `
        -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", (Join-Path $PSScriptRoot "run-board.ps1"),
            "-Pnpm", $runtime.Pnpm,
            "-Workspace", $workspace,
            "-BoardPort", "$boardPort",
            "-ApiPort", "$apiPort"
        ) `
        -WorkingDirectory $workspace `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDir "board.stdout.log") `
        -RedirectStandardError (Join-Path $logDir "board.stderr.log") `
        -PassThru

    Wait-HttpReady -Url "http://127.0.0.1:$apiPort/health"
    Wait-HttpReady -Url "http://127.0.0.1:$boardPort"

    $apiListenerIds = @(Get-WorkspaceListeningProcessIds -WorkspaceRoot $workspace -Port $apiPort)
    if ($apiListenerIds.Count -ne 1) {
        throw "Expected one workspace API listener on port $apiPort, found $($apiListenerIds.Count)."
    }
    $boardListenerIds = @(Get-WorkspaceListeningProcessIds -WorkspaceRoot $workspace -Port $boardPort)
    if ($boardListenerIds.Count -ne 1) {
        throw "Expected one workspace board listener on port $boardPort, found $($boardListenerIds.Count)."
    }
    $apiListener = Get-Process -Id $apiListenerIds[0] -ErrorAction Stop
    $boardListener = Get-Process -Id $boardListenerIds[0] -ErrorAction Stop

    @{
        api = @{
            pid = $apiListener.Id
            launcher_pid = $apiProcess.Id
            started_at = $apiListener.StartTime.ToUniversalTime().ToString("o")
            port = $apiPort
        }
        board = @{
            pid = $boardListener.Id
            launcher_pid = $boardProcess.Id
            started_at = $boardListener.StartTime.ToUniversalTime().ToString("o")
            port = $boardPort
        }
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
}
catch {
    Stop-WorkspaceTcpListeners -WorkspaceRoot $workspace -Ports @($apiPort, $boardPort) | Out-Null
    Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    if ($null -ne $boardProcess) {
        Stop-Process -Id $boardProcess.Id -Force -ErrorAction SilentlyContinue
    }
    throw
}

Write-Output "Board: http://127.0.0.1:$boardPort"
Write-Output "API:   http://127.0.0.1:$apiPort"
Write-Output "Extension: $workspace\apps\extension\dist"
Write-Output "Stop with scripts\stop.ps1"
