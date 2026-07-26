param(
    [Parameter(Mandatory = $true)]
    [string]$Pnpm,
    [Parameter(Mandatory = $true)]
    [string]$Workspace,
    [Parameter(Mandatory = $true)]
    [int]$BoardPort,
    [Parameter(Mandatory = $true)]
    [int]$ApiPort
)

$ErrorActionPreference = "Stop"
$env:ARCHRESEARCH_API_ORIGIN = "http://127.0.0.1:$ApiPort"
$env:ARCHRESEARCH_BOARD_PORT = "$BoardPort"
$env:VITE_ARCHRESEARCH_BROWSER_ENDPOINT = "ws://127.0.0.1:$ApiPort/v1/browser"
Set-Location -LiteralPath $Workspace
& $Pnpm --dir apps/board run dev -- --host 127.0.0.1 --port $BoardPort
