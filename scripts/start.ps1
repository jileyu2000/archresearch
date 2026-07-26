$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-common.ps1")

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $workspace ".archresearch"
$logDir = Join-Path $runtimeDir "logs"
$statePath = Join-Path $runtimeDir "dev-processes.json"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (Test-Path -LiteralPath $statePath) {
    $state = $null
    try {
        $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
    }
    catch {
        Write-Warning "The recorded development process state is invalid and will be replaced."
    }

    if ($null -ne $state -and (Test-WorkspaceDevelopmentServicesReady `
        -WorkspaceRoot $workspace `
        -State $state)) {
        $apiPort = [int]$state.api.port
        $boardPort = [int]$state.board.port
        Write-Output "ArchResearch development services are already running."
        Write-Output "Board: http://127.0.0.1:$boardPort"
        Write-Output "API:   http://127.0.0.1:$apiPort"
        Write-Output "Extension: $workspace\apps\extension\dist"
        Write-Output "Stop with scripts\stop.ps1"
        exit 0
    }

    $recordedPorts = @(
        foreach ($serviceName in @("api", "board")) {
            try {
                $port = [int]$state.$serviceName.port
                if ($port -ge 1 -and $port -le 65535) {
                    $port
                }
            }
            catch {
                continue
            }
        }
    )
    if ($recordedPorts.Count -gt 0) {
        Stop-WorkspaceTcpListeners `
            -WorkspaceRoot $workspace `
            -Ports $recordedPorts | Out-Null
    }
    Remove-Item -LiteralPath $statePath -Force
}

$runtime = Resolve-WorkspaceRuntime -WorkspaceRoot $workspace
$pwsh = Resolve-PowerShell7Runtime
$apiPort = Get-AvailableTcpPort -PreferredPort 8000
$boardPort = Get-AvailableTcpPort -PreferredPort 5173
$apiProcess = $null
$boardProcess = $null

try {
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
    $failure = $_
    foreach ($logName in @(
        "api.stdout.log",
        "api.stderr.log",
        "board.stdout.log",
        "board.stderr.log"
    )) {
        $logPath = Join-Path $logDir $logName
        if (Test-Path -LiteralPath $logPath) {
            Write-Warning "$logName (last 20 lines):"
            Get-Content -LiteralPath $logPath -Tail 20 -ErrorAction SilentlyContinue |
                ForEach-Object { Write-Warning $_ }
        }
    }
    Stop-WorkspaceTcpListeners -WorkspaceRoot $workspace -Ports @($apiPort, $boardPort) | Out-Null
    if ($null -ne $apiProcess) {
        Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $boardProcess) {
        Stop-Process -Id $boardProcess.Id -Force -ErrorAction SilentlyContinue
    }
    throw $failure
}

Write-Output "Board: http://127.0.0.1:$boardPort"
Write-Output "API:   http://127.0.0.1:$apiPort"
Write-Output "Extension: $workspace\apps\extension\dist"
Write-Output "Stop with scripts\stop.ps1"
