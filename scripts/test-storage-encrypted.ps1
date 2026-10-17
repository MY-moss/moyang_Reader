$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$fixtureBase=Join-Path $project '.local'
$fixture=Join-Path $fixtureBase ('storage-encrypted-' + [Guid]::NewGuid().ToString())
$encryptedBase=[Environment]::GetFolderPath('LocalApplicationData')
$encrypted=Join-Path $encryptedBase ('MoyangMigrationTest-' + [Guid]::NewGuid().ToString())
function Assert-True($condition,$message) { if(-not $condition){throw $message} }
try {
    [IO.Directory]::CreateDirectory($fixture) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $encrypted 'empty')) | Out-Null
    $file=Join-Path $encrypted 'saved-draft.bin'
    $bytes=[byte[]]@(0,1,2,3,128,200,255)
    [IO.File]::WriteAllBytes($file,$bytes)
    try { [IO.File]::Encrypt($file) }
    catch { Write-Output 'EFS migration fixture skipped: Windows file encryption unavailable.'; exit 0 }
    Assert-True (((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::Encrypted) -ne 0) 'Source fixture must really be encrypted'
    $modified=[IO.File]::GetLastWriteTimeUtc($file)
    $helper=Join-Path $fixture 'migrate-storage.ps1'
    [IO.File]::WriteAllText($helper,[IO.File]::ReadAllText((Join-Path $project 'src-tauri/src/migrate-storage.ps1')),(New-Object Text.UTF8Encoding($true)))
    $target=Join-Path $fixture 'destination'
    $plan=@{target=$target;items=@(@{key='data';label='Encrypted draft';logical=$encrypted;physical=$encrypted});pid=2147483647;executable=(Join-Path $fixture 'no-autostart.exe')}
    $planFile=Join-Path $fixture 'plan.json'
    [IO.File]::WriteAllText($planFile,($plan|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
    & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile
    $result=Get-Content -LiteralPath (Join-Path $fixture 'result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($result.status -eq 'complete') ('EFS migration must succeed: ' + $result.message)
    Assert-True ([Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) -eq [Convert]::ToBase64String($bytes)) 'Encrypted draft bytes must survive'
    Assert-True ([IO.File]::GetLastWriteTimeUtc($file) -eq $modified) 'Last-write time must survive'
    Assert-True ((Get-Item -LiteralPath $encrypted -Force).LinkType -eq 'Junction') 'Stable source path must point to destination'
    Assert-True (Test-Path -LiteralPath (Join-Path $encrypted 'empty') -PathType Container) 'Empty folder must survive'
    Write-Output 'EFS migration passed: encrypted source, exact binary bytes, original path, modification time and empty directory.'
} finally {
    $resolvedEncrypted=[IO.Path]::GetFullPath($encrypted)
    if((Split-Path -Parent $resolvedEncrypted) -ne [IO.Path]::GetFullPath($encryptedBase) -or (Split-Path -Leaf $resolvedEncrypted) -notlike 'MoyangMigrationTest-*'){throw 'Unexpected encrypted fixture path'}
    if(Test-Path -LiteralPath $encrypted) {
        if((Get-Item -LiteralPath $encrypted -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){[IO.Directory]::Delete($encrypted,$false)}
        else { Remove-Item -LiteralPath $encrypted -Recurse -Force }
    }
    $resolvedFixture=[IO.Path]::GetFullPath($fixture)
    if((Split-Path -Parent $resolvedFixture) -ne [IO.Path]::GetFullPath($fixtureBase) -or (Split-Path -Leaf $resolvedFixture) -notlike 'storage-encrypted-*'){throw 'Unexpected target fixture path'}
    if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
