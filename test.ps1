param(
  [switch]$SmokeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-NodeCommand {
  $command = Get-Command node -ErrorAction SilentlyContinue

  if ($command) {
    return $command.Source
  }

  $fallback = "C:\Program Files\nodejs\node.exe"

  if (Test-Path $fallback) {
    return $fallback
  }

  throw "node não encontrado. Execute scripts/setup.ps1 depois de instalar Node.js."
}

$node = Get-NodeCommand

& $node tools/validate.mjs

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($SmokeOnly) {
  exit 0
}

& $node .\node_modules\@playwright\test\cli.js test
