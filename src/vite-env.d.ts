/// <reference types="vite-plus/client" />

declare const __APP_VERSION__: string;
declare const __IS_BETA_BUILD__: boolean;

interface Window {
  __harborStremioDeeplink?: boolean;
  __harborInstallerOpen?: boolean;
}
