/// MyAnimeList OAuth endpoints and client id. Ported from `mal/config.ts`. The
/// token exchange runs through Harbor's proxy so the client secret stays
/// server-side.
const malAuthorizeUrl = 'https://myanimelist.net/v1/oauth2/authorize';
const malApiBase = 'https://api.myanimelist.net/v2';
const malRedirectUri = 'https://harbor.site/mal/';
const malDeveloperUrl = 'https://myanimelist.net/apiconfig';
const malClientId = '879be1ac300dc70611e5c828fec7bc18';
const malTokenProxy = 'https://harbor.site/api/mal/token';
