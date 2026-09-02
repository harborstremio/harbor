import { createPortal } from "react-dom";
import {
  Check,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Lock,
  Palette,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { socialPatch } from "@/lib/social/client";
import {
  audioTimes,
  formatClock,
  parseClockToSec,
  parseProfileAudio,
  setAudioTimes,
} from "@/lib/social/profile-audio";
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
import type {
  Badge,
  FriendsVisibility,
  ProfileSettingsInput,
  ProfileSummary,
} from "./profile-types";
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

function SongTimes({ url, onChange }: { url: string; onChange: (u: string) => void }) {
  const t = useT();
  const parsed = parseProfileAudio(url);
  const songKey = parsed?.url ?? "";
  const [start, setStart] = useState(() => {
    const p = audioTimes(url);
    return p.startSec != null ? formatClock(p.startSec) : "";
  });
  const [end, setEnd] = useState(() => {
    const p = audioTimes(url);
    return p.endSec != null ? formatClock(p.endSec) : "";
  });
  useEffect(() => {
    const p = audioTimes(url);
    setStart(p.startSec != null ? formatClock(p.startSec) : "");
    setEnd(p.endSec != null ? formatClock(p.endSec) : "");
    // Resync only when the song itself changes, not on every start/end keystroke.
  }, [songKey]);
  if (parsed?.provider !== "youtube") return null;
  const commit = (s: string, e: string) =>
    onChange(setAudioTimes(url, parseClockToSec(s), parseClockToSec(e)));
  const box =
    "w-16 rounded-lg bg-elevated px-2 py-1.5 text-center text-[13px] text-ink outline-none ring-1 ring-edge-soft focus:ring-edge";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-subtle">
      <span>{t("Play from")}</span>
      <input
        value={start}
        onChange={(e) => {
          setStart(e.target.value);
          commit(e.target.value, end);
        }}
        placeholder="0:00"
        inputMode="numeric"
        spellCheck={false}
        className={box}
      />
      <span>{t("to")}</span>
      <input
        value={end}
        onChange={(e) => {
          setEnd(e.target.value);
          commit(start, e.target.value);
        }}
        placeholder={t("end")}
        inputMode="numeric"
        spellCheck={false}
        className={box}
      />
      <span className="text-ink-subtle/70">{t("m:ss")}</span>
    </div>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-1 border-b border-edge-soft pb-4">
      <h3 className="font-display text-[19px] text-ink">{title}</h3>
      <p className="max-w-prose text-[13px] leading-relaxed text-ink-subtle">{desc}</p>
    </div>
  );
}

function ActionRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">{desc}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function ShowcaseCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge-soft">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">{desc}</div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function MinecraftPicker({
  name,
  bg,
  onName,
  onBg,
  onClose,
}: {
  name: string;
  bg: string;
  onName: (v: string) => void;
  onBg: (v: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[185] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <button aria-label={t("Close")} className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-edge">
        <div className="flex items-center justify-between border-b border-edge-soft px-6 py-4">
          <h2 className="font-display text-[20px] text-ink">{t("Minecraft")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-elevated"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-[13px] text-ink-muted">
            {t("Show a Minecraft card on your profile. Leave the username blank to hide it.")}
          </p>
          <Field label={t("Username")}>
            <input
              value={name}
              maxLength={16}
              onChange={(e) => onName(e.target.value.trim())}
              className={inputCls}
              placeholder="Notch"
              spellCheck={false}
              autoFocus
            />
          </Field>
          <Field label={t("Background image")} hint={t("optional")}>
            <input
              value={bg}
              maxLength={600}
              onChange={(e) => onBg(e.target.value.trim())}
              className={inputCls}
              placeholder="https://..."
              spellCheck={false}
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-edge-soft px-6 py-4">
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Check size={18} /> {t("Done")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function UrlStatusPill({ status }: { status: UrlStatus }) {
  const t = useT();
  if (status === "checking")
    return (
      <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
        <Loader2 size={12} className="animate-spin" /> {t("Checking")}
      </span>
    );
  if (status === "available")
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium text-success">
        <Check size={12} strokeWidth={2.8} /> {t("Available")}
      </span>
    );
  if (status === "mine") return <span className="text-[12px] text-ink-subtle">{t("Yours")}</span>;
  if (status === "taken")
    return <span className="text-[12px] font-medium text-danger">{t("Taken")}</span>;
  if (status === "invalid") return <span className="text-[12px] text-danger">3-24 a-z 0-9 -</span>;
  return null;
}

const inputCls =
  "w-full min-h-11 rounded-md bg-elevated px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge";

const cardBtn =
  "inline-flex min-h-10 items-center rounded-md bg-canvas/70 px-4 text-[13.5px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-canvas";

type SectionId = "general" | "look" | "showcase" | "privacy";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof UserRound }> = [
  { id: "general", label: "General", icon: UserRound },
  { id: "look", label: "Look", icon: ImageIcon },
  { id: "showcase", label: "Showcase", icon: LayoutGrid },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
];

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
  const initialForm = useRef(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  const [section, setSection] = useState<SectionId>("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingLists, setPickingLists] = useState(false);
  const [pickingFav, setPickingFav] = useState<FavoriteKind | null>(null);
  const [pickingBadges, setPickingBadges] = useState(false);
  const [pickingStats, setPickingStats] = useState(false);
  const [pickingCards, setPickingCards] = useState(false);
  const [pickingMinecraft, setPickingMinecraft] = useState(false);
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
  }, [section]);

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
      setError(t("Could not update privacy. Try again."));
    }
  };

  const save = async (after?: () => void) => {
    if (!form.alias.trim()) {
      setSection("general");
      setError(t("Add a display name first. It is the name shown on your profile."));
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (urlBlocked) return setError(t("That custom url is not available."));
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
      setError(t("Could not save. Try again."));
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

  const friendsVisibilityOpts: Array<{ id: FriendsVisibility; label: string; icon: typeof Globe }> =
    [
      { id: "everyone", label: t("Everyone"), icon: Globe },
      { id: "friends", label: t("Friends"), icon: Users },
      { id: "only_me", label: t("Only me"), icon: Lock },
    ];

  return (
    <>
      <div className="flex h-full flex-col pt-20">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-soft bg-canvas px-6 py-3 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="font-display text-[20px] text-ink">{t("Edit profile")}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated"
            >
              {t("Cancel")}
            </button>
            {(isDirty || saving) && (
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Check size={18} /> {saving ? t("Saving") : t("Save")}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-edge-soft px-4 py-2.5 md:hidden">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const on = id === section;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  on ? "bg-raised text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-elevated/70"
                }`}
              >
                <Icon size={15} strokeWidth={1.9} />
                {t(label)}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-[212px] shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 md:flex">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = id === section;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`group flex h-14 w-full items-center gap-3 rounded-xl px-2.5 text-start transition-colors ${
                    isActive
                      ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-edge)]"
                      : "text-ink-muted hover:bg-elevated/70 hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--color-edge-soft)]"
                        : "bg-canvas/60 text-ink-subtle group-hover:text-ink-muted"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.7} />
                  </span>
                  <span className="flex-1 truncate text-[14.5px] font-medium">{t(label)}</span>
                </button>
              );
            })}
          </nav>

          <div ref={bodyRef} className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-7 lg:px-10">
              {error && (
                <div className="mb-5 rounded-xl bg-elevated px-4 py-3 text-[13px] font-medium text-danger ring-1 ring-edge-soft">
                  {error}
                </div>
              )}

              <div key={section} className="animate-step-in">
                {section === "general" && (
                  <div className="space-y-5">
                    <SectionHead
                      title={t("General")}
                      desc={t("Your name and the details shown at the top of your profile.")}
                    />

                    <Field label={t("Alias")} hint={`${form.alias.length}/32`}>
                      <input
                        value={form.alias}
                        maxLength={32}
                        onChange={(e) => set("alias", e.target.value)}
                        className={inputCls}
                        placeholder={t("Display name")}
                      />
                    </Field>

                    <Field label={t("Status")} hint={t("Shows as a bubble on your profile")}>
                      <input
                        value={form.slogan}
                        maxLength={100}
                        onChange={(e) => set("slogan", e.target.value)}
                        className={inputCls}
                        placeholder={t("Here for the late-night sci-fi")}
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("Pronouns")} hint={t("optional")}>
                        <input
                          value={form.pronouns}
                          maxLength={32}
                          onChange={(e) => set("pronouns", e.target.value)}
                          className={inputCls}
                          placeholder={t("they/them")}
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                      </Field>

                      <Field label={t("Location")}>
                        <LocationSelect
                          value={form.location}
                          onChange={(c) => set("location", c)}
                        />
                      </Field>
                    </div>

                    <Field label={t("Custom url")} hint="harbor.site/u/">
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

                    <Field
                      label={t("Profile song")}
                      hint={t("YouTube, SoundCloud or Spotify link")}
                    >
                      <input
                        value={form.audioUrl}
                        maxLength={400}
                        onChange={(e) => set("audioUrl", e.target.value.trim())}
                        className={inputCls}
                        placeholder="https://youtu.be/..."
                        spellCheck={false}
                      />
                      <SongTimes url={form.audioUrl} onChange={(u) => set("audioUrl", u)} />
                    </Field>

                    <Field label={t("About")}>
                      <AboutEditor
                        value={form.description}
                        onChange={(v) => set("description", v)}
                      />
                    </Field>
                  </div>
                )}

                {section === "look" && (
                  <div className="space-y-5">
                    <SectionHead
                      title={t("Look")}
                      desc={t("Your avatar, banner, and how the whole profile is styled.")}
                    />

                    <ProfileMedia summary={summary} onSaved={onSaved} />

                    <ActionRow
                      title={t("Customize profile")}
                      desc={t("Custom font, page background, and a freeform HTML/CSS canvas")}
                    >
                      <button
                        type="button"
                        onClick={() => setCustomizing(true)}
                        className={`${cardBtn} gap-1.5`}
                      >
                        <Palette size={16} /> {t("Customize")}
                      </button>
                    </ActionRow>

                    {onArrange && (
                      <ActionRow
                        title={t("Arrange cards")}
                        desc={t("Reorder or hide the cards on your profile")}
                      >
                        <button
                          type="button"
                          onClick={() => void save(onArrange)}
                          disabled={saving}
                          className={`${cardBtn} gap-1.5 disabled:opacity-40`}
                        >
                          <LayoutGrid size={16} /> {t("Arrange")}
                        </button>
                      </ActionRow>
                    )}
                  </div>
                )}

                {section === "showcase" && (
                  <div className="space-y-5">
                    <SectionHead
                      title={t("Showcase")}
                      desc={t("Pick what appears on your profile, and the order it shows in.")}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ShowcaseCard
                        title={t("Featured lists")}
                        desc={t("Show up to 6 of your lists on your profile")}
                      >
                        <button
                          type="button"
                          onClick={() => setPickingLists(true)}
                          className={cardBtn}
                        >
                          {t("Manage")}
                        </button>
                      </ShowcaseCard>

                      <ShowcaseCard
                        title={t("Favourites")}
                        desc={t("Show your favourite games, books and music on your profile")}
                      >
                        <button
                          type="button"
                          onClick={() => setPickingFav("game")}
                          className={cardBtn}
                        >
                          {t("Games")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickingFav("book")}
                          className={cardBtn}
                        >
                          {t("Books")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickingFav("music")}
                          className={cardBtn}
                        >
                          {t("Music")}
                        </button>
                      </ShowcaseCard>

                      {canPickBadges && (
                        <ShowcaseCard
                          title={t("Shown badges")}
                          desc={t("Choose which badges appear by your name, and their order")}
                        >
                          <button
                            type="button"
                            onClick={() => setPickingBadges(true)}
                            className={cardBtn}
                          >
                            {t("Choose")}
                          </button>
                        </ShowcaseCard>
                      )}

                      <ShowcaseCard
                        title={t("Hero stats")}
                        desc={t("Choose which stats show in the row at the top of your profile")}
                      >
                        <button
                          type="button"
                          onClick={() => setPickingStats(true)}
                          className={cardBtn}
                        >
                          {t("Choose")}
                        </button>
                      </ShowcaseCard>

                      <ShowcaseCard
                        title={t("Profile cards")}
                        desc={t(
                          "Pick which cards show on your profile, and the order they appear in",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setPickingCards(true)}
                          className={cardBtn}
                        >
                          {t("Choose")}
                        </button>
                      </ShowcaseCard>

                      <ShowcaseCard
                        title={t("Minecraft")}
                        desc={
                          form.minecraftName
                            ? t("Showing {name}", { name: form.minecraftName })
                            : t("Show a Minecraft card with your username")
                        }
                      >
                        <button
                          type="button"
                          onClick={() => setPickingMinecraft(true)}
                          className={cardBtn}
                        >
                          {t("Choose")}
                        </button>
                      </ShowcaseCard>
                    </div>
                  </div>
                )}

                {section === "privacy" && (
                  <div className="space-y-3">
                    <SectionHead
                      title={t("Privacy")}
                      desc={t("Control who can see your friends, activity, and stats.")}
                    />

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {t("Private profile")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">
                          {t(
                            "Only you can see your friends, badges, activity, and comments. Your name and avatar stay visible.",
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.private}
                        aria-label={t("Private profile")}
                        onClick={() => void togglePrivate()}
                        style={{ minHeight: 0 }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.private ? "bg-accent" : "bg-edge"}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.private ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>

                    <div className="rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {t("Friends list")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">
                          {t("Choose who can see the friends on your profile")}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {friendsVisibilityOpts.map((o) => {
                          const on = form.friendsVisibility === o.id;
                          const Icon = o.icon;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => set("friendsVisibility", o.id)}
                              className={`flex flex-col items-center gap-1 rounded-md border p-2.5 text-center transition-colors ${
                                on
                                  ? "border-ink bg-surface"
                                  : "border-edge-soft bg-surface/40 hover:border-edge"
                              }`}
                            >
                              <Icon size={16} className={on ? "text-ink" : "text-ink-subtle"} />
                              <span className="text-[12.5px] font-semibold text-ink">
                                {o.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {t("Share watch activity")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">
                          {t("Off by default. Let visitors see what you have been watching")}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.shareActivity}
                        aria-label={t("Share watch activity")}
                        onClick={() => set("shareActivity", !form.shareActivity)}
                        style={{ minHeight: 0 }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${form.shareActivity ? "bg-accent" : "bg-edge"}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.shareActivity ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {t("Share live watching status")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">
                          {t(
                            "Off by default. Show what you are watching right now, or your watch party, on your profile. Applies instantly",
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings.shareWatchPresence}
                        aria-label={t("Share live watching status")}
                        onClick={() =>
                          updateSettings({ shareWatchPresence: !settings.shareWatchPresence })
                        }
                        style={{ minHeight: 0 }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${settings.shareWatchPresence ? "bg-accent" : "bg-edge"}`}
                      >
                        <span
                          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.shareWatchPresence ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-4 py-3.5 ring-1 ring-edge-soft">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {t("Show your Simkl card")}
                        </div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-subtle">
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
                  </div>
                )}
              </div>
            </div>
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
      {pickingMinecraft && (
        <MinecraftPicker
          name={form.minecraftName}
          bg={form.minecraftBg}
          onName={(v) => set("minecraftName", v)}
          onBg={(v) => set("minecraftBg", v)}
          onClose={() => setPickingMinecraft(false)}
        />
      )}
    </>
  );
}
