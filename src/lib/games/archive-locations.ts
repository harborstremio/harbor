import type { ArchiveJob } from "./archives";
import type { SetupLocation, SetupLocations } from "./setup-locations";
import { setupParent } from "./setup-locations";
import { setupPath } from "./setup";

export type ArchiveLocation = SetupLocation & { kind: "recent" | "source" | "drive" };

export function recentArchiveParent(jobs: ArchiveJob[], profile: string) {
  const latest = jobs.filter(job => job.profile === profile && job.status === "complete" && job.destination)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return latest ? setupParent(latest.destination) : "";
}

/** These are existing parent folders; extraction creates the named child only after confirmation. */
export function archiveLocationChoices(recent: SetupLocations, source: SetupLocations): ArchiveLocation[] {
  const seen = new Set<string>();
  return [
    ...(recent.selected ? [{ ...recent.selected, kind: "recent" as const }] : []),
    ...(source.selected ? [{ ...source.selected, kind: "source" as const }] : []),
    ...recent.drives.map(drive => ({ ...drive, kind: "drive" as const })),
    ...source.drives.map(drive => ({ ...drive, kind: "drive" as const })),
  ].filter(location => {
    const key = location.path === "/" ? "/" : setupPath(location.path);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
