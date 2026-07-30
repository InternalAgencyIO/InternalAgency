@echo off
title IAT BUFFER REPAIR - ONE CLICK DEVNET ONLY
echo.
echo IAT V2 DEVNET IN-PLACE BUFFER REPAIR
echo ONE CLICK CONFIRMATION: REPAIR-BUFFER
echo.
wsl.exe -d Ubuntu-24.04 -- env IAT_REPAIR_CONFIRM=REPAIR-BUFFER bash -lc "cd /mnt/c/Users/A/Documents/Codex/2026-07-29/i/work/iat-deploy-0a6ee81 && bash scripts/repair-iat-v2-devnet-buffer.sh"
echo.
if errorlevel 1 (
  echo REPAIR STOPPED. RETURN TO CODEX WITH THE ERROR ABOVE.
) else (
  echo REPAIR COMPLETE. RETURN TO CODEX.
)
pause
