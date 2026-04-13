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
& $node tools/serve.mjs
