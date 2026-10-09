import { setupInstallFolder, setupPath, type SetupJob } from "./setup";

export type SetupLocation = { path: string; label: string; availableBytes: number | null };
export type SetupLocations = { drives: SetupLocation[]; selected: SetupLocation | null };
export type SetupLocationChoice = SetupLocation & { destination: string; recent: boolean };

export function setupParent(path: string) {
  const clean = path.replace(/^\\\\\?\\/, "").replace(/[\\/]+$/, "");
  const index = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return index < 0 ? "" : index === 0 || index === 2 && /^[a-z]:/i.test(clean) ? clean.slice(0, index + 1) : clean.slice(0, index);
}

export function recentSetupParent(jobs: SetupJob[], profile: string) {
  const job = jobs.filter(item => item.profile === profile && item.destination).sort((a, b) => b.startedAt - a.startedAt)[0];
  return job?.destination ? setupParent(job.destination) : "";
}

/** Suggested folders stay outside the downloaded package; native setup still validates at launch. */
export function setupLocationChoices(locations: SetupLocations, name: string, source: string): SetupLocationChoice[] {
  const seen = new Set<string>(), sourcePath = setupPath(source);
  const within = (path: string, root: string) => path === root || path.startsWith(`${root}${/^[a-z]:|^\\\\/i.test(root) ? "\\" : "/"}`);
  return [...(locations.selected ? [{ ...locations.selected, recent: true }] : []), ...locations.drives.map(drive => ({ ...drive, recent: false }))].flatMap(location => {
    const key = setupPath(location.path), destination = setupInstallFolder(location.path, name), target = setupPath(destination);
    if (seen.has(key) || !destination || within(target, sourcePath) || within(sourcePath, target)) return [];
    seen.add(key);
    return [{ ...location, destination }];
  });
}
