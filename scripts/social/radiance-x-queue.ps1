[CmdletBinding()]
param(
    [ValidateSet('Status', 'Stage', 'Record', 'ClearPending', 'BaselineExisting')]
    [string]$Mode = 'Status',

    [string]$PostUrl
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$loreRoot = Join-Path $repoRoot 'assets\lore\starlight-era'
$ledgerPath = Join-Path $loreRoot 'x-publish-ledger.json'

function Read-Ledger {
    if (-not (Test-Path -LiteralPath $ledgerPath)) {
        throw "Missing ledger: $ledgerPath"
    }

    return Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
}

function Write-Ledger {
    param([Parameter(Mandatory)]$Ledger)

    $json = $Ledger | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText(
        $ledgerPath,
        $json + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Get-AssetRecord {
    param([Parameter(Mandatory)][System.IO.FileInfo]$File)

    [pscustomobject]@{
        file = $File.Name
        path = $File.FullName
        sha256 = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = $File.Length
    }
}

function Get-QueueState {
    param([Parameter(Mandatory)]$Ledger)

    $postedHashes = @{}
    foreach ($post in @($Ledger.posts)) {
        foreach ($asset in @($post.assets)) {
            $postedHashes[$asset.sha256] = $true
        }
    }

    $pendingHashes = @{}
    if ($null -ne $Ledger.pendingBatch) {
        foreach ($asset in @($Ledger.pendingBatch.assets)) {
            $pendingHashes[$asset.sha256] = $true
        }
    }

    $excludedHashes = @{}
    foreach ($asset in @($Ledger.excludedAssets)) {
        $excludedHashes[$asset.sha256] = $true
    }

    $assets = Get-ChildItem -LiteralPath $loreRoot -File -Filter '*.png' |
        Sort-Object Name |
        ForEach-Object { Get-AssetRecord -File $_ }

    $unposted = @(
        $assets | Where-Object {
            -not $postedHashes.ContainsKey($_.sha256) -and
            -not $pendingHashes.ContainsKey($_.sha256) -and
            -not $excludedHashes.ContainsKey($_.sha256)
        }
    )

    [pscustomobject]@{
        account = $Ledger.account
        batchSize = [int]$Ledger.batchSize
        totalAssets = $assets.Count
        postedAssets = $postedHashes.Count
        excludedAssets = $excludedHashes.Count
        pendingBatch = $Ledger.pendingBatch
        readyBatch = @($unposted | Select-Object -First ([int]$Ledger.batchSize))
        waitingAssets = $unposted.Count
        ledger = $ledgerPath
    }
}

$ledger = Read-Ledger
$state = Get-QueueState -Ledger $ledger

switch ($Mode) {
    'Status' {
        $state | ConvertTo-Json -Depth 8
        break
    }

    'Stage' {
        if ($null -ne $ledger.pendingBatch) {
            throw 'A batch is already staged and awaiting confirmation.'
        }

        if ($state.readyBatch.Count -lt $ledger.batchSize) {
            throw "Only $($state.readyBatch.Count) unposted assets are ready; $($ledger.batchSize) are required."
        }

        $ledger.pendingBatch = [pscustomobject]@{
            stagedAt = (Get-Date).ToUniversalTime().ToString('o')
            status = 'awaiting_confirmation'
            assets = @(
                $state.readyBatch |
                    Select-Object file, sha256, bytes
            )
        }
        Write-Ledger -Ledger $ledger
        (Get-QueueState -Ledger (Read-Ledger)) | ConvertTo-Json -Depth 8
        break
    }

    'Record' {
        if ($null -eq $ledger.pendingBatch) {
            throw 'There is no staged batch to record.'
        }
        if ([string]::IsNullOrWhiteSpace($PostUrl)) {
            throw 'Record mode requires -PostUrl.'
        }
        if ($PostUrl -notmatch '^https://x\.com/RaymondRR777/status/\d+$') {
            throw "Unexpected post URL for $($ledger.account): $PostUrl"
        }

        $ledger.posts = @($ledger.posts) + [pscustomobject]@{
            postedAt = (Get-Date).ToUniversalTime().ToString('o')
            postUrl = $PostUrl
            assets = @($ledger.pendingBatch.assets)
        }
        $ledger.pendingBatch = $null
        Write-Ledger -Ledger $ledger
        (Get-QueueState -Ledger (Read-Ledger)) | ConvertTo-Json -Depth 8
        break
    }

    'ClearPending' {
        $ledger.pendingBatch = $null
        Write-Ledger -Ledger $ledger
        (Get-QueueState -Ledger (Read-Ledger)) | ConvertTo-Json -Depth 8
        break
    }

    'BaselineExisting' {
        $knownHashes = @{}
        foreach ($post in @($ledger.posts)) {
            foreach ($asset in @($post.assets)) {
                $knownHashes[$asset.sha256] = $true
            }
        }
        foreach ($asset in @($ledger.excludedAssets)) {
            $knownHashes[$asset.sha256] = $true
        }

        $baseline = @(
            Get-ChildItem -LiteralPath $loreRoot -File -Filter '*.png' |
                Sort-Object Name |
                ForEach-Object { Get-AssetRecord -File $_ } |
                Where-Object { -not $knownHashes.ContainsKey($_.sha256) } |
                ForEach-Object {
                    [pscustomobject]@{
                        file = $_.file
                        sha256 = $_.sha256
                        bytes = $_.bytes
                        reason = 'historical_archive_reconciled_against_x_media'
                        excludedAt = (Get-Date).ToUniversalTime().ToString('o')
                    }
                }
        )

        $ledger.excludedAssets = @($ledger.excludedAssets) + $baseline
        $ledger.pendingBatch = $null
        Write-Ledger -Ledger $ledger
        (Get-QueueState -Ledger (Read-Ledger)) | ConvertTo-Json -Depth 8
        break
    }
}
