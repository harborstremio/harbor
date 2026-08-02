import { Check, Globe, LayoutGrid, Loader2, Lock, Palette, Users } from "lucide-react";
import { socialPatch } from "@/lib/social/client";
import { useEffect, useRef, useState } from "react";
import { useTogether } from "@/lib/together/provider";
import { useProfiles } from "@/lib/profiles";
import { nameEquals } from "@/lib/account/name-sync";
import { setPrivate } from "@/lib/social/privacy";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { saveSettings } from "./profile-api";
import { MyListsPicker } from "./my-lists-picker";
import { FavoritesPicker } from "./favorites-picker";
import { ShownBadgesPicker, pickableBadges } from "./shown-badges-picker";
import { HeroStatsPicker } from "./hero-stats-picker";
import { ProfileCardsPicker } from "./profile-cards-picker";
import { ProfileMedia } from "./profile-media";
import { LocationSelect } from "./location-select";
import { CustomizationPanel } from "./customization/customization-panel";
import { AboutEditor } from "./customization/about-editor";
import { useCustomUrlAvailability, type UrlStatus } from "./use-customurl-availability";
import type { Badge, FriendsVisibility, ProfileSettingsInput, ProfileSummary } from "./profile-types";
import type { FavoriteKind } from "./use-favorites";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[12px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function UrlStatusPill({ status }: { status: UrlStatus }) {
  if (status === "checking")
    return (
      <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
        <Loader2 size={12} className="animate-spin" /> Checking
      </span>
    );
  if (status === "available")
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium text-success">
        <Check size={12} strokeWidth={2.8} /> Available
      </span>
    );
  if (status === "mine") return <span className="text-[12px] text-ink-subtle">Yours</span>;
  if (status === "taken") return <span className="text-[12px] font-medium text-danger">Taken</span>;
  if (status === "invalid") return <span className="text-[12px] text-danger">3-24 a-z 0-9 -</span>;
  return null;
}

const inputCls =
  "w-full min-h-11 rounded-[10px] bg-elevated px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

export function ProfileSettings({
  summary,
  badges,
  onClose,
  onSaved,
  onArrange,
}: {
  summary: ProfileSummary;
  badges?: Badge[];
  onClose: () => void;
  onSaved: (next: ProfileSummary) => void;
  onArrange?: () => void;
}) {
  const t = useT();
  const { displayName, setDisplayName } = useTogether();
  const { activeProfile, updateProfile } = useProfiles();
  const { settings, update: updateSettings } = useSettings();
  const [form, setForm] = useState<ProfileSettingsInput>({
    alias: summary.alias?.trim() || summary.handle || "",
    description: summary.description ?? "",
    location: summary.location ?? "",
    pronouns: summary.pronouns ?? "",
    customUrl: summary.customUrl ?? "",
    slogan: summary.slogan ?? "",
    audioUrl: summary.audioUrl ?? "",
    minecraftName: summary.minecraftName ?? "",
    minecraftBg: summary.minecraftBg ?? "",
    shareActivity: summary.shareActivity ?? false,
    friendsVisibility: summary.friendsVisibility ?? "everyone",
    private: summary.private ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingLists, setPickingLists] = useState(false);
  const [pickingFav, setPickingFav] = useState<FavoriteKind | null>(null);
  const [pickingBadges, setPickingBadges] = useState(false);
  const [pickingStats, setPickingStats] = useState(false);
  const [pickingCards, setPickingCards] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const badgeOptions = pickableBadges(badges ?? []);
  const canPickBadges =
    badgeOptions.length > 0 || summary.verified || summary.hideVerified === true;
  const bodyRef = useRef<HTMLDivElement>(null);
  const urlStatus = useCustomUrlAvailability(
    form.customUrl,
    summary.handle,
    summary.customUrl ?? "",
  );

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const set = <K extends keyof ProfileSettingsInput>(k: K, v: ProfileSettingsInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const urlBlocked = urlStatus === "taken" || urlStatus === "invalid";

  const togglePrivate = async () => {
    const next = !form.private;
    set("private", next);
    try {
      const s = await setPrivate(next);
      onSaved(s);
    } catch {
      set("private", !next);
      setError("Could not update privacy. Try again.");
    }
  };

  const save = async (after?: () => void) => {
    if (!form.alias.trim()) {
      setError("Add a display name first. It is the name shown on your profile.");
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (urlBlocked) return setError("That custom url is not available.");
    setSaving(true);
    setError(null);
    try {
      const next = await saveSettings(form);
      const trimmed = form.alias.trim();
      if (trimmed && !nameEquals(trimmed, displayName)) setDisplayName(trimmed);
      if (activeProfile && !activeProfile.kid && trimmed && trimmed !== activeProfile.name) {
        updateProfile(activeProfile.id, { name: trimmed });
      }
      onSaved(next);
      (after ?? onClose)();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (customizing) {
    return (
      <CustomizationPanel
        summary={summary}
        onClose={() => setCustomizing(false)}
        onSaved={onSaved}
      />
    );
  }

  const friendsVisibilityOpts: Array<{ id: FriendsVisibility; label: string; icon: typeof Globe }> = [
    { id: "everyone", label: t("Everyone"), icon: Globe },
    { id: "friends", label: t("Friends"), icon: Users },
    { id: "only_me", label: t("Only me"), icon: Lock },
  ];

  return (
    <>
      <div className="flex h-full flex-col pt-20">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-soft bg-canvas px-6 py-3 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="font-display text-[20px] text-ink">Edit profile</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Check size={18} /> {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4 px-6 py-6 lg:px-10">
            <ProfileMedia summary={summary} onSaved={onSaved} />

            <Field label="Alias" hint={`${form.alias.length}/32`}>
              <input
                value={form.alias}
                maxLength={32}
                onChange={(e) => set("alias", e.target.value)}
                className={inputCls}
                placeholder="Display name"
              />
            </Field>

            <Field label="Status" hint="Shows as a bubble on your profile">
              <input
                value={form.slogan}
                maxLength={100}
                onChange={(e) => set("slogan", e.target.value)}
                className={inputCls}
                placeholder="Here for the late-night sci-fi"
              />
            </Field>

            <Field label="Profile song" hint="YouTube, SoundCloud or Spotify link">
              <input
                value={form.audioUrl}
                maxLength={400}
                onChange={(e) => set("audioUrl", e.target.value.trim())}
                className={inputCls}
                placeholder="https://youtu.be/..."
                spellCheck={false}
              />
            </Field>

            <Field label="Minecraft" hint="Your username. Leave blank to hide the card.">
              <div className="flex flex-col gap-2.5">
                <input
                  value={form.minecraftName}
                  maxLength={16}
                  onChange={(e) => set("minecraftName", e.target.value.trim())}
                  className={inputCls}
                  placeholder="Notch"
                  spellCheck={false}
                />
                <input
                  value={form.minecraftBg}
                  maxLength={600}
                  onChange={(e) => set("minecraftBg", e.target.value.trim())}
                  className={inputCls}
                  placeholder="https://... background image (optional)"
                  spellCheck={false}
                />
              </div>
            </Field>

            <Field label="About">
              <AboutEditor value={form.description} onChange={(v) => set("description", v)} />
            </Field>

            <Field label="Pronouns" hint="optional">
              <input
                value={form.pronouns}
                maxLength={32}
                onChange={(e) => set("pronouns", e.target.value)}
                className={inputCls}
                placeholder="they/them"
                autoCapitalize="off"
                spellCheck={false}
              />
            </Field>

            <Field label="Location">
              <LocationSelect value={form.location} onChange={(c) => set("location", c)} />
            </Field>

            <Field label="Custom url" hint="harbor.site/u/">
              <div className="relative">
                <input
                  value={form.customUrl}
                  maxLength={24}
                  onChange={(e) => set("customUrl", e.target.value.toLowerCase())}
                  className={`${inputCls} pe-28 ${urlBlocked ? "ring-danger" : ""}`}
                  placeholder="your-handle"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
                  <UrlStatusPill status={urlStatus} />
                </span>
              </div>
            </Field>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">Featured lists</div>
                <div className="text-[12px] text-ink-subtle">
                  Show up to 6 of your lists on your profile
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickingLists(true)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
              >
                Manage
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{t("Favourites")}</div>
                <div className="text-[12px] text-ink-subtle">
                  {t("Show your favourite games, books and music on your profile")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickingFav("game")}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
                >
                  {t("Games")}
                </button>
                <button
                  type="button"
                  onClick={() => setPickingFav("book")}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
                >
                  {t("Books")}
                </button>
                <button
                  type="button"
                  onClick={() => setPickingFav("music")}
                  className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
                >
                  {t("Music")}
                </button>
              </div>
            </div>

            {canPickBadges && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">Shown badges</div>
                  <div className="text-[12px] text-ink-subtle">
                    Choose which badges appear by your name, and their order
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickingBadges(true)}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
                >
                  Choose
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{t("Hero stats")}</div>
                <div className="text-[12px] text-ink-subtle">
                  {t("Choose which stats show in the row at the top of your profile")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickingStats(true)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
              >
                {t("Choose")}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{t("Profile cards")}</div>
                <div className="text-[12px] text-ink-subtle">
                  {t("Pick which cards show on your profile, and the order they appear in")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickingCards(true)}
                className="inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
              >
                {t("Choose")}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">Customize profile</div>
                <div className="text-[12px] text-ink-subtle">
                  Custom font, page background, and a freeform HTML/CSS canvas
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(true)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated"
              >
                <Palette size={16} /> Customize
              </button>
            </div>

            {onArrange && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">Arrange cards</div>
                  <div className="text-[12px] text-ink-subtle">
                    Reorder or hide the cards on your profile
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void save(onArrange)}
                  disabled={saving}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-[14px] font-medium text-ink ring-1 ring-edge-soft hover:bg-elevated disabled:opacity-40"
                >
                  <LayoutGrid size={16} /> Arrange
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">Private profile</div>
                <div className="text-[12px] text-ink-subtle">
                  Only you can see your friends, badges, activity, and comments. Your name and
                  avatar stay visible.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.private}
                aria-label="Private profile"
                onClick={() => void togglePrivate()}
                style={{ minHeight: 0 }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.private ? "bg-accent" : "bg-edge"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.private ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="rounded-[10px] bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{t("Friends list")}</div>
                <div className="text-[12px] text-ink-subtle">
                  {t("Choose who can see the friends on your profile")}
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {friendsVisibilityOpts.map((o) => {
                  const on = form.friendsVisibility === o.id;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => set("friendsVisibility", o.id)}
                      className={`flex flex-col items-center gap-1 rounded-[10px] border p-2.5 text-center transition-colors ${
                        on ? "border-ink bg-surface" : "border-edge-soft bg-surface/40 hover:border-edge"
                      }`}
                    >
                      <Icon size={16} className={on ? "text-ink" : "text-ink-subtle"} />
                      <span className="text-[12.5px] font-semibold text-ink">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">Share watch activity</div>
                <div className="text-[12px] text-ink-subtle">
                  Off by default. Let visitors see what you have been watching
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.shareActivity}
                aria-label="Share watch activity"
                onClick={() => set("shareActivity", !form.shareActivity)}
                style={{ minHeight: 0 }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.shareActivity ? "bg-accent" : "bg-edge"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.shareActivity ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">Share live watching status</div>
                <div className="text-[12px] text-ink-subtle">
                  Off by default. Show what you are watching right now, or your watch party, on your
                  profile. Applies instantly
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.shareWatchPresence}
                aria-label="Share live watching status"
                onClick={() => updateSettings({ shareWatchPresence: !settings.shareWatchPresence })}
                style={{ minHeight: 0 }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${settings.shareWatchPresence ? "bg-accent" : "bg-edge"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.shareWatchPresence ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-elevated px-3 py-2.5 ring-1 ring-edge-soft">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink">{t("Show your Simkl card")}</div>
                <div className="text-[12px] text-ink-subtle">
                  {t(
                    "Off by default. Shows your Simkl avatar, name and watch stats on your profile for anyone who visits. Manage the connection itself in Settings, Simkl.",
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showSimklCard}
                aria-label={t("Show your Simkl card")}
                onClick={() => {
                  const next = !settings.showSimklCard;
                  updateSettings({ showSimklCard: next });
                  if (!next)
                    void socialPatch("/social/me/profile", { simkl: null }).catch(() => {});
                }}
                style={{ minHeight: 0 }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${settings.showSimklCard ? "bg-accent" : "bg-edge"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.showSimklCard ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {error && <p className="text-[13px] text-danger">{error}</p>}
          </div>
        </div>
      </div>
      {pickingLists && <MyListsPicker onClose={() => setPickingLists(false)} />}
      {pickingFav && (
        <FavoritesPicker
          kind={pickingFav}
          initial={{
            game: summary.favorites?.game ?? [],
            book: summary.favorites?.book ?? [],
            music: summary.favorites?.music ?? [],
          }}
          onClose={() => setPickingFav(null)}
          onSaved={onSaved}
        />
      )}
      {pickingBadges && (
        <ShownBadgesPicker
          badges={badges ?? []}
          current={summary.shownBadges ?? []}
          hideVerified={summary.hideVerified === true}
          onClose={() => setPickingBadges(false)}
          onSaved={onSaved}
        />
      )}
      {pickingStats && (
        <HeroStatsPicker
          summary={summary}
          onClose={() => setPickingStats(false)}
          onSaved={onSaved}
        />
      )}
      {pickingCards && (
        <ProfileCardsPicker
          summary={summary}
          onClose={() => setPickingCards(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
