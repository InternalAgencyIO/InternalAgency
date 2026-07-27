# Radiance social publishing

Radiance images are published to X in four-image, caption-free batches from the
original PNG files. The queue uses SHA-256 hashes, so renaming an image cannot
make it post twice.

Check the queue:

```powershell
.\scripts\social\radiance-x-queue.ps1
```

Stage the next four images:

```powershell
.\scripts\social\radiance-x-queue.ps1 -Mode Stage
```

After the confirmed X post succeeds, record its URL:

```powershell
.\scripts\social\radiance-x-queue.ps1 -Mode Record -PostUrl "https://x.com/RaymondRR777/status/..."
```

The public ledger lives beside the lore collection at
`assets/lore/starlight-era/x-publish-ledger.json`.
