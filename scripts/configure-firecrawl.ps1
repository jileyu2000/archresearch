Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
. (Join-Path $PSScriptRoot "dev-common.ps1")

try {
    $python = Resolve-PythonRuntime -WorkspaceRoot $workspaceRoot
}
catch {
    Write-Error "Project runtime not found. Run scripts/setup.ps1 first."
    exit 1
}

Write-Host "ArchResearch Firecrawl setup"
Write-Host "The Key is stored in Windows Credential Manager, not project files."
Write-Host "A fallback scrape may consume one Firecrawl credit when Chrome inspection fails."

$secureKey = Read-Host "Enter Firecrawl API Key (input is hidden)" -AsSecureString
$bstr = [IntPtr]::Zero
$plainKey = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $python
    $startInfo.Arguments = '-m archresearch_api.firecrawl_setup --data-dir ".archresearch"'
    $startInfo.WorkingDirectory = $workspaceRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true

    $process = [Diagnostics.Process]::Start($startInfo)
    $process.StandardInput.WriteLine($plainKey)
    $process.StandardInput.Close()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -eq 0) {
        Write-Host $standardOutput.Trim()
        Write-Host "Restart ArchResearch to apply the Firecrawl configuration."
        exit 0
    }

    if ($standardError) {
        Write-Error $standardError.Trim()
    }
    else {
        Write-Error "Setup failed. Check the project runtime and try again."
    }
    exit $process.ExitCode
}
finally {
    $plainKey = $null
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
