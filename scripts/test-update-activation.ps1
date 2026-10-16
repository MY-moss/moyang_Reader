$ErrorActionPreference = 'Stop'
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('moyang-update-activation-' + [Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
function Assert-True($Condition, $Message) { if (-not $Condition) { throw $Message } }
try {
    $oldDirectory = Join-Path $fixtureRoot 'old'
    $goodDirectory = Join-Path $fixtureRoot 'good'
    $badDirectory = Join-Path $fixtureRoot 'bad'
    foreach ($directory in @($oldDirectory, $goodDirectory, $badDirectory)) { New-Item -ItemType Directory -Path $directory | Out-Null }
    Copy-Item -LiteralPath "$env:SystemRoot\System32\whoami.exe" -Destination (Join-Path $oldDirectory 'Moyang Reader Next.exe')
    Copy-Item -LiteralPath "$env:SystemRoot\System32\whoami.exe" -Destination (Join-Path $goodDirectory 'Moyang Reader Next.exe')
    Copy-Item -LiteralPath "$env:SystemRoot\System32\findstr.exe" -Destination (Join-Path $badDirectory 'Moyang Reader Next.exe')
    $helper = Join-Path (Split-Path -Parent $PSScriptRoot) 'src-tauri/src/activate-update.ps1'
    foreach ($directory in @($goodDirectory, $badDirectory)) {
        Copy-Item -LiteralPath $helper -Destination (Join-Path $directory 'activate-update.ps1')
        [IO.File]::WriteAllText((Join-Path $directory 'SHA256.json'), '{"version":"999.0.0"}')
    }
    $pointer = Join-Path $fixtureRoot 'latest.json'
    [IO.File]::WriteAllText($pointer, '{"directory":"old"}')
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'personal-notes.txt'), 'must remain untouched')
    & powershell.exe -NoProfile -NonInteractive -File (Join-Path $goodDirectory 'activate-update.ps1') -OldProcessId 2147483647
    Assert-True ($LASTEXITCODE -eq 0) 'Activation should succeed'
    Assert-True ((Get-Content -LiteralPath $pointer -Raw | ConvertFrom-Json).directory -eq 'good') 'Successful activation must switch the pointer'
    Assert-True ((Get-Content -LiteralPath (Join-Path $fixtureRoot 'previous.json') -Raw | ConvertFrom-Json).directory -eq 'old') 'The original version must remain recoverable'
    & powershell.exe -NoProfile -NonInteractive -File (Join-Path $badDirectory 'activate-update.ps1') -OldProcessId 2147483647
    Assert-True ($LASTEXITCODE -eq 1) 'Failed application should report failure'
    Assert-True ((Get-Content -LiteralPath $pointer -Raw | ConvertFrom-Json).directory -eq 'good') 'Failed activation must roll back to the working version'
    Assert-True ((Get-Content -LiteralPath (Join-Path $fixtureRoot 'personal-notes.txt') -Raw) -eq 'must remain untouched') 'Personal data must be unchanged'
    Write-Output 'Portable activation and rollback passed; personal data preserved.'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
    $tempDirectory = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    if ((Split-Path -Parent $resolvedFixture).TrimEnd('\') -ne $tempDirectory -or (Split-Path -Leaf $resolvedFixture) -notlike 'moyang-update-activation-*') { throw 'Unexpected fixture cleanup path' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
