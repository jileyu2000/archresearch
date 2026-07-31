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
Write-Host "The endpoint may be a service root or a complete API path; ArchResearch tries common paths on the same host."
Write-Host "ArchResearch fetches the upstream model list; choose a model number instead of typing a model ID."
Write-Host "The endpoint, selected model, and Key are tested with a small potentially billable structured-output probe before saving."

$baseUrl = (Read-Host "Enter API base URL").Trim()
$secureKey = Read-Host "Enter API Key (input is hidden)" -AsSecureString
$bstr = [IntPtr]::Zero
$plainKey = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    $listStartInfo = [Diagnostics.ProcessStartInfo]::new()
    $listStartInfo.FileName = $python
    $listStartInfo.ArgumentList.Add("-m")
    $listStartInfo.ArgumentList.Add("archresearch_api.provider_setup")
    $listStartInfo.ArgumentList.Add("--data-dir")
    $listStartInfo.ArgumentList.Add(".archresearch")
    $listStartInfo.ArgumentList.Add("--base-url")
    $listStartInfo.ArgumentList.Add($baseUrl)
    $listStartInfo.ArgumentList.Add("--list-models")
    $listStartInfo.WorkingDirectory = $workspaceRoot
    $listStartInfo.UseShellExecute = $false
    $listStartInfo.RedirectStandardInput = $true
    $listStartInfo.RedirectStandardOutput = $true
    $listStartInfo.RedirectStandardError = $true
    $listStartInfo.CreateNoWindow = $true

    $listProcess = [Diagnostics.Process]::Start($listStartInfo)
    $listProcess.StandardInput.WriteLine($plainKey)
    $listProcess.StandardInput.Close()
    $modelOutput = $listProcess.StandardOutput.ReadToEnd()
    $modelError = $listProcess.StandardError.ReadToEnd()
    $listProcess.WaitForExit()

    if ($listProcess.ExitCode -ne 0) {
        if ($modelError) {
            Write-Error $modelError.Trim()
        }
        else {
            Write-Error "Unable to fetch models from the upstream API."
        }
        exit $listProcess.ExitCode
    }

    $modelLines = @(
        $modelOutput -split "`r?`n" |
            Where-Object { $_.Trim() }
    )
    if ($modelLines.Count -eq 0) {
        Write-Error "The upstream API returned no usable models."
        exit 1
    }
    Write-Host "Models from upstream:"
    foreach ($modelLine in $modelLines) {
        Write-Host $modelLine
    }
    $modelIndex = -1
    $modelSelection = (Read-Host "Enter model number").Trim()
    if (-not [int]::TryParse($modelSelection, [ref]$modelIndex)) {
        Write-Error "Model number must be an integer."
        exit 2
    }
    if ($modelIndex -lt 0 -or $modelIndex -ge $modelLines.Count) {
        Write-Error "Model number is out of range."
        exit 2
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $python
    $startInfo.ArgumentList.Add("-m")
    $startInfo.ArgumentList.Add("archresearch_api.provider_setup")
    $startInfo.ArgumentList.Add("--data-dir")
    $startInfo.ArgumentList.Add(".archresearch")
    $startInfo.ArgumentList.Add("--base-url")
    $startInfo.ArgumentList.Add($baseUrl)
    $startInfo.ArgumentList.Add("--model-index")
    $startInfo.ArgumentList.Add([string]$modelIndex)
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
