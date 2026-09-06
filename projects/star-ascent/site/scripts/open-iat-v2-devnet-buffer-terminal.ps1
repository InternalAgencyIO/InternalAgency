$Host.UI.RawUI.WindowTitle = "IAT DEVNET - OLD UPLOAD PATH DISABLED"
Write-Host ""
Write-Host "HOLD: THIS OLD UPLOAD PATH IS DISABLED." -ForegroundColor Red
Write-Host ""
Write-Host "This helper executes no shell, accesses no key, and sends no transaction." -ForegroundColor Yellow
Write-Host "Use only the attended commands printed in launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md after returning to Codex." -ForegroundColor Green
Write-Host "Nothing was signed or broadcast by this disabled helper."
Read-Host "Press Enter to close"
exit 1
