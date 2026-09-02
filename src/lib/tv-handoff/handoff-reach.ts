import { invoke } from "@tauri-apps/api/core";

/**
 * Can a phone actually get here. Two independent facts, both of which fail
 * silently today: whether Harbor knows this machine's LAN address, and whether
 * the web server is genuinely bound to a port.
 */

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Serving toggled on but still not bound after this long: the port is taken. */
export const SERVE_GRACE_MS = 6000;
export const SERVE_POLL_MS = 3000;
/** While waiting for the bind, the QR appearing late reads as a dead button. */
export const SERVE_FAST_POLL_MS = 400;
export const LAN_RETRY_MS = 5000;
/** Already have an address: watch for it changing under a live code, cheaply. */
export const LAN_RECHECK_MS = 15_000;

/**
 * `lan_ip` is registered in the desktop invoke handler and absent from the
 * Android TV one, so this resolves null on a TV build. That is the reason the
 * phone panel must always keep a focusable way past it.
 */
export async function readLanHost(): Promise<string | null> {
  if (!hasTauri) return null;
  try {
    const ip = await invoke<string | null>("lan_ip");
    return ip && ip.length > 0 ? ip : null;
  } catch {
    return null;
  }
}

/**
 * Ground truth rather than the settings flag: settings swallows the
 * `web_serve_start` rejection, so a taken port looks like a toggle that did
 * nothing.
 */
export async function readServeRunning(): Promise<boolean> {
  if (!hasTauri) return false;
  try {
    return await invoke<boolean>("web_serve_status");
  } catch {
    return false;
  }
}
