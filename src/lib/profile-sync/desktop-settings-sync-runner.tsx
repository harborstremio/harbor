import { useEffect } from "react";
import { startProfileSync } from "./scheduler";

/** Desktop syncs account profiles and the settings wire without enabling TV layout adapters. */
export function DesktopSettingsSyncRunner() {
  useEffect(() => startProfileSync(), []);
  return null;
}
