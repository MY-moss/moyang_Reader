param([Parameter(Mandatory=$true)][int]$OldProcessId)
$ErrorActionPreference = 'Stop'
$updateDirectory = [IO.Path]::GetFullPath($PSScriptRoot)
$releaseDirectory = Split-Path -Parent $updateDirectory
$pointerPath = Join-Path $releaseDirectory 'latest.json'
$backupPath = Join-Path $releaseDirectory 'previous.json'
$temporaryPointer = Join-Path $releaseDirectory ('.latest-' + [Guid]::NewGuid().ToString() + '.json')
$executable = Join-Path $updateDirectory 'Moyang Reader Next.exe'
$switched = $false
try {
    $oldProcess = Get-Process -Id $OldProcessId -ErrorAction SilentlyContinue
    if ($oldProcess -and -not $oldProcess.WaitForExit(60000)) { throw 'The previous application did not exit. The active version was kept.' }
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw 'The downloaded application is missing.' }
    $manifest = Get-Content -LiteralPath (Join-Path $updateDirectory 'SHA256.json') -Raw | ConvertFrom-Json
    $next = @{ directory = (Split-Path -Leaf $updateDirectory); version = $manifest.version; updated_at = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json
    [IO.File]::WriteAllText($temporaryPointer, $next, (New-Object Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $pointerPath) { [IO.File]::Replace($temporaryPointer, $pointerPath, $backupPath) }
    else { [IO.File]::Move($temporaryPointer, $pointerPath) }
    $switched = $true
    $started = Start-Process -FilePath $executable -WorkingDirectory $updateDirectory -WindowStyle Hidden -PassThru
    if ($started.WaitForExit(8000) -and $started.ExitCode -ne 0) { throw 'The updated application could not start. Restoring the previous version.' }
    if (Test-Path -LiteralPath (Join-Path $releaseDirectory 'update-error.txt')) { Remove-Item -LiteralPath (Join-Path $releaseDirectory 'update-error.txt') -Force }
} catch {
    [IO.File]::WriteAllText((Join-Path $releaseDirectory 'update-error.txt'), $_.Exception.Message)
    if ($switched -and (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $backupPath -Destination $pointerPath -Force
        $previous = Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json
        if ($previous.directory -and $previous.directory -notmatch '[/\\:]' -and $previous.directory -notin @('.', '..')) {
            $oldExe = Join-Path (Join-Path $releaseDirectory $previous.directory) 'Moyang Reader Next.exe'
            if (Test-Path -LiteralPath $oldExe) { Start-Process -FilePath $oldExe -WindowStyle Hidden }
        }
    } elseif ($switched) {
        Remove-Item -LiteralPath $pointerPath -Force
        $origin = Get-Content -LiteralPath (Join-Path $updateDirectory 'online-update.json') -Raw | ConvertFrom-Json
        if (Test-Path -LiteralPath $origin.previous_exe -PathType Leaf) { Start-Process -FilePath $origin.previous_exe -WindowStyle Hidden }
    }
    exit 1
}
