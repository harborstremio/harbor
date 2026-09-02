import { createContext, useContext, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { HANDOFF_STEPS } from "@/lib/tv-handoff/handoff-protocol";
import { useTvHandoff, type TvHandoff } from "@/lib/tv-handoff/use-tv-handoff";
import { useHandoffApply } from "./bp-handoff-apply";

/**
 * The host lives above the steps, not inside the phone screen.
 *
 * `startHandoffHost` is a module singleton that `useTvHandoff` stops on
 * unmount, so hanging it off the phone screen meant one press of Back or
 * Continue invalidated the code the user was mid-scan on. Held here it survives
 * the whole flow, and a delivery that arrives while the TV has moved on to the
 * Stremio screen still lands.
 */
const Ctx = createContext<TvHandoff | null>(null);

export function BpHandoffProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const { settings } = useSettings();
  const apply = useHandoffApply();
  const handoff = useTvHandoff({
    active,
    servingEnabled: settings.serveWebUi || settings.remoteControlEnabled,
    steps: HANDOFF_STEPS,
    onPayload: apply,
  });
  return <Ctx.Provider value={handoff}>{children}</Ctx.Provider>;
}

export function useBpHandoff(): TvHandoff {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBpHandoff outside BpHandoffProvider");
  return v;
}
