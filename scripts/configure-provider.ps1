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

Write-Host "ArchResearch API setup"
Write-Host "Provider: OpenAI-compatible API"
Write-Host "ArchResearch automatically discovers a compatible model from the upstream model list."
Write-Host "The endpoint and Key are tested with small potentially billable structured-output probes before saving."

$baseUrl = (Read-Host "Enter API base URL").Trim()
$secureKey = Read-Host "Enter API Key (input is hidden)" -AsSecureString
$bstr = [IntPtr]::Zero
$plainKey = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $python
    $startInfo.ArgumentList.Add("-m")
    $startInfo.ArgumentList.Add("archresearch_api.provider_setup")
    $startInfo.ArgumentList.Add("--data-dir")
    $startInfo.ArgumentList.Add(".archresearch")
    $startInfo.ArgumentList.Add("--base-url")
    $startInfo.ArgumentList.Add($baseUrl)
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
        Write-Host "Key saved in Windows Credential Manager. Restart ArchResearch to apply it."
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
