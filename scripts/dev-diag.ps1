$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
Set-Location (Join-Path $PSScriptRoot "..")
pnpm tauri dev
