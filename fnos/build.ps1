<#
.SYNOPSIS
  Build the native fnOS package (hares-panel.fpk).

.DESCRIPTION
  Bundles the Linux Node runtime + SPA + server, then calls fnpack.
  Requires Node.js 24 and fnpack from https://developer.fnnas.com/docs/cli/fnpack/.
  Pass -Fnpack with the path to fnpack.exe when it is not on PATH.

.EXAMPLE
  .\build.cmd -Fnpack "D:\Program Files\fnpack\fnpack.exe"
#>
param(
  [string]$Fnpack = ""
)

# Paths like D:\Program Files\fnpack\fnpack.exe split on spaces if unquoted.
if ($args.Count -gt 0) {
  $Fnpack = ((@($Fnpack) + $args) | Where-Object { $_ }) -join " "
}

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-Fnpack {
  param([string]$Requested)
  $candidates = @()
  if ($Requested) { $candidates += $Requested }
  if ($env:FNPACK) { $candidates += $env:FNPACK }
  $candidates += @(
    (Join-Path $root "fnpack.exe"),
    (Join-Path $root "fnpack"),
    "fnpack.exe",
    "fnpack"
  )
  foreach ($c in $candidates) {
    if (-not $c) { continue }
    if (Test-Path -LiteralPath $c) { return (Resolve-Path -LiteralPath $c).Path }
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }
  }
  throw "fnpack not found. Download fnpack.exe from https://developer.fnnas.com/docs/cli/fnpack/ then run: .\build.cmd -Fnpack <path-to-fnpack.exe>  Or put fnpack.exe on PATH or in this fnos folder."
}

Push-Location $root
try {
  New-Item -ItemType Directory -Force -Path "wizard" | Out-Null
  & node ../scripts/prepare-fnos.mjs
  if ($LASTEXITCODE -ne 0) { throw "prepare-fnos failed with exit code $LASTEXITCODE" }
  $fnpackExe = Resolve-Fnpack -Requested $Fnpack
  & $fnpackExe build
  if ($LASTEXITCODE -ne 0) { throw "fnpack build failed with exit code $LASTEXITCODE" }
  $fpk = Join-Path $root "hares-panel.fpk"
  if (-not (Test-Path -LiteralPath $fpk)) { throw "hares-panel.fpk was not generated" }
  Write-Host "built: $fpk"
} finally {
  Pop-Location
}
