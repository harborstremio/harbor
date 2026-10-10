import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import {
  athleteRecordUrl,
  cachedAthleteRecord,
  isEspnAthleteId,
  parseAthleteRecord,
  rememberAthleteRecord,
} from "@/lib/sports/athlete-record";

export function useAthleteRecord(athleteId: string | undefined, enabled: boolean): string {
  const id = isEspnAthleteId(athleteId) ? athleteId : "";
  const [record, setRecord] = useState(() => (id ? (cachedAthleteRecord(id) ?? "") : ""));
  useEffect(() => {
    if (!id || !enabled) {
      setRecord("");
      return;
    }
    const held = cachedAthleteRecord(id);
    if (held !== undefined) {
      setRecord(held);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await safeFetch(athleteRecordUrl(id), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]),
        });
        if (!response.ok) return;
        const parsed = parseAthleteRecord(await response.json());
        rememberAthleteRecord(id, parsed);
        if (!controller.signal.aborted) setRecord(parsed);
      } catch {
        /* A missing record just leaves the name standing on its own. */
      }
    })();
    return () => controller.abort();
  }, [id, enabled]);
  return record;
}
