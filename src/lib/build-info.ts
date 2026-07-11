export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export const IS_BETA_BUILD: boolean = typeof __IS_BETA_BUILD__ !== "undefined" ? __IS_BETA_BUILD__ : true;
