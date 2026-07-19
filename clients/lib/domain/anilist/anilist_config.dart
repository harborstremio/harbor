/// AniList OAuth endpoints and client id. Ported from `anilist/config.ts`. The
/// token exchange runs through Harbor's proxy so the client secret stays
/// server-side.
const anilistAuthorizeUrl = 'https://anilist.co/api/v2/oauth/authorize';
const anilistPinRedirectUri = 'https://anilist.co/api/v2/oauth/pin';
const anilistDeveloperUrl = 'https://anilist.co/settings/developer';
const anilistClientId = '42941';
const anilistTokenExchangeUrl = 'https://bugs.harbor.site/v1/anilist/token';

/// AniList access tokens are issued for one year. Ported from
/// `DEFAULT_TOKEN_TTL_SEC`.
const anilistTokenTtl = Duration(seconds: 31536000);
