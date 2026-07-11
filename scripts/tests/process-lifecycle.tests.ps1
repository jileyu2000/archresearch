Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "..\dev-common.ps1")

function Wait-Listener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    foreach ($attempt in 1..40) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        if ($null -ne $listener) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "Listener did not start on port $Port."
}

function Stop-TestListener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$python = Resolve-PythonRuntime -WorkspaceRoot $workspace
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
$workspacePort = Get-AvailableTcpPort -PreferredPort 49200
$outsidePort = Get-AvailableTcpPort -PreferredPort ($workspacePort + 1)
$testRuntime = Join-Path $workspace ".archresearch\process-lifecycle-test"
$launcherScript = Join-Path $testRuntime "launch-child.ps1"
$outsideScript = Join-Path ([System.IO.Path]::GetTempPath()) "archresearch-outside-listener-$([guid]::NewGuid().ToString('N')).ps1"
$launcher = $null
$outsideProcess = $null

New-Item -ItemType Directory -Force -Path $testRuntime | Out-Null
@'
param([string]$Python, [int]$Port, [string]$Workspace)
& $Python -m http.server $Port --bind 127.0.0.1 --directory $Workspace
'@ | Set-Content -LiteralPath $launcherScript -Encoding UTF8

@'
param([int]$Port)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
try {
    while ($true) { Start-Sleep -Seconds 1 }
}
finally {
    $listener.Stop()
}
'@ | Set-Content -LiteralPath $outsideScript -Encoding UTF8

try {
    $launcher = Start-Process -FilePath $pwsh -ArgumentList @(
        "-NoProfile", "-File", $launcherScript,
        "-Python", $python,
        "-Port", "$workspacePort",
        "-Workspace", $workspace
    ) -WindowStyle Hidden -PassThru
    $outsideProcess = Start-Process -FilePath $pwsh -ArgumentList @(
        "-NoProfile", "-File", $outsideScript, "-Port", "$outsidePort"
    ) -WindowStyle Hidden -PassThru

    Wait-Listener -Port $workspacePort
    Wait-Listener -Port $outsidePort

    $listenerIds = @(Get-WorkspaceListeningProcessIds -WorkspaceRoot $workspace -Port $workspacePort)
    if ($listenerIds.Count -ne 1) {
        throw "Expected exactly one workspace listener, found $($listenerIds.Count)."
    }
    if ($listenerIds[0] -eq $launcher.Id) {
        throw "The test must reproduce a launcher PID that differs from its listening child PID."
    }

    $outsideIds = @(Get-WorkspaceListeningProcessIds -WorkspaceRoot $workspace -Port $outsidePort)
    if ($outsideIds.Count -ne 0) {
        throw "A listener whose command line does not reference the workspace must be ignored."
    }

    $stopped = @(Stop-WorkspaceTcpListeners -WorkspaceRoot $workspace -Ports @($workspacePort, $outsidePort))
    if ($stopped.Count -ne 1 -or $stopped[0] -ne $listenerIds[0]) {
        throw "Only the workspace-owned listening child should be stopped."
    }
    Start-Sleep -Milliseconds 250
    if ($null -ne (Get-NetTCPConnection -State Listen -LocalPort $workspacePort -ErrorAction SilentlyContinue)) {
        throw "Workspace listener is still running."
    }
    if ($null -eq (Get-NetTCPConnection -State Listen -LocalPort $outsidePort -ErrorAction SilentlyContinue)) {
        throw "Unrelated listener was stopped."
    }

    $startScript = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "..\start.ps1")
    if ($startScript -match 'powershell\.exe') {
        throw "start.ps1 must use PowerShell 7 instead of powershell.exe."
    }
    if ($startScript -notmatch 'Resolve-PowerShell7Runtime') {
        throw "start.ps1 must resolve PowerShell 7 explicitly."
    }
    if ($startScript -notmatch 'Get-WorkspaceListeningProcessIds' -or
        $startScript -notmatch 'launcher_pid') {
        throw "start.ps1 must record both the launcher and verified listener PID."
    }

    $stopScript = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "..\stop.ps1")
    if ($stopScript -notmatch 'Stop-WorkspaceTcpListeners') {
        throw "stop.ps1 must stop verified listeners rather than trusting launcher PIDs."
    }
    if ($stopScript -match 'Get-Process\s+-Id\s+\(\[int\]\$entry\.pid') {
        throw "stop.ps1 must not trust a PID from state without re-checking its listener and command line."
    }
    if ($stopScript -notmatch 'Refusing to read process state outside the workspace runtime directory') {
        throw "stop.ps1 must preserve its workspace path safety check."
    }
}
finally {
    Stop-TestListener -Port $workspacePort
    Stop-TestListener -Port $outsidePort
    if ($null -ne $launcher) {
        Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $outsideProcess) {
        Stop-Process -Id $outsideProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $launcherScript -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $outsideScript -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $testRuntime -Force -ErrorAction SilentlyContinue
}

Write-Output "process lifecycle tests passed"
