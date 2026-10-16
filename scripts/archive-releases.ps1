param([switch]$Apply, [string]$Root = (Split-Path -Parent $PSScriptRoot), [string]$ArchiveRoot)
$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $sha.Dispose() }
}
$project = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
if ((Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).name -ne 'moyang-reader-next') { throw 'Not a Moyang Reader workspace.' }
$release = Join-Path $project 'release'
$latest = Get-Content -LiteralPath (Join-Path $release 'latest.json') -Raw | ConvertFrom-Json
if ($latest.directory -match '[/\\:]' -or $latest.directory -in @('', '.', '..')) { throw 'Invalid current release pointer.' }
if (-not (Test-Path -LiteralPath (Join-Path $release "$($latest.directory)/Moyang Reader Next.exe") -PathType Leaf)) { throw 'Current release is missing.' }
if (-not $ArchiveRoot) { $ArchiveRoot = Join-Path (Split-Path -Parent $project) ((Split-Path -Leaf $project) + ('-' + [char]0x5f52 + [char]0x6863 + '/') + (Get-Date -Format 'yyyy-MM-dd')) }
$archive = [IO.Path]::GetFullPath($ArchiveRoot).TrimEnd('\', '/')
if ($archive -eq $project -or $archive.StartsWith($project + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive must be outside the workspace.' }
function Assert-PlainPath([string]$path) {
    $current = $path
    while ($current) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked path: $current" }
        $current = Split-Path -Parent $current
    }
}
function Get-PlainFiles([string]$directory) {
    Assert-PlainPath $directory
    $entries = @(Get-ChildItem -LiteralPath $directory -Recurse -Force)
    if ($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1) { throw "Linked entry in $directory" }
    @($entries | Where-Object { -not $_.PSIsContainer })
}
Assert-PlainPath $release
Assert-PlainPath $archive
$running = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | ForEach-Object ExecutablePath)
$targets = @(Get-ChildItem -LiteralPath $release -Directory -Force | Where-Object { $_.Name -ne $latest.directory -and $_.Name -ne "publish-$($latest.version)" })
foreach ($item in $targets) {
    $absolute = [IO.Path]::GetFullPath($item.FullName)
    if (-not $absolute.StartsWith($release + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside release directory.' }
    if ($running | Where-Object { $_.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase) }) { throw "Old release is still running: $absolute" }
    $null = Get-PlainFiles $absolute
}
if (-not $Apply) {
    $targets | ForEach-Object { Write-Output "Would archive and remove: $($_.FullName)" }
    Write-Output "Keep: $($latest.directory), publish-$($latest.version). Archive: $archive"
    exit 0
}
New-Item -ItemType Directory -Path $archive -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$modelRoot = Join-Path $project '.local/ollama'
Assert-PlainPath $modelRoot
$modelHashes = @{}
$indexPath = Join-Path $archive 'release-archive-index.json'
$receipts = if (Test-Path -LiteralPath $indexPath) { @(Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json) } else { @() }
foreach ($item in $targets) {
    $files = @(Get-PlainFiles $item.FullName)
    $zipPath = Join-Path $archive ($item.Name + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.zip')
    $manifest = @()
    $zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($item.FullName.Length + 1).Replace('\', '/')
            $hash = (Get-Sha256 $file.FullName)
            $reuse = $null
            if ($relative.StartsWith('ollama/')) {
                $canonical = Join-Path $modelRoot $relative.Substring(7)
                if (Test-Path -LiteralPath $canonical -PathType Leaf) {
                    Assert-PlainPath $canonical
                    if (-not $modelHashes.ContainsKey($canonical)) { $modelHashes[$canonical] = (Get-Sha256 $canonical) }
                    if ($hash -eq $modelHashes[$canonical]) { $reuse = $canonical }
                }
            }
            $manifest += [PSCustomObject]@{path=$relative;bytes=$file.Length;sha256=$hash;reuse=$reuse}
            if (-not $reuse) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Fastest) | Out-Null }
        }
        $entry = $zip.CreateEntry('_archive-manifest.json')
        $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write((@{original=$item.FullName;created=(Get-Date).ToString('o');files=$manifest} | ConvertTo-Json -Depth 5)) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
    # Verify every archived byte, and recheck the source before any removal.
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        if (@(Get-PlainFiles $item.FullName).Count -ne $manifest.Count) { throw 'Source changed while archiving.' }
        foreach ($record in $manifest) {
            if ((Get-Sha256 (Join-Path $item.FullName $record.path)) -ne $record.sha256) { throw 'Source changed while archiving.' }
            if ($record.reuse) {
                if ((Get-Sha256 $record.reuse) -ne $record.sha256) { throw 'Reusable model changed while archiving.' }
            } else {
                $entry = $zip.GetEntry($record.path)
                if (-not $entry -or $entry.Length -ne $record.bytes) { throw "Archive entry mismatch: $($record.path)" }
                $stream = $entry.Open(); $sha = [Security.Cryptography.SHA256]::Create()
                try { $digest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') } finally { $stream.Dispose(); $sha.Dispose() }
                if ($digest -ne $record.sha256) { throw "Archive hash mismatch: $($record.path)" }
            }
        }
    } finally { $zip.Dispose() }
    $absolute = [IO.Path]::GetFullPath($item.FullName)
    if (-not $absolute.StartsWith($release + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Removal outside release directory.' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
    $receipts += [PSCustomObject]@{source=$absolute;archive=$zipPath;files=$manifest.Count;sourceBytes=($files | Measure-Object Length -Sum).Sum;archiveBytes=(Get-Item -LiteralPath $zipPath).Length;sha256=(Get-Sha256 $zipPath)}
    $receipts | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $indexPath -Encoding UTF8
    Write-Output "Archived and verified: $($item.Name)"
}
