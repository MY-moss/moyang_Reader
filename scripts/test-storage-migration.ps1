param([Parameter(Mandatory=$true)][string]$McpExecutable)
$ErrorActionPreference='Stop'
# Keep native stdin/stdout independent of the host console code page and BOM.
$OutputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
# Native JSON input must be UTF-8 without BOM, regardless of the runner defaults.
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$fixtureBase=Join-Path (Split-Path -Parent $PSScriptRoot) '.local'
$fixture=Join-Path $fixtureBase ('storage-fixture-' + [Guid]::NewGuid().ToString())
[IO.Directory]::CreateDirectory($fixture) | Out-Null
function Assert-True($value,$message) { if(-not $value){throw $message} }
$aliases=New-Object Collections.ArrayList
try {
    $helper=Join-Path $fixture 'migrate-storage.ps1'
    $source=Join-Path (Split-Path -Parent $PSScriptRoot) 'src-tauri/src/migrate-storage.ps1'
    [IO.File]::WriteAllText($helper,[IO.File]::ReadAllText($source),(New-Object Text.UTF8Encoding($true)))
    $data=Join-Path $fixture 'original-data'; $cache=Join-Path $fixture 'original-webview'
    [IO.Directory]::CreateDirectory((Join-Path $data 'empty-folder')) | Out-Null
    [IO.Directory]::CreateDirectory($cache) | Out-Null
    [IO.File]::WriteAllText((Join-Path $cache 'draft.txt'),'unsent draft')
    $externalModels=Join-Path $fixture 'independent-models'
    [IO.Directory]::CreateDirectory($externalModels) | Out-Null
    [IO.File]::WriteAllText((Join-Path $externalModels 'model-part.bin'),'keep separately chosen model bytes')
    $modelAlias=Join-Path $data 'models'
    New-Item -ItemType Junction -Path $modelAlias -Target $externalModels | Out-Null
    [void]$aliases.Add($modelAlias)
    $ai=Join-Path $data 'ai-space'
    $chineseTitle = -join @([char]0x8FC1,[char]0x79FB,[char]0x9A8C,[char]0x8BC1)
    $raw=@{kind='memory';title=$chineseTitle;body='preserve resource and revision';source='isolated fixture';project='storage-test'} | ConvertTo-Json -Compress
    $saved=$raw | & $McpExecutable --data-dir $ai --request save | ConvertFrom-Json
    Assert-True ($LASTEXITCODE -eq 0 -and $saved.id) 'Fixture memory must be saved'
    Assert-True ($saved.title -eq $chineseTitle) 'Chinese text must survive native stdin and stdout'
    $recordId=$saved.id
    $planFile=Join-Path $fixture 'plan.json'
    $items=@(@{key='data';label='Data';logical=$data;physical=$data},@{key='cache';label='Webview';logical=$cache;physical=$cache})
    [void]$aliases.Add($data); [void]$aliases.Add($cache)
    foreach($round in @(1,2)) {
        $target=Join-Path $fixture ('destination-' + $round)
        $plan=@{target=$target;items=$items;pid=2147483647;executable=(Join-Path $env:SystemRoot 'System32/whoami.exe')}
        [IO.File]::WriteAllText($planFile,($plan|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
        & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile -CheckOnly | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) 'Preflight must succeed'
        & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile
        $report=Get-Content -LiteralPath (Join-Path $fixture 'result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($report.status -eq 'complete') ('Migration should succeed: ' + $report.message)
        $receipt=('{"id":"'+$recordId+'"}') | & $McpExecutable --data-dir $ai --request get | ConvertFrom-Json
        Assert-True ($LASTEXITCODE -eq 0 -and $receipt.id -eq $recordId) 'Existing MCP data path must still resolve the original record'
        Assert-True ($receipt.title -eq $chineseTitle) 'Chinese content must survive migration'
        Assert-True ((Get-Content -LiteralPath (Join-Path $cache 'draft.txt') -Raw) -eq 'unsent draft') 'Browser drafts must survive'
        Assert-True (Test-Path -LiteralPath (Join-Path $data 'empty-folder') -PathType Container) 'Empty folders must survive'
        Assert-True ((Get-Content -LiteralPath (Join-Path $externalModels 'model-part.bin') -Raw) -eq 'keep separately chosen model bytes') 'Parent migration and cleanup must not delete independently stored model data'
        Assert-True ((Get-Item -LiteralPath (Join-Path $target 'data/models') -Force).LinkType -eq 'Junction') 'Parent migration must preserve the independent storage junction'
        [void]$aliases.Add((Join-Path $target 'data/models'))
        foreach($item in $items) { $item.physical=Join-Path $target $item.key; [void]$aliases.Add($item.physical) }
    }
    # Occupied destination and nested destination are rejected before modification.
    $ErrorActionPreference='Continue'
    & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile -CheckOnly 2>$null
    $ErrorActionPreference='Stop'
    Assert-True ($LASTEXITCODE -eq 1) 'An occupied destination must be rejected'
    $plan.target=Join-Path $items[0].physical 'nested'; $plan.items=$items
    [IO.File]::WriteAllText($planFile,($plan|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    $ErrorActionPreference='Continue'
    & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile -CheckOnly 2>$null
    $ErrorActionPreference='Stop'
    Assert-True ($LASTEXITCODE -eq 1) 'Nested destinations must be rejected'
    # A locked source causes a clean failure; old logical paths remain readable afterward.
    $plan.target=Join-Path $fixture 'locked-destination'
    [IO.File]::WriteAllText($planFile,($plan|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    $locked=[IO.File]::Open((Join-Path $cache 'draft.txt'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try { & powershell.exe -NoProfile -NonInteractive -File $helper -PlanPath $planFile } finally { $locked.Dispose() }
    $report=Get-Content -LiteralPath (Join-Path $fixture 'result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($report.status -eq 'error') 'A locked source should stop migration'
    Assert-True ((Get-Content -LiteralPath (Join-Path $cache 'draft.txt') -Raw) -eq 'unsent draft') 'Failure must preserve source data'
    Write-Output 'Storage migration passed: two moves, independent model directory, live MCP path, drafts, empty folders, occupied/nested targets and locked-source recovery.'
} finally {
    # Remove each fixture link itself; never recursively traverse a junction during cleanup.
    foreach($alias in $aliases) {
        $resolved=[IO.Path]::GetFullPath($alias)
        if(-not $resolved.StartsWith([IO.Path]::GetFullPath($fixture)+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected fixture alias'}
        if(Test-Path -LiteralPath $alias) {
            if((Get-Item -LiteralPath $alias -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){[IO.Directory]::Delete($alias,$false)}
        }
    }
    if((Split-Path -Parent ([IO.Path]::GetFullPath($fixture))) -ne [IO.Path]::GetFullPath($fixtureBase) -or (Split-Path -Leaf $fixture) -notlike 'storage-fixture-*'){throw 'Unexpected fixture cleanup path'}
    Remove-Item -LiteralPath $fixture -Recurse -Force
}
