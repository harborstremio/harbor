import { useSyncExternalStore } from "react";

export type MobileRemoteStyle = "minimal" | "dpad";

const KEY = "harbor.mobile.remotestyle";
const subs = new Set<() => void>();

function read(): MobileRemoteStyle {
  try {
    return localStorage.getItem(KEY) === "minimal" ? "minimal" : "dpad";
  } catch {
    return "dpad";
  }
}

export function setMobileRemoteStyle(style: MobileRemoteStyle): void {
  try {
    localStorage.setItem(KEY, style);
  } catch {
    /* ignore */
  }
  for (const s of subs) s();
}

export function useMobileRemoteStyle(): MobileRemoteStyle {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    read,
    () => "dpad",
  );
}
