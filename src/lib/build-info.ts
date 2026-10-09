export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export const IS_BETA_BUILD: boolean =
  typeof __IS_BETA_BUILD__ !== "undefined" ? __IS_BETA_BUILD__ : true;

export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "local";

export const BUILD_DATE: string = typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : "";

export const BUILD_LABEL: string = `${APP_VERSION} (${BUILD_ID}${BUILD_DATE ? " " + BUILD_DATE : ""})`;
