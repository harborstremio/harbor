!macro NSIS_HOOK_PREINSTALL
  ; #419/#812: free Harbor's bundled sidecars so their files aren't locked when we overwrite them during
  ; install/update/reinstall. Native nsis_tauri_utils only (no PowerShell/WMI) so AV/EDR machines can't stall
  ; the installer in its initial phase and silent updates always finish. CurrentUser scope matches installMode.
  nsis_tauri_utils::KillProcessCurrentUser "mpv.exe"
  Pop $0
  nsis_tauri_utils::KillProcessCurrentUser "yt-dlp.exe"
  Pop $0
  nsis_tauri_utils::KillProcessCurrentUser "ffmpeg.exe"
  Pop $0
  nsis_tauri_utils::KillProcessCurrentUser "ffprobe.exe"
  Pop $0
  nsis_tauri_utils::KillProcessCurrentUser "stremio-server.exe"
  Pop $0
  ; Fallback for the triple-suffixed server sidecar. taskkill is a native tool (not a script host), safe for AV; /T kills children.
  nsExec::Exec 'taskkill /F /T /FI "IMAGENAME eq stremio-server*"'
  Pop $0
  Sleep 500
!macroend
