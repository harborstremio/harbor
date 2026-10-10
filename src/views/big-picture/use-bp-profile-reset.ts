import { useEffect } from "react";
import { goBigPictureTab } from "@/lib/big-picture";
import { clearBpPositions } from "./bp-restore";
import { forceBpMeta } from "./bp-focus-meta";
import { resetBpViewState } from "./bp-view-state";

/**
 * A switch that changes only the storage namespace is the shape of bug that reads as
 * "the switch silently failed". These three used to run on Big Picture EXIT and nowhere
 * else, so handing the remote over on a detail page left the next person looking at the
 * previous profile's page, with their remembered row positions and their focused meta
 * still in place. Home is the only route guaranteed to exist for whoever just arrived.
 */
export function useBpProfileReset(): void {
  useEffect(() => {
    const onSwitch = () => {
      forceBpMeta(null);
      resetBpViewState();
      clearBpPositions();
      goBigPictureTab("home");
    };
    window.addEventListener("harbor:active-profile-changed", onSwitch);
    return () => window.removeEventListener("harbor:active-profile-changed", onSwitch);
  }, []);
}
