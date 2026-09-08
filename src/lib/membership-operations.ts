export type MembershipProfile = {
  activeId: string | null;
  settingsLinked: boolean;
};

export type MembershipFailureReason =
  | "profile-changed"
  | "missing-source"
  | "missing-destination"
  | "missing-item"
  | "destination-full"
  | "invalid-data"
  | "storage-failed"
  | "unsaved-changes";

type MembershipFailure = { status: "error"; reason: MembershipFailureReason };

export type MembershipResult =
  | {
      status: "added" | "already-present" | "moved" | "unchanged" | "removed";
      containerId?: string;
    }
  | MembershipFailure;

export type MoveMembershipRequest = {
  sourceId: string;
  destinationId: string;
  itemId: string;
  profile: MembershipProfile;
};

export type RemoveMembershipRequest = Omit<MoveMembershipRequest, "destinationId">;

type StoredItem = { id: string; [key: string]: unknown };
type StoredContainer = {
  id: string;
  name: string;
  items: StoredItem[];
  updatedAt?: number;
  [key: string]: unknown;
};

type MembershipOperation =
  | ({ mode: "move" } & MoveMembershipRequest)
  | ({ mode: "remove" } & RemoveMembershipRequest)
  | {
      mode: "create";
      container: StoredContainer;
      maxContainers: number;
      profile: MembershipProfile;
      source?: { handle: string; id: string };
    }
  | {
      mode: "add";
      destinationId: string;
      item: StoredItem;
      profile?: MembershipProfile;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isMembershipItemInput(value: unknown): boolean {
  return (
    isRecord(value) &&
    isId(value.id) &&
    ["type", "name", "poster"].every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    )
  );
}

function readMembershipProfile(): { profile: MembershipProfile } | MembershipFailure {
  let raw: string | null;
  try {
    raw = localStorage.getItem("harbor.profiles.v1");
  } catch {
    return { status: "error", reason: "storage-failed" };
  }
  if (!raw) return { profile: { activeId: null, settingsLinked: true } };
  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return { status: "error", reason: "invalid-data" };
  }
  if (!isRecord(state)) return { status: "error", reason: "invalid-data" };
  if (state.activeId == null) return { profile: { activeId: null, settingsLinked: true } };
  if (!isId(state.activeId) || !Array.isArray(state.profiles)) {
    return { status: "error", reason: "invalid-data" };
  }
  const matches = state.profiles.filter(
    (profile) => isRecord(profile) && profile.id === state.activeId,
  );
  if (matches.length !== 1) return { status: "error", reason: "invalid-data" };
  const active = matches[0] as Record<string, unknown>;
  if (active.settingsLinked != null && typeof active.settingsLinked !== "boolean") {
    return { status: "error", reason: "invalid-data" };
  }
  return { profile: { activeId: state.activeId, settingsLinked: active.settingsLinked !== false } };
}

/** Capture when opening an action menu so a later profile switch invalidates its actions. */
export function captureMembershipProfile(): MembershipProfile | null {
  const current = readMembershipProfile();
  return "profile" in current ? current.profile : null;
}

export function isMembershipProfileCurrent(profile: MembershipProfile | null): boolean {
  const current = captureMembershipProfile();
  return (
    !!profile &&
    !!current &&
    profile.activeId === current.activeId &&
    profile.settingsLinked === current.settingsLinked
  );
}

function isSnapshot(value: unknown): value is StoredContainer[] {
  if (!Array.isArray(value)) return false;
  const containerIds = new Set<string>();
  for (const container of value) {
    if (
      !isRecord(container) ||
      !isId(container.id) ||
      typeof container.name !== "string" ||
      !Array.isArray(container.items) ||
      containerIds.has(container.id)
    ) {
      return false;
    }
    containerIds.add(container.id);
    const itemIds = new Set<string>();
    for (const item of container.items) {
      if (!isRecord(item) || !isId(item.id) || itemIds.has(item.id)) return false;
      itemIds.add(item.id);
    }
  }
  return true;
}

/** Preserve the complete fresh snapshot and commit membership changes with one atomic storage write. */
export function performMembershipOperation(
  baseKey: "harbor.collections.v1" | "harbor.customlists.v1",
  maxItems: number,
  operation: MembershipOperation,
): MembershipResult {
  const expected = operation.profile;
  const itemId =
    operation.mode === "add"
      ? operation.item.id
      : operation.mode === "create"
        ? operation.container.items[0]?.id
        : operation.itemId;
  if (
    ((operation.mode === "add" || operation.mode === "move") && !isId(operation.destinationId)) ||
    (operation.mode !== "create" && !isId(itemId)) ||
    ((operation.mode === "move" || operation.mode === "remove") &&
      (!isId(operation.sourceId) || !expected))
  ) {
    return { status: "error", reason: "invalid-data" };
  }
  const snapshot = readMembershipSnapshot(baseKey, expected);
  if ("status" in snapshot) return snapshot;
  const { key, containers } = snapshot;
  if (operation.mode === "create") {
    if (operation.source) {
      const source = operation.source;
      const existing = containers.find(
        (container) => container.sourceHandle === source.handle && container.sourceId === source.id,
      );
      if (existing) return { status: "already-present", containerId: existing.id };
    }
    if (
      !expected ||
      !isSnapshot([operation.container]) ||
      containers.some((container) => container.id === operation.container.id)
    ) {
      return { status: "error", reason: "invalid-data" };
    }
    if (containers.length >= operation.maxContainers)
      return { status: "error", reason: "destination-full" };
    containers.push(operation.container);
    return persistMembershipSnapshot(key, containers, "added");
  }
  const source =
    operation.mode !== "add"
      ? containers.find((container) => container.id === operation.sourceId)
      : undefined;
  if (operation.mode !== "add" && !source) {
    return { status: "error", reason: "missing-source" };
  }
  if (operation.mode === "remove" && source) {
    if (!source.items.some((item) => item.id === itemId)) {
      return { status: "error", reason: "missing-item" };
    }
    source.items = source.items.filter((item) => item.id !== itemId);
    source.updatedAt = Date.now();
    return persistMembershipSnapshot(key, containers, "removed");
  }
  if (operation.mode === "remove") return { status: "error", reason: "missing-source" };
  const destination = containers.find((container) => container.id === operation.destinationId);
  if (!destination) return { status: "error", reason: "missing-destination" };
  const sourceItem = source?.items.find((item) => item.id === itemId);
  const item = operation.mode === "add" ? operation.item : sourceItem;
  if (!item) return { status: "error", reason: "missing-item" };
  if (source === destination) return { status: "unchanged" };
  const alreadyPresent = destination.items.some((item) => item.id === itemId);
  if (alreadyPresent && operation.mode === "add") return { status: "already-present" };
  if (!alreadyPresent && destination.items.length >= maxItems) {
    return { status: "error", reason: "destination-full" };
  }
  const now = Date.now();
  if (!alreadyPresent) {
    destination.items.push(item);
    destination.updatedAt = now;
  }
  if (source) {
    source.items = source.items.filter((item) => item.id !== itemId);
    source.updatedAt = now;
  }
  return persistMembershipSnapshot(key, containers, operation.mode === "add" ? "added" : "moved");
}

export function readMembershipSnapshot(
  baseKey: "harbor.collections.v1" | "harbor.customlists.v1",
  expected?: MembershipProfile,
): { key: string; containers: StoredContainer[]; raw: string | null } | MembershipFailure {
  const current = readMembershipProfile();
  if (!("profile" in current)) return current;
  if (
    expected &&
    (expected.activeId !== current.profile.activeId ||
      expected.settingsLinked !== current.profile.settingsLinked)
  ) {
    return { status: "error", reason: "profile-changed" };
  }
  const key =
    current.profile.activeId && !current.profile.settingsLinked
      ? `${baseKey.replace(/\.v1$/, "")}.${current.profile.activeId}`
      : baseKey;
  let raw: string | null;
  try {
    raw = localStorage.getItem(key) ?? (key !== baseKey ? localStorage.getItem(baseKey) : null);
  } catch {
    return { status: "error", reason: "storage-failed" };
  }
  let containers: unknown;
  try {
    containers = raw == null ? [] : JSON.parse(raw);
  } catch {
    return { status: "error", reason: "invalid-data" };
  }
  // Display readers normalize data and drop metadata. Mutations preserve the complete snapshot.
  if (!isSnapshot(containers)) return { status: "error", reason: "invalid-data" };
  return { key, containers, raw };
}

function persistMembershipSnapshot(
  key: string,
  containers: StoredContainer[],
  status: "added" | "moved" | "removed",
): MembershipResult {
  try {
    // Recovery may remove the previous value before retrying. Membership transactions must not.
    localStorage.setItem(key, JSON.stringify(containers));
  } catch {
    return { status: "error", reason: "storage-failed" };
  }
  return { status };
}

export function performContainerOperation(
  baseKey: "harbor.collections.v1" | "harbor.customlists.v1",
  profile: MembershipProfile,
  operation: { id: string; expectedRaw?: string | null } & (
    | { mode: "delete" }
    | { mode: "rename"; name: string }
  ),
): MembershipResult | { status: "updated" } {
  const snapshot = readMembershipSnapshot(baseKey, profile);
  if ("status" in snapshot) return snapshot;
  if (operation.expectedRaw !== undefined && operation.expectedRaw !== snapshot.raw)
    return { status: "error", reason: "unsaved-changes" };
  const container = snapshot.containers.find((entry) => entry.id === operation.id);
  if (!container) return { status: "error", reason: "missing-source" };
  if (operation.mode === "rename") {
    if (typeof operation.name !== "string" || !operation.name.trim())
      return { status: "error", reason: "invalid-data" };
    if (container.name === operation.name) return { status: "unchanged" };
    container.name = operation.name;
    container.updatedAt = Date.now();
  } else snapshot.containers = snapshot.containers.filter((entry) => entry.id !== operation.id);
  const saved = persistMembershipSnapshot(snapshot.key, snapshot.containers, "removed");
  return saved.status === "error"
    ? saved
    : { status: operation.mode === "rename" ? "updated" : "removed" };
}
