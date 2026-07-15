export const MAL_AUTHORIZE_URL = "https://myanimelist.net/v1/oauth2/authorize";
export const MAL_API_BASE = "https://api.myanimelist.net/v2";
export const MAL_REDIRECT_URI = (import.meta.env.VITE_MAL_REDIRECT_URI as string | undefined) || "http://localhost:1420/mal/";
export const MAL_DEVELOPER_URL = "https://myanimelist.net/apiconfig";
export const MAL_CLIENT_ID = "879be1ac300dc70611e5c828fec7bc18";
export const MAL_TOKEN_PROXY = (import.meta.env.VITE_MAL_TOKEN_PROXY as string | undefined) || "";
