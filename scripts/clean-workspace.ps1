param([switch]$Apply, [string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
if ((Get-Item -LiteralPath $projectRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Refusing a linked workspace.'
}
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'moyang-reader-next') { throw 'Not a Moyang Reader workspace.' }

$targets = @('dist', 'coverage', 'test-results', 'playwright-report', 'logs') | ForEach-Object {
    Join-Path $projectRoot $_
}
$targets += @(Get-ChildItem -LiteralPath $projectRoot -File -Filter '*.log' | ForEach-Object FullName)
$existing = @()
# Validate the entire plan before deleting anything. Never follow a junction.
foreach ($target in $targets) {
    $absolute = [IO.Path]::GetFullPath($target)
    if (-not $absolute.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Target outside workspace: $absolute"
    }
    if (-not (Test-Path -LiteralPath $absolute)) { continue }
    $item = Get-Item -LiteralPath $absolute -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked target: $absolute" }
    if ($item.PSIsContainer) {
        $linked = Get-ChildItem -LiteralPath $absolute -Recurse -Force -ErrorAction Stop |
            Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
            Select-Object -First 1
        if ($linked) { throw "Linked entry: $($linked.FullName)" }
    }
    $existing += $absolute
}
foreach ($target in $existing) {
    if ($Apply) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
        Write-Output "Removed: $target"
    } else { Write-Output "Would remove: $target" }
}
if (-not $Apply) { Write-Output 'Preview only. Use npm run clean to apply.' }
