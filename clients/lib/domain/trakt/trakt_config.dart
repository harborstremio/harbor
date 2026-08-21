/// Trakt API + OAuth configuration, transcribed from the web `trakt/config.ts`.
/// The token exchange/refresh goes through Harbor's proxy so the OAuth client
/// secret is never shipped in the app.
library;

const traktApiBase = 'https://api.trakt.tv';
const traktApiVersion = '2';
const traktClientId =
    '71ef7ea86333eab031c8830f8200df1f2f16ef9a3335a67470be4950ac80b925';
const traktTokenProxy = 'https://harbor.site/api/trakt/token';
const traktDeviceTokenProxy = 'https://harbor.site/api/trakt/device-token';
const traktVerifyUrl = 'https://trakt.tv/activate';

/// Refresh the access token once it is within two weeks of expiry.
const traktRefreshThresholdSec = 14 * 24 * 60 * 60;

/// The minimum spacing between write calls (rate-limit courtesy).
const traktWriteMinIntervalMs = 1000;
