!macro NSIS_HOOK_PREINSTALL
  ; Harbor (#419): force-close any running sidecars (mpv, ffmpeg, ffprobe, yt-dlp, stremio-server) so their
  ; .exe files aren't locked when we overwrite them during an install / update / reinstall.
  ; Path-scoped to $INSTDIR so a user's OWN mpv/ffmpeg/yt-dlp running elsewhere is never touched (no regressions),
  ; and the main app exe (Harbor.exe / JL Media Vision.exe) is left out so Tauri's own running-app close handling stays in charge of the main window.
  nsExec::Exec `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -like '$INSTDIR\*' -and $$_.Name -ne 'Harbor.exe' -and $$_.Name -ne 'JL Media Vision.exe' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"`
  Pop $0
  ; Fallback for the uniquely-named server sidecar in case PowerShell is unavailable on the machine.
  ; Wildcard matches both stremio-server.exe and the triple-suffixed stremio-server-<triple>.exe; /T kills children.
  nsExec::Exec 'taskkill /F /T /FI "IMAGENAME eq stremio-server*"'
  Pop $0
  nsExec::Exec 'taskkill /F /T /IM stremio-server.exe'
  Pop $0
  Sleep 1000
!macroend
