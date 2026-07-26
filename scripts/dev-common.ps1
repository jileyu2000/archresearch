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

function Initialize-ProcessInterop {
    if ("ArchResearchProcessInterop" -as [type]) {
        return
    }

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class ArchResearchProcessInterop
{
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessBasicInformation
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2_0;
        public IntPtr Reserved2_1;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved3;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeString
    {
        public ushort Length;
        public ushort MaximumLength;
        public IntPtr Buffer;
    }

    [DllImport("ntdll.dll")]
    private static extern int NtQueryInformationProcess(
        IntPtr processHandle,
        int processInformationClass,
        ref ProcessBasicInformation processInformation,
        int processInformationLength,
        out int returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(int access, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ReadProcessMemory(
        IntPtr processHandle,
        IntPtr baseAddress,
        IntPtr buffer,
        IntPtr size,
        out IntPtr bytesRead);

    private const int ProcessQueryInformation = 0x0400;
    private const int ProcessVmRead = 0x0010;

    private static IntPtr Read(IntPtr process, IntPtr address, int size)
    {
        IntPtr buffer = Marshal.AllocHGlobal(size);
        IntPtr read;
        if (!ReadProcessMemory(process, address, buffer, (IntPtr)size, out read) ||
            read.ToInt64() != size)
        {
            Marshal.FreeHGlobal(buffer);
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        return buffer;
    }

    public static string GetCommandLine(int processId)
    {
        IntPtr process = OpenProcess(ProcessQueryInformation | ProcessVmRead, false, processId);
        if (process == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        try
        {
            ProcessBasicInformation info = new ProcessBasicInformation();
            int returned;
            int status = NtQueryInformationProcess(process, 0, ref info, Marshal.SizeOf(info), out returned);
            if (status != 0)
            {
                throw new InvalidOperationException("NtQueryInformationProcess failed with status " + status + ".");
            }

            int pointerSize = IntPtr.Size;
            // PEB.ProcessParameters lives at 0x20 on 64-bit and 0x10 on 32-bit.
            int parametersOffset = pointerSize == 8 ? 0x20 : 0x10;
            IntPtr parametersBuffer = Read(process, info.PebBaseAddress + parametersOffset, pointerSize);
            IntPtr parameters;
            try
            {
                parameters = pointerSize == 8
                    ? (IntPtr)Marshal.ReadInt64(parametersBuffer)
                    : (IntPtr)Marshal.ReadInt32(parametersBuffer);
            }
            finally
            {
                Marshal.FreeHGlobal(parametersBuffer);
            }

            // RTL_USER_PROCESS_PARAMETERS.CommandLine lives at 0x70 on 64-bit and 0x40 on 32-bit.
            int commandLineOffset = pointerSize == 8 ? 0x70 : 0x40;
            IntPtr unicodeBuffer = Read(
                process,
                parameters + commandLineOffset,
                Marshal.SizeOf(typeof(UnicodeString)));
            UnicodeString unicode;
            try
            {
                unicode = (UnicodeString)Marshal.PtrToStructure(unicodeBuffer, typeof(UnicodeString));
            }
            finally
            {
                Marshal.FreeHGlobal(unicodeBuffer);
            }

            if (unicode.Length == 0 || unicode.Buffer == IntPtr.Zero)
            {
                return string.Empty;
            }

            IntPtr textBuffer = Read(process, unicode.Buffer, unicode.Length);
            try
            {
                return Marshal.PtrToStringUni(textBuffer, unicode.Length / 2);
            }
            finally
            {
                Marshal.FreeHGlobal(textBuffer);
            }
        }
        finally
        {
            CloseHandle(process);
        }
    }
}
'@
}

function Get-TcpListeningProcessIds {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateRange(1, 65535)]
        [int]$Port
    )

    $loopbackEndpoints = @("127.0.0.1:$Port", "[::1]:$Port")
    $unconnectedEndpoints = @("0.0.0.0:0", "[::]:0", "*:*")

    $processIds = foreach ($row in @(& netstat.exe -ano)) {
        $fields = -split $row.Trim()
        if ($fields.Count -lt 5 -or $fields[0] -ne "TCP") {
            continue
        }
        if ($loopbackEndpoints -notcontains $fields[1] -or
            $unconnectedEndpoints -notcontains $fields[2]) {
            continue
        }

        $processId = 0
        if (-not [int]::TryParse($fields[4], [ref]$processId) -or $processId -le 0) {
            continue
        }
        $processId
    }

    @($processIds) | Sort-Object -Unique
}

function Get-ProcessCommandLine {
    param(
        [Parameter(Mandatory = $true)]
        [int]$ProcessId
    )

    try {
        Initialize-ProcessInterop
        return [ArchResearchProcessInterop]::GetCommandLine($ProcessId)
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

function Test-HttpEndpointReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest `
            -UseBasicParsing `
            -SkipHttpErrorCheck `
            -Uri $Url `
            -TimeoutSec 1
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

function Test-WorkspaceDevelopmentServicesReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkspaceRoot,
        [Parameter(Mandatory = $true)]
        [object]$State
    )

    try {
        $apiPort = [int]$State.api.port
        $boardPort = [int]$State.board.port
    }
    catch {
        return $false
    }

    if ($apiPort -lt 1 -or $apiPort -gt 65535 -or
        $boardPort -lt 1 -or $boardPort -gt 65535 -or
        $apiPort -eq $boardPort) {
        return $false
    }

    $services = @(
        @{ Port = $apiPort; Url = "http://127.0.0.1:$apiPort/health" }
        @{ Port = $boardPort; Url = "http://127.0.0.1:$boardPort" }
    )
    foreach ($service in $services) {
        $listenerIds = @(
            Get-WorkspaceListeningProcessIds `
                -WorkspaceRoot $WorkspaceRoot `
                -Port $service.Port
        )
        if ($listenerIds.Count -ne 1 -or
            -not (Test-HttpEndpointReady -Url $service.Url)) {
            return $false
        }
    }

    return $true
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
