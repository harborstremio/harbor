import { currentJlSession } from "@/lib/jl/account/client";
import { activeProfileId } from "@/lib/active-profile-id";

// Local media never travels with account sync. Stable IDs keep account/profile
// switches from exposing another person's library on this device.
export function downloadOwner(): string {
  return JSON.stringify([currentJlSession()?.userId ?? "local", activeProfileId()]);
}

export function subscribeDownloadOwner(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const storage = (event: StorageEvent) => {
    if (!event.key || ["jl.account.session.v1", "harbor.profiles.v1"].includes(event.key))
      listener();
  };
  window.addEventListener("jl:account-changed", listener);
  window.addEventListener("harbor:active-profile-changed", listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("jl:account-changed", listener);
    window.removeEventListener("harbor:active-profile-changed", listener);
    window.removeEventListener("storage", storage);
  };
}
