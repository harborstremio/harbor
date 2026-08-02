import { HARBOR_MAL_BASE } from "@/lib/config/endpoints";

export const MAL_AUTHORIZE_URL = "https://myanimelist.net/v1/oauth2/authorize";
export const MAL_API_BASE = "https://api.myanimelist.net/v2";
export const MAL_REDIRECT_URI = `${HARBOR_MAL_BASE}/mal/`;
export const MAL_DEVELOPER_URL = "https://myanimelist.net/apiconfig";
export const MAL_CLIENT_ID = "879be1ac300dc70611e5c828fec7bc18";
export const MAL_TOKEN_PROXY = `${HARBOR_MAL_BASE}/api/mal/token`;
