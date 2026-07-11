Set-StrictMode -Version Latest

function Test-TcpPortAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $listener.Start()
        return $true
    }
    catch [System.Net.Sockets.SocketException] {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Get-AvailableTcpPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$PreferredPort,
        [int]$SearchLimit = 100
    )

    foreach ($port in $PreferredPort..($PreferredPort + $SearchLimit)) {
        if (Test-TcpPortAvailable -Port $port) {
            return $port
        }
    }
    throw "No free loopback port found after $PreferredPort."
}

function Resolve-CommandPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            return $command.Source
        }
    }
    return $null
}

function Resolve-PowerShell7Runtime {
    $pwsh = Resolve-CommandPath -Names @("pwsh.exe", "pwsh")
    if (-not $pwsh) {
        throw "PowerShell 7 was not found. Install PowerShell 7 and run the script with pwsh."
    }
    return [System.IO.Path]::GetFullPath($pwsh)
}

function Resolve-PythonRuntime {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot
    )

    $pythonCandidates = @(
        (Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"),
        (Join-Path $WorkspaceRoot "apps\api\.venv\Scripts\python.exe")
    )
    $python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $python) {
        $python = Resolve-CommandPath -Names @("python.exe", "python")
    }
    if (-not $python) {
        throw "Python 3.12 was not found. Run scripts/setup.ps1 from a Python-enabled shell."
    }
    return [System.IO.Path]::GetFullPath($python)
}

function Resolve-WorkspaceRuntime {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot
    )

    $python = Resolve-PythonRuntime -WorkspaceRoot $WorkspaceRoot
    $pnpm = Resolve-CommandPath -Names @("pnpm.cmd", "pnpm")
    if (-not $pnpm) {
        throw "pnpm was not found. Install pnpm 11 or use the bundled Codex runtime."
    }

    return [PSCustomObject]@{
        Python = $python
        Pnpm = [System.IO.Path]::GetFullPath($pnpm)
    }
}

function Get-TcpListeningProcessIds {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateRange(1, 65535)]
        [int]$Port
    )

    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -in @("127.0.0.1", "::1") } |
        ForEach-Object { [int]$_.OwningProcess } |
        Sort-Object -Unique
}

function Get-ProcessCommandLine {
    param(
        [Parameter(Mandatory = $true)]
        [int]$ProcessId
    )

    try {
        $record = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        return [string]$record.CommandLine
    }
    catch {
        return $null
    }
}

function Test-CommandLineReferencesWorkspace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandLine,
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot
    )

    $workspace = [System.IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd([char]'\', [char]'/')
    $normalizedWorkspace = $workspace.Replace('/', '\')
    $normalizedCommandLine = $CommandLine.Replace('/', '\')
    return $normalizedCommandLine.IndexOf(
        $normalizedWorkspace,
        [System.StringComparison]::OrdinalIgnoreCase
    ) -ge 0
}

function Get-WorkspaceListeningProcessIds {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot,
        [Parameter(Mandatory = $true)]
        [ValidateRange(1, 65535)]
        [int]$Port
    )

    foreach ($processId in @(Get-TcpListeningProcessIds -Port $Port)) {
        $commandLine = Get-ProcessCommandLine -ProcessId $processId
        if ($commandLine -and (Test-CommandLineReferencesWorkspace `
            -CommandLine $commandLine `
            -WorkspaceRoot $WorkspaceRoot)) {
            Write-Output $processId
        }
    }
}

function Stop-WorkspaceTcpListeners {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot,
        [Parameter(Mandatory = $true)]
        [int[]]$Ports
    )

    $processIds = @(
        foreach ($port in @($Ports | Sort-Object -Unique)) {
            Get-WorkspaceListeningProcessIds -WorkspaceRoot $WorkspaceRoot -Port $port
        }
    ) | Sort-Object -Unique

    foreach ($processId in $processIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            continue
        }
        Stop-Process -InputObject $process -Force -ErrorAction Stop
        $process.WaitForExit(5000) | Out-Null
        Write-Output $processId
    }
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [int]$Attempts = 40
    )

    foreach ($attempt in 1..$Attempts) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    throw "Service did not become ready: $Url"
}
