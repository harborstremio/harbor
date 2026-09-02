import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { HiddenTabs } from "./lockable-tabs";
import type { ContentFilters } from "./settings";
import { isRemovedBuiltinAvatar } from "./avatars/catalog";
import { deleteProfileBgImage } from "./theme-storage";
// Concrete modules, not the barrel: it re-exports ProfileSyncRunner, and pulling the
// whole sync layer in from the profile provider is how a cycle gets built by accident.
import { configureRosterStore } from "./profile-sync/roster-store";
import { noteProfileDeleted } from "./profile-sync/roster-section";
import { refuseProfileSelect } from "./profile-sync/profile-lock";
import type { LocalProfileLike } from "./profile-sync/types";

export const PROFILE_COLORS = [
  "#7dd3fc",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#fb923c",
  "#fbbf24",
  "#a3e635",
  "#34d399",
  "#22d3ee",
] as const;

export type ProfileColor = string;

export type KidConfig = {
  age: number;
  curfewMinutes: number | null;
  parentPinHash: string | null;
};

export const DEFAULT_KID: KidConfig = { age: 7, curfewMinutes: null, parentPinHash: null };

// Every namespaced key a profile owns. Kept as one list because deleteProfile and the
// sync roster apply both purge, and a key that only one of them knows about is a leak
// that outlives the profile.
const PROFILE_KEY_PREFIXES = [
  "harbor.auth.",
  "harbor.theme-session.",
  "harbor.localcw.v1.",
  "harbor.favorites.v1.",
  "harbor.charfavorites.v1.",
  "harbor.mangafav.v1.",
  "harbor.mangaread.v1.",
  "harbor.localwatchlist.v1.",
  "harbor.settings.",
  "harbor.trakt.session.v1.",
  "harbor.simkl.session.v1.",
  "harbor.anilist.session.v1.",
  "harbor.mal.session.v1.",
  "harbor.simkl.cache.v2.",
  "harbor.anilist.synced.v1.",
  "harbor.mal.synced.v1.",
  "harbor.moviewatched.v1.",
  "harbor.watchedFlag.v1.",
  "harbor.manualwatched.v1.",
  "harbor.manualunwatched.v1.",
  "harbor.manualwatched.meta.v1.",
  "harbor.manualwatched.dismissed.v1.",
  "harbor.manualunwatched.at.v1.",
  "harbor.manualwatched.fromremote.v1.",
  "harbor.watchevents.v1.",
  "harbor.playback-history.v1.",
  "harbor.watchlist.v1.",
  "harbor.watchlist.aggregate.v1.",
  "harbor.installed-addons.",
  "harbor.addons.disabled.",
  "harbor.stremio.freshwatched.v1.",
];

function purgeProfileStorage(id: string): void {
  try {
    for (const prefix of PROFILE_KEY_PREFIXES) localStorage.removeItem(`${prefix}${id}`);
  } catch {
    /* ignore */
  }
}

/**
 * The wire carries no secrets and no shareStremioWith, so those come off the profile
 * being replaced rather than being dropped. A parentPinHash lost here would silently
 * unlock a kid profile on the device that adopted the roster.
 */
function adoptProfile(
  next: LocalProfileLike,
  prev: Profile | undefined,
  fallbackColor: ProfileColor,
): Profile {
  return {
    id: next.id,
    name: next.name,
    avatar: next.avatar,
    color: next.color || prev?.color || fallbackColor,
    isPrimary: next.isPrimary,
    shareStremioWith: prev?.shareStremioWith ?? null,
    passwordHash: next.passwordHash ?? prev?.passwordHash ?? null,
    hideContent: (next.hideContent as ContentFilters | null) ?? null,
    lockedTabs: (next.lockedTabs as HiddenTabs | null) ?? null,
    kid: next.kid
      ? {
          age: next.kid.age,
          curfewMinutes: next.kid.curfewMinutes,
          parentPinHash: next.kid.parentPinHash ?? prev?.kid?.parentPinHash ?? null,
        }
      : null,
    settingsLinked: next.settingsLinked !== false,
    createdAt: next.createdAt,
  };
}

export type Profile = {
  id: string;
  name: string;
  avatar: string | null;
  color: ProfileColor;
  isPrimary: boolean;
  shareStremioWith: string | null;
  passwordHash: string | null;
  hideContent: ContentFilters | null;
  lockedTabs: HiddenTabs | null;
  kid: KidConfig | null;
  settingsLinked?: boolean;
  createdAt: number;
};

type ProfilesState = {
  profiles: Profile[];
  activeId: string | null;
};

export type PickerView =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; profileId: string }
  | { kind: "unlock"; profileId: string };

type ProfilesValue = {
  profiles: Profile[];
  activeId: string | null;
  activeProfile: Profile | null;
  pickerOpen: boolean;
  pickerView: PickerView;
  openPicker: (view?: PickerView) => void;
  setPickerView: (view: PickerView) => void;
  closePicker: () => void;
  /** False when the profile is locked and this call did not prove the PIN. */
  selectProfile: (id: string, opts?: { unlocked?: boolean }) => boolean;
  sessionUnlockedIds: Set<string>;
  createProfile: (input: {
    name: string;
    avatar?: string | null;
    color: ProfileColor;
    kid?: KidConfig | null;
  }) => Profile;
  updateProfile: (id: string, patch: Partial<Omit<Profile, "id" | "createdAt" | "isPrimary">>) => void;
  deleteProfile: (id: string) => void;
  setPrimary: (id: string) => void;
};

const STORAGE_KEY = "harbor.profiles.v1";
const TOGETHER_NAME_KEY = "harbor.together.name";
const SETTINGS_KEY = "harbor.settings";
const SHARED_SETTINGS_KEY = "harbor.settings.shared";
const LEGACY_PARENTAL_KEY = "harbor.parental";

function readLaunchSettingsRaw(): string | null {
  try {
    return localStorage.getItem(SHARED_SETTINGS_KEY) ?? localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

function readLegacyParental(): { hiddenTabs: HiddenTabs | null; hadPin: boolean } {
  try {
    const raw = localStorage.getItem(LEGACY_PARENTAL_KEY);
    if (!raw) return { hiddenTabs: null, hadPin: false };
    const parsed = JSON.parse(raw) as { hiddenTabs?: HiddenTabs; pinHash?: string | null };
    const hidden = parsed.hiddenTabs ?? null;
    const hadAny = !!hidden && Object.values(hidden).some(Boolean);
    return {
      hiddenTabs: hadAny ? hidden : null,
      hadPin: typeof parsed.pinHash === "string" && parsed.pinHash.length > 0,
    };
  } catch {
    return { hiddenTabs: null, hadPin: false };
  }
}

function generateGuestName(): string {
  return `Guest ${1000 + Math.floor(Math.random() * 9000)}`;
}

const PLACEHOLDER_NAMES = new Set(["Me", "You", "Profile"]);

export function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_NAMES.has(trimmed)) return true;
  return /^Guest \d+$/.test(trimmed);
}

function defaultPrimaryName(): string {
  try {
    const existing = localStorage.getItem(TOGETHER_NAME_KEY)?.trim();
    if (existing && !isPlaceholderName(existing)) return existing;
  } catch {
    return generateGuestName();
  }
  return generateGuestName();
}

function readSettingsIdentity(): { color: string | null; avatar: string | null } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { color: null, avatar: null };
    const parsed = JSON.parse(raw) as { harborColor?: unknown; harborAvatar?: unknown };
    const color =
      typeof parsed.harborColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.harborColor)
        ? parsed.harborColor
        : null;
    const avatar =
      typeof parsed.harborAvatar === "string" && parsed.harborAvatar.length > 0
        ? parsed.harborAvatar
        : null;
    return { color, avatar };
  } catch {
    return { color: null, avatar: null };
  }
}

type ProfilePromptInterval = "launch" | "15m" | "30m" | "never";
function readProfilePromptInterval(): ProfilePromptInterval {
  try {
    const raw = readLaunchSettingsRaw();
    if (!raw) return "launch";
    const parsed = JSON.parse(raw) as { profilePromptInterval?: unknown; skipProfileScreen?: unknown };
    const v = parsed.profilePromptInterval;
    if (v === "launch" || v === "15m" || v === "30m" || v === "never") return v;
    return parsed.skipProfileScreen === true ? "never" : "launch";
  } catch {
    return "launch";
  }
}
function intervalMinutes(i: ProfilePromptInterval): number {
  return i === "15m" ? 15 : i === "30m" ? 30 : 0;
}
function readDefaultProfileId(): string {
  try {
    const raw = readLaunchSettingsRaw();
    if (!raw) return "";
    const v = (JSON.parse(raw) as { defaultProfileId?: unknown }).defaultProfileId;
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}
function launchDefault(profiles: Profile[]): Profile | null {
  const id = readDefaultProfileId();
  if (!id) return null;
  const p = profiles.find((x) => x.id === id);
  return p && !p.passwordHash ? p : null;
}
const LAST_SELECT_KEY = "harbor.profile.lastSelectAt";
function readLastProfileSelectAt(): number {
  try {
    return Number(localStorage.getItem(LAST_SELECT_KEY)) || 0;
  } catch {
    return 0;
  }
}
function markProfileSelectedNow(): void {
  try {
    localStorage.setItem(LAST_SELECT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Module-level on purpose: sessionStorage can survive across app launches in the webview, which suppressed this prompt.
let pickerPromptShownThisRun = false;

export function readActiveProfileIdentity(): {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
} | null {
  try {
    const { profiles, activeId } = readState();
    if (!profiles.length) return null;
    const active =
      profiles.find((p) => p.id === activeId) ?? profiles.find((p) => p.isPrimary) ?? profiles[0];
    return active
      ? { id: active.id, name: active.name, avatar: active.avatar, color: `${active.color}` }
      : null;
  } catch {
    return null;
  }
}

export function readAllProfilesIdentity(): Array<{
  id: string;
  name: string;
  avatar: string | null;
  color: string;
}> {
  try {
    return readState().profiles.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: `${p.color}`,
    }));
  } catch {
    return [];
  }
}

function readState(): ProfilesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profiles: [], activeId: null };
    const parsed = JSON.parse(raw) as ProfilesState;
    if (!parsed || !Array.isArray(parsed.profiles)) {
      return { profiles: [], activeId: null };
    }
    const primary = parsed.profiles.find((p) => p.isPrimary);
    const primaryId = primary?.id ?? null;
    const fallbackName = defaultPrimaryName();
    const identity = readSettingsIdentity();
    const legacyParental = readLegacyParental();
    const migrated = parsed.profiles.map((p) => {
      const next = { ...p };
      if (typeof p.shareStremioWith === "undefined") {
        next.shareStremioWith = p.isPrimary ? null : primaryId;
      }
      if (typeof p.passwordHash === "undefined") {
        next.passwordHash = null;
      }
      if (typeof p.hideContent === "undefined") {
        next.hideContent = null;
      }
      if (typeof p.lockedTabs === "undefined") {
        next.lockedTabs = p.isPrimary ? legacyParental.hiddenTabs : null;
      }
      if (typeof p.kid === "undefined" || p.kid == null) {
        next.kid = null;
      } else {
        next.kid = {
          age: p.kid.age ?? 7,
          curfewMinutes: p.kid.curfewMinutes ?? null,
          parentPinHash: p.kid.parentPinHash ?? null,
        };
      }
      if (p.isPrimary) {
        if (isPlaceholderName(p.name)) next.name = fallbackName;
        if (identity.color) next.color = identity.color;
        if (p.avatar == null && identity.avatar != null && !identity.avatar.startsWith("/kids/avatars/")) {
          next.avatar = identity.avatar;
        }
      }
      if (next.kid == null && typeof next.avatar === "string" && next.avatar.startsWith("/kids/avatars/")) {
        next.avatar = null;
      }
      if (isRemovedBuiltinAvatar(next.avatar)) {
        next.avatar = null;
      }
      return next;
    });
    return { profiles: migrated, activeId: parsed.activeId };
  } catch {
    return { profiles: [], activeId: null };
  }
}

function writeState(state: ProfilesState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

function pickColor(existing: Profile[]): ProfileColor {
  const used = new Set(existing.map((p) => p.color));
  const free = PROFILE_COLORS.find((c) => !used.has(c));
  return free ?? PROFILE_COLORS[existing.length % PROFILE_COLORS.length];
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function migrateLegacyStremioAuth(profiles: Profile[]): void {
  try {
    if (localStorage.getItem("harbor.auth.migrated.v1")) return;
    const primary = profiles.find((p) => p.isPrimary) ?? profiles[0];
    const legacy = localStorage.getItem("harbor.auth");
    if (primary && legacy && !localStorage.getItem(`harbor.auth.${primary.id}`)) {
      let valid = false;
      try {
        const parsed = JSON.parse(legacy) as { authKey?: unknown; user?: unknown };
        valid = typeof parsed?.authKey === "string" && parsed.authKey.length > 0 && !!parsed.user;
      } catch {
        valid = false;
      }
      if (valid) localStorage.setItem(`harbor.auth.${primary.id}`, legacy);
    }
    localStorage.setItem("harbor.auth.migrated.v1", "1");
  } catch {
    /* ignore */
  }
}

const Ctx = createContext<ProfilesValue | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfilesState>(() => {
    const loaded = readState();
    if (loaded.profiles.length === 0) {
      const identity = readSettingsIdentity();
      const legacyParental = readLegacyParental();
      const primary: Profile = {
        id: newId(),
        name: defaultPrimaryName(),
        avatar: identity.avatar,
        color: identity.color ?? PROFILE_COLORS[0],
        isPrimary: true,
        shareStremioWith: null,
        passwordHash: null,
        hideContent: null,
        lockedTabs: legacyParental.hiddenTabs,
        kid: null,
        createdAt: Date.now(),
      };
      const initial: ProfilesState = { profiles: [primary], activeId: primary.id };
      writeState(initial);
      migrateLegacyStremioAuth(initial.profiles);
      return initial;
    }
    migrateLegacyStremioAuth(loaded.profiles);
    const def = launchDefault(loaded.profiles);
    return def ? { ...loaded, activeId: def.id } : loaded;
  });
  const [pickerOpen, setPickerOpen] = useState<boolean>(() => {
    if (state.activeId == null) return true;
    if (state.profiles.length <= 1) return false;
    if (launchDefault(state.profiles)) return false;
    const interval = readProfilePromptInterval();
    if (interval === "never") return false;
    if (interval === "launch") {
      const wasShown = pickerPromptShownThisRun;
      pickerPromptShownThisRun = true;
      return !wasShown;
    }
    return Date.now() - readLastProfileSelectAt() >= intervalMinutes(interval) * 60000;
  });
  const [pickerView, setPickerViewState] = useState<PickerView>({ kind: "list" });

  useEffect(() => {
    writeState(state);
    window.dispatchEvent(new CustomEvent("harbor:profiles-updated"));
  }, [state]);

  const activeProfile = useMemo(
    () => state.profiles.find((p) => p.id === state.activeId) ?? null,
    [state.profiles, state.activeId],
  );

  const [sessionUnlockedIds, setSessionUnlockedIds] = useState<Set<string>>(() => new Set());
  // Read through refs so the gate can see current state without giving selectProfile a
  // changing identity, which several consumers put straight into their own dep arrays.
  const profilesRef = useRef(state.profiles);
  profilesRef.current = state.profiles;
  const unlockedRef = useRef(sessionUnlockedIds);
  unlockedRef.current = sessionUnlockedIds;

  const selectProfile = useCallback((id: string, opts?: { unlocked?: boolean }) => {
    // THE GATE LIVES HERE, not in the UI. It used to be duplicated in picker-modal and
    // use-account-menu, and RemoteOpenBridge has neither: it calls selectProfile(id)
    // straight off a harbor:remote-set-profile event, so a paired phone walked past
    // every profile PIN including a kid profile's parent PIN. Gated callers already
    // pass { unlocked: true } after verifying, so they are unaffected and the remote
    // now fails closed.
    const target = profilesRef.current.find((p) => p.id === id) ?? null;
    if (refuseProfileSelect(target, unlockedRef.current, opts)) return false;
    if (opts?.unlocked) {
      setSessionUnlockedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }
    markProfileSelectedNow();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProfilesState;
        parsed.activeId = id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}
    window.dispatchEvent(new CustomEvent("harbor:active-profile-changed", { detail: { id } }));
    setState((s) => ({ ...s, activeId: id }));
    setPickerOpen(false);
    setPickerViewState({ kind: "list" });
    return true;
  }, []);

  useEffect(() => {
    const onFocus = () => {
      if (pickerOpen) return;
      const mins = intervalMinutes(readProfilePromptInterval());
      if (mins <= 0 || state.activeId == null || state.profiles.length <= 1) return;
      if (Date.now() - readLastProfileSelectAt() >= mins * 60000) {
        setPickerViewState({ kind: "list" });
        setPickerOpen(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [state.activeId, state.profiles.length, pickerOpen]);

  const openPicker = useCallback((view: PickerView = { kind: "list" }) => {
    setPickerViewState(view);
    setPickerOpen(true);
  }, []);
  const setPickerView = useCallback((view: PickerView) => setPickerViewState(view), []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerViewState({ kind: "list" });
  }, []);

  const createProfile = useCallback<ProfilesValue["createProfile"]>(
    ({ name, avatar, color, kid }) => {
      const primary = state.profiles.find((p) => p.isPrimary) ?? state.profiles[0];
      const created: Profile = {
        id: newId(),
        name: name.trim().slice(0, 32) || "Profile",
        avatar: avatar ?? null,
        color,
        isPrimary: false,
        shareStremioWith: primary?.id ?? null,
        passwordHash: null,
        hideContent: null,
        lockedTabs: null,
        kid: kid ?? null,
        settingsLinked: true,
        createdAt: Date.now(),
      };
      setState((s) => ({ ...s, profiles: [...s.profiles, created] }));
      return created;
    },
    [state.profiles],
  );

  const updateProfile = useCallback<ProfilesValue["updateProfile"]>((id, patch) => {
    setState((s) => ({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              name: patch.name != null ? patch.name.trim().slice(0, 32) || p.name : p.name,
            }
          : p,
      ),
    }));
  }, []);

  const deleteProfile = useCallback<ProfilesValue["deleteProfile"]>(
    (id) => {
      const target = state.profiles.find((p) => p.id === id);
      if (!target || target.isPrimary) return;
      // Before the purge, while the id map still resolves. Without a tombstone the
      // delete never reaches a third device: it still holds the profile, pushes it back
      // up, and it reappears on the two devices that deleted it.
      noteProfileDeleted(id);
      purgeProfileStorage(id);
      void deleteProfileBgImage(id);
      setState((s) => {
        const profiles = s.profiles
          .filter((p) => p.id !== id)
          .map((p) => (p.shareStremioWith === id ? { ...p, shareStremioWith: null } : p));
        const activeId = s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId;
        return { profiles, activeId };
      });
    },
    [state.profiles],
  );

  // The sync roster reads and applies through the provider, never through
  // harbor.profiles.v1 directly: this component persists its own state on every change
  // and never reads that key back, so an external write is clobbered on the next render.
  useEffect(() => {
    configureRosterStore({
      read: () => profilesRef.current,
      apply: (plan) => {
        for (const id of plan.dropLocalIds) purgeProfileStorage(id);
        setState((s) => {
          const byId = new Map(s.profiles.map((p) => [p.id, p]));
          const profiles = plan.replaceWith.map((next) =>
            adoptProfile(next, byId.get(next.id), pickColor(s.profiles)),
          );
          const stillHere = profiles.some((p) => p.id === s.activeId);
          return { profiles, activeId: stillHere ? s.activeId : (profiles[0]?.id ?? null) };
        });
      },
    });
    return () => configureRosterStore(null);
  }, []);

  const setPrimary = useCallback<ProfilesValue["setPrimary"]>((id) => {
    setState((s) => {
      if (!s.profiles.some((p) => p.id === id && !p.isPrimary)) return s;
      return {
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === id
            ? { ...p, isPrimary: true, shareStremioWith: null }
            : p.isPrimary
              ? { ...p, isPrimary: false }
              : p,
        ),
      };
    });
  }, []);

  const value = useMemo<ProfilesValue>(
    () => ({
      profiles: state.profiles,
      activeId: state.activeId,
      activeProfile,
      pickerOpen,
      pickerView,
      openPicker,
      setPickerView,
      closePicker,
      selectProfile,
      sessionUnlockedIds,
      createProfile,
      updateProfile,
      deleteProfile,
      setPrimary,
    }),
    [
      state.profiles,
      state.activeId,
      activeProfile,
      pickerOpen,
      pickerView,
      sessionUnlockedIds,
      openPicker,
      setPickerView,
      closePicker,
      selectProfile,
      createProfile,
      updateProfile,
      deleteProfile,
      setPrimary,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfiles outside ProfilesProvider");
  return v;
}

export function useActiveKid(): KidConfig | null {
  const { activeProfile } = useProfiles();
  return activeProfile?.kid ?? null;
}

export function nextProfileColor(existing: Profile[]): ProfileColor {
  return pickColor(existing);
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function stremioSourceProfileId(active: Profile | null, profiles: Profile[]): string | null {
  if (!active) return null;
  if (!active.shareStremioWith) return active.id;
  const exists = profiles.some((p) => p.id === active.shareStremioWith);
  return exists ? active.shareStremioWith : active.id;
}

export function sharesStremioStorage(
  a: Profile | null | undefined,
  b: Profile | null | undefined,
  profiles: Profile[],
): boolean {
  if (!a || !b) return false;
  return stremioSourceProfileId(a, profiles) === stremioSourceProfileId(b, profiles);
}
