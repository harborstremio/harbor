type CwProfile = {
  id: string;
  isPrimary?: boolean;
  shareStremioWith?: string | null;
  settingsLinked?: boolean;
};

let rosterRaw: string | null = null;
let roster: { activeId?: string; profiles?: CwProfile[] } | null = null;
let settingsRaw: string | null = null;
let privateEnabled = false;

/** Read the playback owner without pulling React providers into persistence modules. */
export function cwProfileScope(ownerId?: string): {
  profileId: string;
  sharedId: string;
  private: boolean;
} {
  try {
    const rawRoster = localStorage.getItem("harbor.profiles.v1");
    if (rawRoster !== rosterRaw) {
      roster = JSON.parse(rawRoster ?? "null");
      rosterRaw = rawRoster;
    }
    const profiles = Array.isArray(roster?.profiles) ? roster.profiles : [];
    const active =
      profiles.find((p) => p.id === (ownerId ?? roster?.activeId)) ??
      profiles.find((p) => p.isPrimary);
    const profileId = ownerId ?? active?.id ?? "";
    const source = (p: CwProfile) =>
      profiles.some((other) => other.id === p.shareStremioWith) ? p.shareStremioWith! : p.id;
    const sharedId = active ? source(active) : profileId;
    const shares = profiles.some((p) => p.id !== profileId && source(p) === sharedId);
    const settingsKey =
      active?.settingsLinked === false ? `harbor.settings.${profileId}` : "harbor.settings.shared";
    const rawSettings = localStorage.getItem(settingsKey) ??
      localStorage.getItem("harbor.settings.shared") ?? localStorage.getItem("harbor.settings");
    // Every CW card reads this scope; only parse the settings/roster blobs when changed.
    if (rawSettings !== settingsRaw) {
      privateEnabled = !!JSON.parse(rawSettings ?? "null")?.cwPerProfile;
      settingsRaw = rawSettings;
    }
    return { profileId, sharedId, private: privateEnabled && shares };
  } catch {
    return { profileId: ownerId ?? "", sharedId: ownerId ?? "", private: false };
  }
}

export function privateCwProfileId(): string | null {
  const scope = cwProfileScope();
  return scope.private ? scope.profileId : null;
}
