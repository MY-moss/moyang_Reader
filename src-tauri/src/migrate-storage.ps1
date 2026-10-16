param([Parameter(Mandatory=$true)][string]$PlanPath, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$resultFile = Join-Path $PSScriptRoot 'result.json'
$swaps = New-Object Collections.ArrayList
function Full-Path([string]$Value) {
    if (-not [IO.Path]::IsPathRooted($Value) -or $Value.StartsWith('\\')) { throw '请选择本机磁盘上的文件夹。' }
    return [IO.Path]::GetFullPath($Value).TrimEnd('\')
}
function Inside([string]$Child, [string]$Parent) {
    return $Child.Equals($Parent, [StringComparison]::OrdinalIgnoreCase) -or $Child.StartsWith($Parent + '\', [StringComparison]::OrdinalIgnoreCase)
}
function Files([string]$Root) {
    foreach ($entry in Get-ChildItem -LiteralPath $Root -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            if (-not $entry.PSIsContainer -or $entry.LinkType -ne 'Junction') { throw "不支持的文件链接：$($entry.FullName)" }
            continue
        }
        if ($entry.PSIsContainer) { Files $entry.FullName } else { $entry }
    }
}
function Directories([string]$Root) {
    foreach($entry in Get-ChildItem -LiteralPath $Root -Directory -Force) {
        $entry
        if(-not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { Directories $entry.FullName }
    }
}
function Remove-TreeWithoutFollowingLinks([string]$Root) {
    foreach($entry in Get-ChildItem -LiteralPath $Root -Force) {
        if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($entry.FullName,$false) }
        elseif($entry.PSIsContainer) { Remove-TreeWithoutFollowingLinks $entry.FullName }
        else { Remove-Item -LiteralPath $entry.FullName -Force }
    }
    [IO.Directory]::Delete($Root,$false)
}
function Write-Report($Value) {
    [IO.File]::WriteAllText($resultFile, ($Value | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
}
function Hash-File([string]$File) {
    $stream=[IO.File]::OpenRead($File); $sha=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($stream)) }
    finally { $stream.Dispose(); $sha.Dispose() }
}
function Check-Plan {
    $target = Full-Path $plan.target
    if (Test-Path -LiteralPath $target) { throw "目标子目录已存在。请选择另一空目录，已有内容不会被覆盖：$target" }
    $drive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($target))
    if (-not $drive.IsReady -or $drive.DriveType -eq 'Network') { throw '目标磁盘不可用，请连接本机磁盘后重试。' }
    [long]$bytes = 0
    $sources = @()
    foreach ($item in $plan.items) {
        $source = Full-Path $item.physical
        if ((Inside $target $source) -or (Inside $source $target)) { throw '新位置不能位于原数据目录内，也不能包含原数据目录。' }
        if ($item.key -notin @('data','config','cache','ai','models','webview','snapshots','chat','extensions','downloads')) { throw '迁移分类无效。' }
        if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "原数据目录不可用：$source" }
        $attributes = (Get-Item -LiteralPath $source -Force).Attributes
        if ($attributes -band [IO.FileAttributes]::ReparsePoint) { throw '原位置已变化，请在应用中重新检查迁移计划。' }
        foreach ($other in $sources) { if ((Inside $source $other) -or (Inside $other $source)) { throw '迁移目录重叠，请重新检查。' } }
        $sources += $source
        foreach ($file in @(Files $source)) { $bytes += $file.Length }
        foreach($link in @(Directories $source | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })) {
            $linkTarget=Full-Path ([string]$link.Target[0])
            if($link.LinkType -ne 'Junction' -or (Inside $linkTarget $source) -or (Inside $target $linkTarget) -or (Inside $linkTarget $target)) { throw '目录链接与迁移路径重叠，请单独选择其存储分类。' }
        }
    }
    if ($sources.Count -eq 0) { throw '没有可迁移的数据。' }
    if ($drive.AvailableFreeSpace -lt ($bytes + 64MB)) { throw '目标磁盘空间不足，请至少预留数据大小加 64 MB。' }
    # Do not terminate user-owned Agent or model processes. Block only matching data/runtime users.
    $blocked = @()
    foreach ($process in @(Get-CimInstance Win32_Process -Filter "Name = 'moyang-ai-mcp.exe' OR Name = 'ollama.exe'")) {
        $line = ([string]$process.CommandLine).Replace('/','\').ToLowerInvariant()
        foreach ($item in $plan.items) {
            $logical = ([string]$item.logical).Replace('/','\').ToLowerInvariant()
            $physical = ([string]$item.physical).Replace('/','\').ToLowerInvariant()
            if ($line.Contains($logical) -or $line.Contains($physical) -or (($item.key -eq 'models' -or $plan.moves_models) -and $process.Name -eq 'ollama.exe')) {
                $blocked += "$($process.Name)（$($process.ProcessId)）"; break
            }
        }
    }
    if ($blocked.Count) { throw ('请先关闭正在使用这些数据的 Agent 连接或本地模型服务，再检查：' + (($blocked | Select-Object -Unique) -join '、')) }
    # Test write + junction support without moving user data.
    $probe = Join-Path (Split-Path -Parent $target) ('.moyang-probe-' + [Guid]::NewGuid().ToString())
    [IO.Directory]::CreateDirectory($probe) | Out-Null
    try {
        foreach ($source in $sources) {
            $link = Join-Path (Split-Path -Parent $source) ('.moyang-link-test-' + [Guid]::NewGuid().ToString())
            try { New-Item -ItemType Junction -Path $link -Target $probe -ErrorAction Stop | Out-Null }
            finally { if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link, $false) } }
        }
    } finally { [IO.Directory]::Delete($probe, $false) }
    return @{ bytes=$bytes; free=$drive.AvailableFreeSpace }
}
try {
    if ($CheckOnly) { Check-Plan | ConvertTo-Json -Compress; exit 0 }
    Write-Report @{status='running'; message='正在等待应用退出'; target=$plan.target}
    $oldProcess = Get-Process -Id $plan.pid -ErrorAction SilentlyContinue
    if ($oldProcess -and -not $oldProcess.WaitForExit(60000)) { throw '应用尚未退出，未开始迁移。' }
    Start-Sleep -Seconds 2
    Check-Plan | Out-Null
    $target = Full-Path $plan.target
    [IO.Directory]::CreateDirectory($target) | Out-Null
    foreach ($item in $plan.items) {
        $source = Full-Path $item.physical
        $destination = Join-Path $target $item.key
        [IO.Directory]::CreateDirectory($destination) | Out-Null
        Write-Report @{status='running'; message=('正在复制和校验：' + $item.label); target=$target}
        # Include empty folders, but never follow links in the source tree.
        foreach ($directory in @(Directories $source)) {
            $copyDirectory=Join-Path $destination $directory.FullName.Substring($source.Length + 1)
            if ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                New-Item -ItemType Junction -Path $copyDirectory -Target ([string]$directory.Target[0]) -ErrorAction Stop | Out-Null
            } else { [IO.Directory]::CreateDirectory($copyDirectory) | Out-Null }
        }
        $before = @(Files $source)
        foreach ($file in $before) {
            $copy = Join-Path $destination $file.FullName.Substring($source.Length + 1)
            Copy-Item -LiteralPath $file.FullName -Destination $copy -Force
            if ((Hash-File $file.FullName) -ne (Hash-File $copy)) { throw "文件校验失败：$($file.Name)" }
        }
        if (@(Files $source).Count -ne $before.Count) { throw '迁移期间原目录发生变化，原数据已保留。' }
    }
    # All directories are copied before any original location is switched.
    foreach ($item in $plan.items) {
        $source = Full-Path $item.physical
        $destination = Join-Path $target $item.key
        foreach ($file in @(Files $source)) {
            $copy = Join-Path $destination $file.FullName.Substring($source.Length + 1)
            if ((Hash-File $file.FullName) -ne (Hash-File $copy)) { throw '源文件发生变化，原数据已保留。' }
        }
        foreach($link in @(Directories $source | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })) {
            $copied=Get-Item -LiteralPath (Join-Path $destination $link.FullName.Substring($source.Length+1)) -Force
            if($copied.LinkType -ne 'Junction' -or ([string]$copied.Target[0]) -ne ([string]$link.Target[0])) { throw '迁移期间目录链接发生变化，原数据已保留。' }
        }
        $backup = $source + '.moyang-moved-' + [Guid]::NewGuid().ToString()
        [IO.Directory]::Move($source, $backup)
        $swap = @{ source=$source; backup=$backup; destination=$destination; linked=$false }
        [void]$swaps.Add($swap)
        New-Item -ItemType Junction -Path $source -Target $destination -ErrorAction Stop | Out-Null
        $swap.linked = $true
    }
    # All stable paths now lead to verified copies. Remove only the exact renamed originals.
    $retained = @()
    foreach ($swap in $swaps) {
        $backup = Full-Path $swap.backup
        if ((Split-Path -Parent $backup) -ne (Split-Path -Parent $swap.source) -or -not $backup.StartsWith($swap.source + '.moyang-moved-')) { throw '旧副本清理路径无效。' }
        try { Remove-TreeWithoutFollowingLinks $backup } catch { $retained += $backup }
    }
    Write-Report @{status='complete'; message='迁移完成。旧路径保留为目录链接，数据实际保存在新位置。'; target=$target; retained=$retained; at=[DateTime]::UtcNow.ToString('o')}
} catch {
    $failure = $_.Exception.Message
    if ($CheckOnly) { [Console]::Error.WriteLine($failure); exit 1 }
    for ($index=$swaps.Count-1; $index -ge 0; $index--) {
        $swap=$swaps[$index]
        if (Test-Path -LiteralPath $swap.backup) {
            if ($swap.linked) { [IO.Directory]::Delete($swap.source, $false) }
            [IO.Directory]::Move($swap.backup, $swap.source)
        }
    }
    Write-Report @{status='error'; message=$failure; target=$plan.target; at=[DateTime]::UtcNow.ToString('o')}
    # Partial copied destination is left for inspection; original data remains authoritative.
}
if (Test-Path -LiteralPath $plan.executable -PathType Leaf) {
    Start-Process -FilePath $plan.executable -WorkingDirectory (Split-Path -Parent $plan.executable) -WindowStyle Hidden
}
