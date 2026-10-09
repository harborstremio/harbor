import { useEffect, useState } from "react";
import { readSourceAlerts, SOURCE_ALERT_PREFIX, subscribeSourceAlerts, type SourceAlertState } from "@/lib/games/source-alerts";

const read = (profile: string) => {
  try { return { profile, ...readSourceAlerts(profile), error: false }; }
  catch { return { profile, watches: [], notices: [], error: true }; }
};
export function useSourceAlerts(profile: string) {
  const [state, setState] = useState<SourceAlertState & { profile: string; error: boolean }>(() => read(profile));
  useEffect(() => {
    const reload = () => setState(read(profile));
    reload();
    const stop = subscribeSourceAlerts(changed => { if (changed === profile) reload(); });
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === SOURCE_ALERT_PREFIX + profile) reload(); };
    window.addEventListener("storage", storage);
    return () => { stop(); window.removeEventListener("storage", storage); };
  }, [profile]);
  return state.profile === profile ? state : read(profile);
}
