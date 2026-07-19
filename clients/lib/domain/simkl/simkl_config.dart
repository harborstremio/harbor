/// Simkl API + PIN-auth configuration, transcribed from the web `simkl/config.ts`.
library;

const simklApiBase = 'https://api.simkl.com';
const simklClientId =
    '9609ef0a6051b6fdcf3290fd962fd65e0f8e969c942555410cffd37afca91997';
const simklVerifyUrl = 'https://simkl.com/pin';
const simklAppName = 'harbor';
const simklAppVersion = '0.9.75';

/// A movie/episode is "watched" for local purposes past this ratio…
const simklWatchedRatio = 0.8;
