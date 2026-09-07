import {
  Check,
  ChevronLeft,
  Crown,
  Loader2,
  Lock,
  Link2,
  ShieldCheck,
  Trash2,
  Unlock,
  User as UserIcon,
} from "@/views/settings/icons";
import { useEffect, useRef, useState } from "react";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
import { AddonsIcon } from "@/components/icons/addons-icon";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { SportsIcon } from "@/components/icons/sports-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import {
  anyTabLocked,
  DEFAULT_HIDDEN,
  LOCKABLE_TABS,
  type HiddenTabs,
  type LockableTab,
  type LockableTabMeta,
} from "@/lib/lockable-tabs";
import {
  nextProfileColor,
  useProfiles,
  type KidConfig,
  type Profile,
  type ProfileColor,
} from "@/lib/profiles";
import { emitListToast } from "@/components/lists/list-toast";
import {
  analyzeOverlaps,
  defaultSelectedAddonUrls,
  importDomains,
  summarizeSource,
  type DomainOverlap,
  type ImportAddonPreview,
  type ImportDomain,
  type ImportDomainChoice,
  type ImportSourceSummary,
} from "@/lib/profile-import";
import { useT } from "@/lib/i18n";
import { hashProfilePassword, verifyProfilePassword } from "@/lib/profile-password";
import { fetchTraktAvatar } from "@/lib/trakt/profile";
import { useTrakt } from "@/lib/trakt/provider";
import { fetchAnilistAvatar } from "@/lib/anilist/profile";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchSimklAvatar } from "@/lib/simkl/profile";
import { useSimkl } from "@/lib/simkl/provider";
import { useSettings } from "@/lib/settings";
import { AvatarRing } from "@/views/settings/account/avatar-ring";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { resizeAvatar } from "@/views/settings/account/avatar-utils";
import { AvatarFan } from "@/components/avatar-picker/avatar-fan";
import { AvatarCatalogModal } from "@/components/avatar-picker/avatar-catalog-modal";
import { ColorPicker } from "@/views/settings/color-picker";
import { KidToggle } from "./kid-toggle";
import { KidsSetupPanel } from "./kids-setup-panel";
import { PinEntry } from "./pin-entry";
import { isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";

type SubView =
  | { kind: "main" }
  | { kind: "security" }
  | { kind: "pin-set" }
  | { kind: "pin-change" }
  | { kind: "pin-remove" }
  | { kind: "tabs" };

export function EditorView({
  mode,
  onCancel,
  onDone,
}: {
  mode: { kind: "create" } | { kind: "edit"; profile: Profile };
  onCancel: () => void;
  onDone: () => void;
}) {
  const {
    profiles,
    activeProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    selectProfile,
    setPrimary,
  } = useProfiles();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: anilistConnected, avatar: anilistAvatar } = useAnilist();
  const { isConnected: simklConnected } = useSimkl();
  const { update } = useSettings();
  const t = useT();
  const [loadingTraktAvatar, setLoadingTraktAvatar] = useState(false);
  const [traktAvatarError, setTraktAvatarError] = useState<string | null>(null);
  const [loadingAnilistAvatar, setLoadingAnilistAvatar] = useState(false);
  const [anilistAvatarError, setAnilistAvatarError] = useState<string | null>(null);
  const [loadingSimklAvatar, setLoadingSimklAvatar] = useState(false);
  const [simklAvatarError, setSimklAvatarError] = useState<string | null>(null);
  const editing = mode.kind === "edit" ? mode.profile : null;
  const primary = profiles.find((p) => p.isPrimary);
  const transferTargets = profiles.filter((p) => !p.isPrimary);
  const activeIsPrimary = !!activeProfile?.isPrimary;
  const isOwnProfile = editing?.id === activeProfile?.id;
  const canEditAdvanced = activeIsPrimary;
  const [name, setName] = useState(editing?.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(editing?.avatar ?? null);
  const [avatarSource, setAvatarSource] = useState<
    "trakt" | "anilist" | "simkl" | "upload" | "builtin" | "removed" | null
  >(null);
  const [color, setColor] = useState<ProfileColor>(editing?.color ?? nextProfileColor(profiles));
  const [shareWith, setShareWith] = useState<string | null>(
    editing ? editing.shareStremioWith : (primary?.id ?? null),
  );
  const [importSelection, setImportSelection] = useState<Record<ImportDomain, boolean>>({
    settings: false,
    addons: false,
    watchlist: false,
    favorites: false,
    watched: false,
    continueWatching: false,
  });
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [sourceSummary, setSourceSummary] = useState<ImportSourceSummary | null>(null);
  const [overlaps, setOverlaps] = useState<Partial<Record<ImportDomain, DomainOverlap>>>({});
  const [domainChoices, setDomainChoices] = useState<
    Partial<Record<ImportDomain, ImportDomainChoice>>
  >({});
  const [importExpanded, setImportExpanded] = useState(mode.kind === "create");
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [confirmingShare, setConfirmingShare] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingPrimary, setConfirmingPrimary] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<string | null>(null);
  const [draftLockedTabs, setDraftLockedTabs] = useState<HiddenTabs | null>(
    editing?.lockedTabs ?? null,
  );
  const [draftKid, setDraftKid] = useState<KidConfig | null>(editing?.kid ?? null);
  const [draftParentPin, setDraftParentPin] = useState<string | null>(null);
  const [subView, setSubView] = useState<SubView>({ kind: "main" });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === document.body) {
      document.querySelector<HTMLElement>("[data-profile-picker]")?.focus({ preventScroll: true });
    }
  }, [subView.kind]);

  useEffect(() => {
    if (subView.kind === "main") return;
    const onBack = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isBackKey(e)) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-profile-picker]') || target.closest('[data-search-editing]')) return;
      e.preventDefault();
      e.stopPropagation();
      setSubView({ kind: subView.kind === "security" ? "main" : "security" });
    };
    document.addEventListener("keydown", onBack);
    return () => document.removeEventListener("keydown", onBack);
  }, [subView.kind]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && (!draftKid || !draftParentPin || draftParentPin.length === 4);
  const isPrimary = editing?.isPrimary === true;
  const canShare = !isPrimary && !!primary && primary.id !== editing?.id;
  const locked = editing ? !!editing.passwordHash : draftPin != null;
  const isCreate = mode.kind === "create";
  const importPanelOpen = !isPrimary && canShare && !!primary && shareWith === null;
  const importSourceId = !isPrimary && primary ? primary.id : null;
  const importAnySelected = (Object.keys(importSelection) as ImportDomain[]).some(
    (d) => importSelection[d],
  );

  useEffect(() => {
    setSourceSummary(importSourceId ? summarizeSource(importSourceId) : null);
  }, [importSourceId]);

  const targetProfileId = editing?.id ?? null;
  useEffect(() => {
    if (!importSourceId || !targetProfileId) {
      setOverlaps({});
      return;
    }
    const selectedMergeable = (Object.keys(importSelection) as ImportDomain[]).filter(
      (d) => importSelection[d] && (d === "watchlist" || d === "favorites" || d === "addons"),
    );
    if (selectedMergeable.length === 0) {
      setOverlaps({});
      return;
    }
    setOverlaps(
      analyzeOverlaps(importSourceId, targetProfileId, selectedMergeable, [...selectedAddons]),
    );
  }, [importSourceId, targetProfileId, importSelection, selectedAddons]);

  const resetImportChoice = () => {
    setImportSelection({
      settings: false,
      addons: false,
      watchlist: false,
      favorites: false,
      watched: false,
      continueWatching: false,
    });
    setSelectedAddons(new Set());
    setOverlaps({});
    setDomainChoices({});
  };

  const toggleImportDomain = (domain: ImportDomain) => {
    const turningOn = !importSelection[domain];
    setImportSelection((prev) => ({ ...prev, [domain]: !prev[domain] }));
    if (!turningOn) {
      setDomainChoices((prev) => {
        if (!(domain in prev)) return prev;
        const next = { ...prev };
        delete next[domain];
        return next;
      });
    }
    if (domain === "addons" && turningOn) {
      setSelectedAddons(defaultSelectedAddonUrls(sourceSummary?.addons ?? []));
    }
  };

  const toggleImportAddon = (transportUrl: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(transportUrl)) next.delete(transportUrl);
      else next.add(transportUrl);
      return next;
    });
    setDomainChoices((prev) => {
      if (!("addons" in prev)) return prev;
      const next = { ...prev };
      delete next.addons;
      return next;
    });
  };

  const applyImportToExisting = () => {
    if (!primary || !editing) return;
    const list = (Object.keys(importSelection) as ImportDomain[]).filter((d) => importSelection[d]);
    if (list.length === 0) return;
    importDomains(primary.id, editing.id, list, {
      addonTransportUrls: list.includes("addons") ? [...selectedAddons] : null,
      choices: domainChoices,
    });
    if (list.includes("settings") && editing.settingsLinked !== false) {
      updateProfile(editing.id, { settingsLinked: false });
    }
    window.dispatchEvent(new Event("harbor:addons-changed"));
    window.dispatchEvent(new Event("harbor:active-profile-changed"));
    emitListToast(t("Data copied from {name}", { name: primary.name }));
    resetImportChoice();
    setConfirmingImport(false);
    setImportExpanded(false);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeAvatar(file, 320);
      setAvatar(dataUrl);
      setAvatarSource("upload");
    } catch (err) {
      console.warn("[profile] avatar resize failed", err);
    }
  };

  const onUseTraktAvatar = async () => {
    setLoadingTraktAvatar(true);
    setTraktAvatarError(null);
    try {
      const url = await fetchTraktAvatar();
      if (!url) {
        setTraktAvatarError(t("Couldn't find a Trakt avatar on your account."));
        setTimeout(() => setTraktAvatarError(null), 4000);
        return;
      }
      setAvatar(url);
      setAvatarSource("trakt");
    } catch {
      setTraktAvatarError(t("Couldn't reach Trakt."));
      setTimeout(() => setTraktAvatarError(null), 4000);
    } finally {
      setLoadingTraktAvatar(false);
    }
  };

  const onUseAnilistAvatar = async () => {
    setLoadingAnilistAvatar(true);
    setAnilistAvatarError(null);
    try {
      const url = await fetchAnilistAvatar();
      if (!url) {
        setAnilistAvatarError(t("Couldn't find an AniList avatar on your account."));
        setTimeout(() => setAnilistAvatarError(null), 4000);
        return;
      }
      setAvatar(url);
      setAvatarSource("anilist");
    } catch {
      setAnilistAvatarError(t("Couldn't reach AniList."));
      setTimeout(() => setAnilistAvatarError(null), 4000);
    } finally {
      setLoadingAnilistAvatar(false);
    }
  };

  const onUseSimklAvatar = async () => {
    setLoadingSimklAvatar(true);
    setSimklAvatarError(null);
    try {
      const url = await fetchSimklAvatar();
      if (!url) {
        setSimklAvatarError(t("Couldn't find a Simkl avatar on your account."));
        setTimeout(() => setSimklAvatarError(null), 4000);
        return;
      }
      setAvatar(url);
      setAvatarSource("simkl");
    } catch {
      setSimklAvatarError(t("Couldn't reach Simkl."));
      setTimeout(() => setSimklAvatarError(null), 4000);
    } finally {
      setLoadingSimklAvatar(false);
    }
  };

  const submit = async () => {
    if (!canSave) return;
    let kidToSave = draftKid;
    if (draftKid) {
      let parentPinHash = editing?.kid?.parentPinHash ?? null;
      if (draftParentPin && draftParentPin.length === 4) {
        parentPinHash = await hashProfilePassword(draftParentPin);
      }
      kidToSave = {
        age: draftKid.age,
        curfewMinutes: draftKid.curfewMinutes ?? null,
        parentPinHash,
      };
    }
    if (editing) {
      updateProfile(editing.id, {
        name: trimmed,
        avatar,
        color,
        kid: kidToSave,
        ...(canShare ? { shareStremioWith: shareWith } : {}),
      });
    } else {
      const p = createProfile({ name: trimmed, avatar, color, kid: kidToSave });
      const patch: Parameters<typeof updateProfile>[1] = {};
      if (canShare && shareWith !== p.shareStremioWith) patch.shareStremioWith = shareWith;
      if (draftPin) patch.passwordHash = await hashProfilePassword(draftPin);
      if (anyTabLocked(draftLockedTabs)) patch.lockedTabs = draftLockedTabs;
      const importList =
        shareWith === null && primary
          ? (Object.keys(importSelection) as ImportDomain[]).filter((d) => importSelection[d])
          : [];
      if (importList.length > 0 && primary) {
        importDomains(primary.id, p.id, importList, {
          addonTransportUrls: importList.includes("addons") ? [...selectedAddons] : null,
          choices: domainChoices,
        });
        if (importList.includes("settings")) patch.settingsLinked = false;
        emitListToast(t("Data copied from {name}", { name: primary.name }));
      }
      if (Object.keys(patch).length > 0) updateProfile(p.id, patch);
      // unlocked: the user set this PIN seconds ago in this very form. Without the flag
      // selectProfile refuses the profile they just created and Save appears to fail.
      selectProfile(p.id, { unlocked: true });
    }
    if (avatarSource && (isOwnProfile || mode.kind === "create")) {
      update({
        useAnilistAvatar: avatarSource === "anilist",
        useTraktAvatar: avatarSource === "trakt",
        useSimklAvatar: avatarSource === "simkl",
      });
    }
    onDone();
  };

  if (subView.kind === "pin-set") {
    return (
      <PinEntry
        key={subView.kind}
        title={
          editing ? t("Set a PIN for {name}", { name: trimmed || editing.name }) : t("Set a PIN")
        }
        subtitle={t("Pick a 4-digit PIN. You'll be asked for it before this profile opens.")}
        mode="set"
        onBack={() => setSubView({ kind: "security" })}
        onComplete={async (pin) => {
          if (editing) {
            const hash = await hashProfilePassword(pin);
            updateProfile(editing.id, { passwordHash: hash });
          } else {
            setDraftPin(pin);
          }
          setSubView({ kind: "security" });
        }}
      />
    );
  }

  if (subView.kind === "pin-change" && editing?.passwordHash) {
    const targetHash = editing.passwordHash;
    return (
      <PinEntry
        key={subView.kind}
        title={t("Enter current PIN")}
        subtitle={t("Confirm your current PIN, then pick a new one.")}
        mode="verify"
        onBack={() => setSubView({ kind: "security" })}
        verify={(pin) => verifyProfilePassword(pin, targetHash)}
        onComplete={() => {
          setSubView({ kind: "pin-set" });
        }}
      />
    );
  }

  if (subView.kind === "pin-remove" && editing?.passwordHash) {
    const targetHash = editing.passwordHash;
    return (
      <PinEntry
        key={subView.kind}
        title={t("Enter current PIN")}
        subtitle={t("Confirm your current PIN to remove the lock.")}
        mode="verify"
        onBack={() => setSubView({ kind: "security" })}
        verify={(pin) => verifyProfilePassword(pin, targetHash)}
        onComplete={() => {
          updateProfile(editing.id, { passwordHash: null });
          setSubView({ kind: "security" });
        }}
      />
    );
  }

  if (subView.kind === "tabs") {
    return (
      <TabsView
        initial={editing?.lockedTabs ?? draftLockedTabs ?? null}
        onBack={() => setSubView({ kind: "security" })}
        onSave={(next) => {
          if (editing) {
            updateProfile(editing.id, { lockedTabs: anyTabLocked(next) ? next : null });
          } else {
            setDraftLockedTabs(anyTabLocked(next) ? next : null);
          }
          setSubView({ kind: "security" });
        }}
      />
    );
  }

  if (subView.kind === "security") {
    return (
      <SecurityView
        locked={locked}
        editing={!!editing}
        lockedTabs={editing?.lockedTabs ?? draftLockedTabs}
        onBack={() => setSubView({ kind: "main" })}
        onSetPin={() => setSubView({ kind: "pin-set" })}
        onChangePin={() => setSubView({ kind: "pin-change" })}
        onRemovePin={() => {
          if (editing) {
            setSubView({ kind: "pin-remove" });
          } else {
            setDraftPin(null);
          }
        }}
        onOpenTabs={() => setSubView({ kind: "tabs" })}
      />
    );
  }

  if (editing && !isOwnProfile && !canEditAdvanced) {
    return <BlockedView onBack={onCancel} />;
  }

  const showAdvanced = canEditAdvanced || mode.kind === "create";

  return (
    <div data-profile-editor="" className="flex w-full max-w-[680px] flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
          {editing ? t("Edit {name}", { name: editing.name }) : t("profile.new")}
        </h1>
      </div>

      <div className="flex flex-col gap-4 border-b border-edge-soft pb-6">
        <div className="hset-profile-editor-identity flex items-center gap-5">
          <AvatarRing src={avatar} size={76} onClick={() => fileRef.current?.click()} />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onPickFile}
            className="hidden"
          />
          <div className="hset-profile-editor-fields flex min-w-0 flex-1 flex-col gap-2.5">
            <label className="flex flex-col gap-2 text-[14px] text-ink-muted">
              {t("Display name")}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || navOwnsFocus(e.currentTarget) || e.currentTarget.hasAttribute("data-search-editing")) return;
                e.preventDefault();
                e.stopPropagation();
                void submit();
              }}
              aria-label={t("Display name")}
              placeholder={t("Display name")}
              maxLength={32}
              className="h-12 rounded-xl border border-edge bg-canvas px-4 text-[15.5px] font-medium text-ink outline-none transition-colors focus:border-ink-subtle"
            />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-8 rounded-lg border border-edge-soft px-2.5 text-[14px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Upload photo")}
              </button>
              {traktConnected && (
                <button
                  type="button"
                  onClick={() => void onUseTraktAvatar()}
                  disabled={loadingTraktAvatar}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-edge-soft px-2.5 text-[14px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-60"
                >
                  {loadingTraktAvatar ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <img src={traktLogo} alt="" className="h-3 w-3 object-contain" />
                  )}
                  {t("Use Trakt avatar")}
                </button>
              )}
              {anilistConnected && (
                <button
                  type="button"
                  onClick={() => void onUseAnilistAvatar()}
                  disabled={loadingAnilistAvatar}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-edge-soft px-2.5 text-[14px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-60"
                >
                  {loadingAnilistAvatar ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : anilistAvatar ? (
                    <img
                      src={anilistAvatar}
                      alt=""
                      className="h-3.5 w-3.5 rounded-full object-cover"
                    />
                  ) : (
                    <Link2 size={12} />
                  )}
                  {t("Use AniList avatar")}
                </button>
              )}
              {simklConnected && (
                <button
                  type="button"
                  onClick={() => void onUseSimklAvatar()}
                  disabled={loadingSimklAvatar}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-edge-soft px-2.5 text-[14px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-60"
                >
                  {loadingSimklAvatar ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <img src={simklLogo} alt="" className="h-3 w-3 object-contain" />
                  )}
                  {t("Use Simkl avatar")}
                </button>
              )}
              {avatar && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatar(null);
                    setAvatarSource("removed");
                  }}
                  className="h-8 rounded-lg border border-edge-soft px-2.5 text-[14px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:text-danger"
                >
                  {t("common.remove")}
                </button>
              )}
            </div>
            <AvatarFan
              label={t("Choose an avatar")}
              onClick={() => setAvatarPickerOpen(true)}
              onRandomize={(value) => {
                setAvatar(value);
                setAvatarSource("builtin");
              }}
            />
            {traktAvatarError && (
              <p className="text-[14px] text-amber-200/85">{traktAvatarError}</p>
            )}
            {anilistAvatarError && (
              <p className="text-[14px] text-amber-200/85">{anilistAvatarError}</p>
            )}
            {simklAvatarError && (
              <p className="text-[14px] text-amber-200/85">{simklAvatarError}</p>
            )}
          </div>
        </div>
        <div className="border-t border-edge-soft/60 pt-4">
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>

      {showAdvanced && !isPrimary && <KidToggle value={draftKid} onChange={setDraftKid} />}

      {draftKid && (
        <KidsSetupPanel
          avatar={avatar}
          setAvatar={(v) => {
            setAvatar(v);
            setAvatarSource("builtin");
          }}
          kid={draftKid}
          setKid={setDraftKid}
          parentPin={draftParentPin}
          setParentPin={setDraftParentPin}
          hasExistingPin={!!editing?.kid?.parentPinHash}
        />
      )}

      {showAdvanced && !draftKid && (
        <SecurityRow
          locked={locked}
          lockedTabs={editing?.lockedTabs ?? draftLockedTabs}
          onOpen={() => setSubView({ kind: "security" })}
        />
      )}

      {showAdvanced && !draftKid && canShare && primary && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Stremio account")}
          </span>
          <div className="flex flex-col gap-1.5">
            <ShareOption
              active={shareWith === primary.id}
              onClick={() => {
                if (!editing) {
                  setShareWith(primary.id);
                  resetImportChoice();
                } else {
                  setConfirmingShare(true);
                }
              }}
              icon={<Link2 size={14} strokeWidth={2.2} />}
              title={t("Share with {name}", { name: primary.name })}
              sub={t("Use the primary profile's Stremio library, watchlist, and addons.")}
            />
            <ShareOption
              active={shareWith === null}
              onClick={() => {
                setShareWith(null);
                setConfirmingShare(false);
                resetImportChoice();
              }}
              icon={<UserIcon size={14} strokeWidth={2.2} />}
              title={t("Use a separate Stremio account")}
              sub={t("Sign in from the sidebar after saving. Library and addons stay separate.")}
            />
            {confirmingShare && (
              <div className="flex items-center gap-2 rounded-lg border border-edge-soft bg-canvas/40 px-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1 leading-snug text-ink-subtle">
                  {t(
                    "Switch to sharing? This profile will use {name}'s library, watchlist and addons. Its own data is kept but hidden until you switch back.",
                    { name: primary.name },
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingShare(false)}
                  className="shrink-0 text-ink-muted transition-colors hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareWith(primary.id);
                    resetImportChoice();
                    setConfirmingShare(false);
                  }}
                  className="shrink-0 rounded-md bg-accent/20 px-2.5 py-1 font-semibold text-accent transition-colors hover:bg-accent/30"
                >
                  {t("common.confirm")}
                </button>
              </div>
            )}
            {importPanelOpen && !importExpanded && (
              <button
                type="button"
                onClick={() => setImportExpanded(true)}
                className="h-9 self-start rounded-lg border border-edge-soft px-3 text-[15px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Import data from {name}", { name: primary.name })}
              </button>
            )}
            {importPanelOpen && importExpanded && (
              <div className="mt-1 flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 p-3">
                <span className="text-[15px] font-semibold text-ink">
                  {t(isCreate ? "Start with data from {name}" : "Import data from {name}", {
                    name: primary?.name ?? "",
                  })}
                </span>
                <div className="flex flex-col gap-1">
                  <ImportRow
                    checked={importSelection.settings}
                    label={t("Settings")}
                    onClick={() => toggleImportDomain("settings")}
                  />
                  <ImportRow
                    checked={importSelection.addons}
                    label={t("Addons ({n})", { n: sourceSummary?.addons.length ?? 0 })}
                    onClick={() => toggleImportDomain("addons")}
                  />
                  {importSelection.addons && (sourceSummary?.addons.length ?? 0) > 0 && (
                    <div className="ms-6 flex flex-col gap-1">
                      {(sourceSummary?.addons ?? []).map((addon: ImportAddonPreview) => (
                        <ImportRow
                          key={addon.transportUrl}
                          compact
                          checked={selectedAddons.has(addon.transportUrl)}
                          label={addon.name}
                          onClick={() => toggleImportAddon(addon.transportUrl)}
                        />
                      ))}
                    </div>
                  )}
                  <ImportRow
                    checked={importSelection.watchlist}
                    label={t("Watchlist ({n})", { n: sourceSummary?.watchlistCount ?? 0 })}
                    onClick={() => toggleImportDomain("watchlist")}
                  />
                  <ImportRow
                    checked={importSelection.favorites}
                    label={t("Favorites ({n})", { n: sourceSummary?.favoriteCount ?? 0 })}
                    onClick={() => toggleImportDomain("favorites")}
                  />
                  <ImportRow
                    checked={importSelection.watched}
                    label={t("Watched history")}
                    onClick={() => toggleImportDomain("watched")}
                  />
                  <ImportRow
                    checked={importSelection.continueWatching}
                    label={t("Continue watching")}
                    onClick={() => toggleImportDomain("continueWatching")}
                  />
                </div>
                {(overlaps.watchlist?.overlapCount ?? 0) > 0 && (
                  <ConflictRow
                    label={t("Watchlist overlaps ({n})", {
                      n: overlaps.watchlist?.overlapCount ?? 0,
                    })}
                    value={domainChoices.watchlist ?? "merge"}
                    onChange={(v) => setDomainChoices((prev) => ({ ...prev, watchlist: v }))}
                  />
                )}
                {(overlaps.favorites?.overlapCount ?? 0) > 0 && (
                  <ConflictRow
                    label={t("Favorites overlap ({n})", {
                      n: overlaps.favorites?.overlapCount ?? 0,
                    })}
                    value={domainChoices.favorites ?? "merge"}
                    onChange={(v) => setDomainChoices((prev) => ({ ...prev, favorites: v }))}
                  />
                )}
                {(overlaps.addons?.overlapCount ?? 0) > 0 && (
                  <ConflictRow
                    label={t("Addons overlap ({n})", {
                      n: overlaps.addons?.overlapCount ?? 0,
                    })}
                    value={domainChoices.addons ?? "merge"}
                    onChange={(v) => setDomainChoices((prev) => ({ ...prev, addons: v }))}
                  />
                )}
                <p className="text-[14px] leading-snug text-ink-subtle">
                  {t(
                    isCreate
                      ? "Copied once — afterwards this profile keeps its own copy. Nothing stays linked to Primary."
                      : "Areas where data already exists let you choose how to combine it.",
                  )}
                </p>
                {!isCreate && (
                  <div className="flex items-center justify-end gap-2 pt-1 text-[14px]">
                    {!confirmingImport ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            resetImportChoice();
                            setImportExpanded(false);
                          }}
                          className="text-ink-muted transition-colors hover:text-ink"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          disabled={!importAnySelected}
                          onClick={() => setConfirmingImport(true)}
                          className="rounded-md bg-accent/20 px-2.5 py-1 font-semibold text-accent transition-colors hover:bg-accent/30 disabled:opacity-40"
                        >
                          {t("Import")}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-ink-subtle">{t("Import selected data?")}</span>
                        <button
                          type="button"
                          onClick={() => setConfirmingImport(false)}
                          className="text-ink-muted transition-colors hover:text-ink"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={applyImportToExisting}
                          className="rounded-md bg-accent/20 px-2.5 py-1 font-semibold text-accent transition-colors hover:bg-accent/30"
                        >
                          {t("common.confirm")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showAdvanced && !draftKid && editing && !isPrimary && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Primary profile")}
          </span>
          <div className="flex items-center gap-3 rounded-xl border border-edge-soft bg-elevated/30 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
              <Crown size={16} strokeWidth={2.2} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold text-ink">
                {t("Make this the primary profile")}
              </span>
              <span className="text-[14px] leading-snug text-ink-subtle">
                {t(
                  "The primary manages profiles and can't be deleted. Transfer it here to delete the old one.",
                )}
              </span>
            </div>
            {!confirmingPrimary ? (
              <button
                type="button"
                onClick={() => setConfirmingPrimary(true)}
                className="h-9 shrink-0 rounded-lg border border-edge-soft px-3 text-[15px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Set as primary")}
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2 text-[14px]">
                <button
                  type="button"
                  onClick={() => setConfirmingPrimary(false)}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrimary(editing.id);
                    onDone();
                  }}
                  className="rounded-md bg-accent/20 px-2 py-1 font-semibold text-accent transition-colors hover:bg-accent/30"
                >
                  {t("common.confirm")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdvanced && !draftKid && editing && isPrimary && transferTargets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Primary profile")}
          </span>
          <div className="flex flex-col gap-2.5 rounded-xl border border-edge-soft bg-elevated/30 p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
                <Crown size={16} strokeWidth={2.2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">
                  {t("This is the primary profile")}
                </span>
                <span className="text-[14px] leading-snug text-ink-subtle">
                  {t(
                    "It manages profiles and can't be deleted. Hand primary to another profile to delete this one.",
                  )}
                </span>
              </div>
            </div>
            {!transferOpen ? (
              <button
                type="button"
                onClick={() => setTransferOpen(true)}
                className="h-9 self-start rounded-lg border border-edge-soft px-3 text-[15px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Transfer to another profile")}
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                {transferTargets.map((p) => {
                  const sel = transferTarget === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTransferTarget(p.id)}
                      className={`flex items-center gap-2.5 rounded-lg border p-2 text-start transition-colors ${
                        sel
                          ? "border-accent bg-accent/10"
                          : "border-edge-soft hover:border-edge hover:bg-elevated/40"
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated"
                        style={{ boxShadow: `0 0 0 2px ${p.color}` }}
                      >
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <CatAvatar className="h-full w-full" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                        {p.name}
                      </span>
                      {sel && (
                        <Check size={15} className="shrink-0 text-accent" strokeWidth={2.6} />
                      )}
                    </button>
                  );
                })}
                <div className="flex items-center justify-end gap-2 pt-1 text-[14px]">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferOpen(false);
                      setTransferTarget(null);
                    }}
                    className="text-ink-muted transition-colors hover:text-ink"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!transferTarget}
                    onClick={() => {
                      if (!transferTarget) return;
                      setPrimary(transferTarget);
                      onDone();
                    }}
                    className="rounded-md bg-accent/20 px-2.5 py-1 font-semibold text-accent transition-colors hover:bg-accent/30 disabled:opacity-40"
                  >
                    {t("Transfer primary")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-edge-soft px-4 text-[15px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t("common.cancel")}
          </button>
          {editing &&
            !isPrimary &&
            canEditAdvanced &&
            (!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 text-[14px] font-medium text-ink-subtle transition-colors hover:text-red-300"
              >
                <Trash2 size={12} />
                {t("Delete profile")}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-[14px]">
                <span className="text-red-200">{t("Delete this profile?")}</span>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-ink-muted hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteProfile(editing.id);
                    onDone();
                  }}
                  className="rounded-md bg-red-400/20 px-2 py-0.5 font-semibold text-red-200 hover:bg-red-400/30"
                >
                  {t("common.confirm")}
                </button>
              </div>
            ))}
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-5 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {editing ? t("Save changes") : t("Create profile")}
        </button>
      </div>
      {avatarPickerOpen && (
        <AvatarCatalogModal
          current={avatar}
          onPick={(value) => {
            setAvatar(value);
            setAvatarSource("builtin");
            setAvatarPickerOpen(false);
          }}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}
    </div>
  );
}

function BlockedView({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[14px] text-ink-muted">
        {t("Only the primary profile can edit other profiles.")}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="h-11 rounded-xl bg-ink px-5 text-[15px] font-semibold text-canvas"
      >
        {t("common.back")}
      </button>
    </div>
  );
}

function SecurityRow({
  locked,
  lockedTabs,
  onOpen,
}: {
  locked: boolean;
  lockedTabs: HiddenTabs | null;
  onOpen: () => void;
}) {
  const t = useT();
  const lockedCount = lockedTabs ? Object.values(lockedTabs).filter(Boolean).length : 0;
  const pinLabel = locked ? t("PIN on") : t("PIN off");
  const tabsLabel =
    lockedCount === 0
      ? t("no tab locks")
      : locked
        ? t("{n} tabs locked", { n: lockedCount })
        : t("Locks only activate once a PIN is set.");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5 text-start transition-colors hover:border-edge hover:bg-canvas/60"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
            locked
              ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30"
              : "bg-canvas/60 text-ink-muted ring-edge-soft"
          }`}
        >
          {locked ? (
            <Lock size={14} strokeWidth={2.4} />
          ) : (
            <Unlock size={14} strokeWidth={2.2} />
          )}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-ink">{t("Security")}</span>
          <span className="text-[14px] text-ink-subtle">
            {pinLabel} · {tabsLabel}
          </span>
        </div>
      </div>
      <ChevronLeft
        size={14}
        strokeWidth={2.2}
        className="rotate-180 rtl:rotate-0 text-ink-subtle"
      />
    </button>
  );
}

function SecurityView({
  locked,
  editing,
  lockedTabs,
  onBack,
  onSetPin,
  onChangePin,
  onRemovePin,
  onOpenTabs,
}: {
  locked: boolean;
  editing: boolean;
  lockedTabs: HiddenTabs | null;
  onBack: () => void;
  onSetPin: () => void;
  onChangePin: () => void;
  onRemovePin: () => void;
  onOpenTabs: () => void;
}) {
  const t = useT();
  const lockedCount = lockedTabs ? Object.values(lockedTabs).filter(Boolean).length : 0;
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-ink-muted transition-colors hover:bg-elevated/40 hover:text-ink"
        >
          <ChevronLeft size={14} strokeWidth={2.2} className="dir-icon" />
          {t("common.back")}
        </button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">
          {t("PIN & sidebar locks")}
        </h1>
        <p className="text-center text-[16px] text-ink-muted">
          {t("Pick a PIN and which sidebar tabs require it.")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-edge-soft bg-canvas/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                  locked
                    ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30"
                    : "bg-canvas/60 text-ink-muted ring-edge-soft"
                }`}
              >
                {locked ? (
                  <Lock size={14} strokeWidth={2.4} />
                ) : (
                  <Unlock size={14} strokeWidth={2.2} />
                )}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-ink">{t("PIN")}</span>
                <span className="text-[14px] text-ink-subtle">
                  {locked ? t("4-digit PIN is set.") : t("No PIN set.")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!locked ? (
                <button
                  type="button"
                  onClick={onSetPin}
                  className="h-11 rounded-lg bg-ink px-3.5 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  {t("Set PIN")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onChangePin}
                    className="h-11 rounded-lg border border-edge-soft px-3.5 text-[15px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                  >
                    {t("Change")}
                  </button>
                  <button
                    type="button"
                    onClick={onRemovePin}
                    className="h-11 rounded-lg border border-edge-soft px-3.5 text-[15px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:text-danger"
                  >
                    {editing ? t("common.remove") : t("Clear")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTabs}
          className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
                locked && lockedCount > 0
                  ? "bg-amber-300/15 text-amber-200 ring-amber-300/30"
                  : "bg-canvas/60 text-ink-muted ring-edge-soft"
              }`}
            >
              <ShieldCheck size={14} strokeWidth={2.2} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-semibold text-ink">{t("Sidebar access")}</span>
              <span className="text-[14px] text-ink-subtle">
                {lockedCount === 0
                  ? t("No locks. All sidebar tabs open without a PIN.")
                  : locked
                    ? t("{n} tabs require this profile's PIN.", { n: lockedCount })
                    : t("Locks only activate once a PIN is set.")}
              </span>
            </div>
          </div>
          <ChevronLeft
            size={14}
            strokeWidth={2.2}
            className="rotate-180 rtl:rotate-0 text-ink-subtle"
          />
        </button>
      </div>
    </div>
  );
}

function ImportRow({
  checked,
  label,
  compact,
  onClick,
}: {
  checked: boolean;
  label: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={`flex items-center gap-2.5 rounded-lg border px-3 text-start transition-colors ${
        checked
          ? "border-ink/40 bg-canvas/60"
          : "border-edge-soft hover:border-edge hover:bg-canvas/40"
      } ${compact ? "py-1.5" : "py-2"}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          checked ? "border-ink bg-ink text-canvas" : "border-edge"
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{label}</span>
    </button>
  );
}

function ConflictRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ImportDomainChoice;
  onChange: (v: ImportDomainChoice) => void;
}) {
  const t = useT();
  const options: { value: ImportDomainChoice; labelKey: string }[] = [
    { value: "merge", labelKey: "Merge" },
    { value: "replace", labelKey: "Replace" },
  ];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-elevated/30 p-2.5">
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{label}</span>
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-canvas/50 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`rounded-md px-2 py-1 text-[14px] font-semibold transition-colors ${
              value === o.value ? "bg-accent/20 text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShareOption({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors ${
        active
          ? "border-ink/40 bg-canvas/60"
          : "border-edge-soft hover:border-edge hover:bg-canvas/40"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          active ? "border-ink" : "border-edge"
        }`}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
      </span>
      <span className={`mt-0.5 ${active ? "text-ink" : "text-ink-muted"}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16px] font-semibold text-ink">{title}</span>
        <span className="text-[14px] leading-snug text-ink-subtle">{sub}</span>
      </span>
    </button>
  );
}

function TabIcon({ iconKey }: { iconKey: LockableTabMeta["iconKey"] }) {
  switch (iconKey) {
    case "discover":
      return <DiscoverIcon active={false} />;
    case "movies":
      return <MoviesIcon active={false} />;
    case "shows":
      return <TvIcon active={false} />;
    case "anime":
      return <AnimeIcon active={false} />;
    case "sports":
      return <SportsIcon active={false} />;
    case "liveTv":
      return <LiveTvIcon active={false} />;
    case "calendar":
      return <CalendarIcon active={false} />;
    case "library":
      return <LibraryIcon active={false} />;
    case "addons":
      return <AddonsIcon active={false} />;
  }
}

function TabsView({
  initial,
  onBack,
  onSave,
}: {
  initial: HiddenTabs | null;
  onBack: () => void;
  onSave: (next: HiddenTabs) => void;
}) {
  const t = useT();
  const [tabs, setTabs] = useState<HiddenTabs>({ ...DEFAULT_HIDDEN, ...initial });
  const toggle = (key: LockableTab) => setTabs((prev) => ({ ...prev, [key]: !prev[key] }));
  const count = Object.values(tabs).filter(Boolean).length;
  return (
    <div className="flex h-full max-h-[calc(100vh-7rem)] w-full max-w-[560px] flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-ink-muted transition-colors hover:bg-elevated/40 hover:text-ink"
        >
          <ChevronLeft size={14} strokeWidth={2.2} className="dir-icon" />
          {t("common.back")}
        </button>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[13px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
          {t("Sidebar access")}
        </span>
        <h1 className="font-display text-[24px] font-medium tracking-tight text-ink">
          {t("Lock sidebar tabs")}
        </h1>
        <p className="text-center text-[15px] text-ink-muted">
          {t("Locks only activate once a PIN is set.")}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pe-1">
        {LOCKABLE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => toggle(tab.key)}
            aria-pressed={tabs[tab.key]}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-start transition-colors ${
              tabs[tab.key]
                ? "border-ink/40 bg-canvas/60"
                : "border-edge-soft hover:border-edge hover:bg-canvas/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                  tabs[tab.key] ? "border-ink bg-ink text-canvas" : "border-edge"
                }`}
              >
                {tabs[tab.key] && <Check size={12} strokeWidth={3} />}
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center ${
                  tabs[tab.key] ? "text-ink" : "text-ink-muted"
                }`}
              >
                <TabIcon iconKey={tab.iconKey} />
              </span>
              <span className="text-[16px] font-medium text-ink">{t(tab.label)}</span>
            </div>
            {tabs[tab.key] && <Lock size={13} strokeWidth={2.2} className="text-ink-muted" />}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] text-ink-subtle">
          {count === 0 ? t("No tabs selected") : t("{n} selected", { n: count })}
        </span>
        <button
          type="button"
          onClick={() => onSave(tabs)}
          className="h-10 rounded-xl bg-ink px-5 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
