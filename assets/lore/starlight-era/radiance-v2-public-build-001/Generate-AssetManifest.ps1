$ErrorActionPreference = 'Stop'

$assetRoot = $PSScriptRoot
$groupNames = @(
    'primary-originals',
    'primary-v2',
    'external-originals',
    'external-v2'
)

Add-Type -AssemblyName System.Drawing

$assets = foreach ($groupName in $groupNames) {
    $groupPath = Join-Path $assetRoot $groupName

    foreach ($file in Get-ChildItem -LiteralPath $groupPath -Filter '*.png' | Sort-Object Name) {
        $image = [System.Drawing.Image]::FromFile($file.FullName)
        try {
            $width = $image.Width
            $height = $image.Height
        }
        finally {
            $image.Dispose()
        }

        [ordered]@{
            group = $groupName
            file = "$groupName/$($file.Name)"
            bytes = $file.Length
            width = $width
            height = $height
            sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
}

$manifest = [ordered]@{
    schemaVersion = 1
    build = 'radiance-v2-public-build-001'
    assetCount = $assets.Count
    groups = [ordered]@{
        primaryOriginals = @($assets | Where-Object group -eq 'primary-originals').Count
        primaryV2 = @($assets | Where-Object group -eq 'primary-v2').Count
        externalOriginals = @($assets | Where-Object group -eq 'external-originals').Count
        externalV2 = @($assets | Where-Object group -eq 'external-v2').Count
    }
    assets = @($assets)
}

$outputPath = Join-Path $assetRoot 'asset-manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $outputPath -Encoding utf8

Write-Output "Wrote $outputPath with $($assets.Count) assets."
