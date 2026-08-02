import { APP_VERSION } from "@/lib/build-info";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export const SIMKL_API_BASE = "https://api.simkl.com";
export const SIMKL_CLIENT_ID =
  (import.meta.env.VITE_SIMKL_CLIENT_ID as string | undefined) ||
  "9609ef0a6051b6fdcf3290fd962fd65e0f8e969c942555410cffd37afca91997";
export const SIMKL_VERIFY_URL = "https://simkl.com/pin";
export const WATCHED_RATIO = 0.85;
export const SIMKL_WATCHED_RATIO = 0.8;
export const SIMKL_APP_NAME = "harbor";
export const SIMKL_APP_VERSION = APP_VERSION;
export const SIMKL_USER_AGENT = `Harbor/${APP_VERSION} (+${HARBOR_API_BASE})`;
