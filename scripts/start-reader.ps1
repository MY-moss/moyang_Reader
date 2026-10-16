param([switch]$Check)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'release'
$latest = Get-Content -LiteralPath (Join-Path $releaseRoot 'latest.json') -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($latest.directory) -or $latest.directory -in @('.', '..') -or $latest.directory -match '[/\\:]') {
    throw 'Invalid release pointer. Run npm run package again.'
}
$directory = Join-Path $releaseRoot $latest.directory
$executable = Join-Path $directory 'Moyang Reader Next.exe'
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'Current application is missing. Run npm run package first.' }
if ($Check) { Write-Output $executable; exit 0 }
Start-Process -FilePath $executable -WorkingDirectory $directory
