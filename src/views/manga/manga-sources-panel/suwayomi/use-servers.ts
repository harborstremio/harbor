import { useEffect, useState } from "react";
import { activeServer, listServers, subscribeServers } from "./servers-store";
import type { SuwayomiServer } from "./types";

export function useServers(): { servers: SuwayomiServer[]; active: SuwayomiServer | undefined } {
  const [, setTick] = useState(0);
  useEffect(() => subscribeServers(() => setTick((n) => n + 1)), []);
  return { servers: listServers(), active: activeServer() };
}
