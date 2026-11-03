<#
.SYNOPSIS
  Build the fnOS package (hares-panel.fpk).

.DESCRIPTION
  Requires fnpack from https://developer.fnnas.com/docs/cli/fnpack/.
  Pass -Fnpack with the path to fnpack.exe when it is not on PATH.

.EXAMPLE
  .\build.ps1 -Fnpack C:\tools\fnpack.exe
#>
param(
  [string]$Fnpack = "fnpack"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
  New-Item -ItemType Directory -Force -Path "wizard" | Out-Null
  & node ../scripts/sync-fnos-version.mjs
  if ($LASTEXITCODE -ne 0) { throw "version sync failed with exit code $LASTEXITCODE" }
  & $Fnpack build
  if ($LASTEXITCODE -ne 0) { throw "fnpack build failed with exit code $LASTEXITCODE" }
  $fpk = Join-Path $root "hares-panel.fpk"
  if (-not (Test-Path -LiteralPath $fpk)) { throw "hares-panel.fpk was not generated" }
  Write-Host "built: $fpk"
} finally {
  Pop-Location
}
