export const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
export const ANILIST_AUTHORIZE_URL = "https://anilist.co/api/v2/oauth/authorize";
export const ANILIST_PIN_REDIRECT_URI = "https://anilist.co/api/v2/oauth/pin";
export const ANILIST_DEVELOPER_URL = "https://anilist.co/settings/developer";
export const ANILIST_CLIENT_ID = (import.meta.env.VITE_ANILIST_CLIENT_ID as string | undefined) || "43455";
export const ANILIST_CLIENT_SECRET = (import.meta.env.VITE_ANILIST_CLIENT_SECRET as string | undefined) || "hxpmRtTNPq7u6cq7qqKXUBnd5r9TDpwkp3y5LLQv";
export const ANILIST_TOKEN_EXCHANGE_URL = (import.meta.env.VITE_ANILIST_TOKEN_URL as string | undefined) || "https://anilist.co/api/v2/oauth/token";
