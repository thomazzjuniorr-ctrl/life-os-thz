Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-NpmCommand {
  $command = Get-Command npm -ErrorAction SilentlyContinue

  if ($command) {
    return $command.Source
  }

  $fallback = "C:\Program Files\nodejs\npm.cmd"

  if (Test-Path $fallback) {
    return $fallback
  }

  throw "npm não encontrado. Instale Node.js LTS antes de executar o setup."
}

$npm = Get-NpmCommand
& $npm install
