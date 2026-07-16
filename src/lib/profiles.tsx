import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HiddenTabs } from "./lockable-tabs";
import type { ContentFilters } from "./settings";

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
  selectProfile: (id: string, opts?: { unlocked?: boolean }) => void;
  sessionUnlockedIds: Set<string>;
  createProfile: (input: {
    name: string;
    avatar?: string | null;
    color: ProfileColor;
    kid?: KidConfig | null;
  }) => Profile;
  updateProfile: (
    id: string,
    patch: Partial<Omit<Profile, "id" | "createdAt" | "isPrimary">>,
  ) => void;
  deleteProfile: (id: string) => void;
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
    const parsed = JSON.parse(raw) as {
      profilePromptInterval?: unknown;
      skipProfileScreen?: unknown;
    };
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

const PICKER_SESSION_KEY = "harbor.pickerShown";
function launchPickerShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(PICKER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function markLaunchPickerShown(): void {
  try {
    sessionStorage.setItem(PICKER_SESSION_KEY, "1");
  } catch {
    /* ignore */
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
        if (identity.avatar != null && !identity.avatar.startsWith("/kids/avatars/")) {
          next.avatar = identity.avatar;
        }
      }
      if (
        next.kid == null &&
        typeof next.avatar === "string" &&
        next.avatar.startsWith("/kids/avatars/")
      ) {
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
      return initial;
    }
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
      const shownThisSession = launchPickerShownThisSession();
      markLaunchPickerShown();
      return !shownThisSession;
    }
    return Date.now() - readLastProfileSelectAt() >= intervalMinutes(interval) * 60000;
  });
  const [pickerView, setPickerViewState] = useState<PickerView>({ kind: "list" });

  useEffect(() => {
    writeState(state);
  }, [state]);

  const activeProfile = useMemo(
    () => state.profiles.find((p) => p.id === state.activeId) ?? null,
    [state.profiles, state.activeId],
  );

  const [sessionUnlockedIds, setSessionUnlockedIds] = useState<Set<string>>(() => new Set());
  const selectProfile = useCallback((id: string, opts?: { unlocked?: boolean }) => {
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
    setState((s) => ({ ...s, activeId: id }));
    setPickerOpen(false);
    setPickerViewState({ kind: "list" });
  }, []);

  useEffect(() => {
    const onFocus = () => {
      const mins = intervalMinutes(readProfilePromptInterval());
      if (mins <= 0 || state.activeId == null || state.profiles.length <= 1) return;
      if (Date.now() - readLastProfileSelectAt() >= mins * 60000) {
        setPickerViewState({ kind: "list" });
        setPickerOpen(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [state.activeId, state.profiles.length]);

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
      try {
        localStorage.removeItem(`harbor.auth.${id}`);
        localStorage.removeItem(`harbor.favorites.v1.${id}`);
        localStorage.removeItem(`harbor.localwatchlist.v1.${id}`);
        localStorage.removeItem(`harbor.settings.${id}`);
        localStorage.removeItem(`harbor.trakt.session.v1.${id}`);
        localStorage.removeItem(`harbor.simkl.session.v1.${id}`);
        localStorage.removeItem(`harbor.anilist.session.v1.${id}`);
        localStorage.removeItem(`harbor.mal.session.v1.${id}`);
        localStorage.removeItem(`harbor.simkl.cache.v2.${id}`);
        localStorage.removeItem(`harbor.anilist.synced.v1.${id}`);
        localStorage.removeItem(`harbor.mal.synced.v1.${id}`);
      } catch {
        /* ignore */
      }
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
