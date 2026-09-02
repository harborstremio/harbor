import { useState } from "react";
import { Check, ImagePlus, KeyRound, Loader2, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { changeAuthorPassword, logoutAuthor, type Author } from "@/lib/theme-auth";
import { removeAvatar as removeEcosystemAvatar, uploadAvatar } from "@/lib/social/avatar";
import { markAvatarSynced } from "@/lib/account/avatar-sync";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { TextField } from "../field";

export type AuthorStats = {
  published: number;
  downloads: number;
  rating: number | null;
  inReview: number;
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function SignedInBar({ author, stats }: { author: Author; stats?: AuthorStats }) {
  const t = useT();
  const [signingOut, setSigningOut] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await logoutAuthor();
  };

  const initials = author.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-md bg-elevated">
      <div className="relative flex flex-wrap items-center gap-4 p-6">
        {author.avatar ? (
          <img src={author.avatar} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-canvas text-[20px] font-bold tracking-tight text-ink-muted">
            {initials}
          </span>
        )}
        <div className="mr-auto flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-[22px] font-semibold tracking-tight text-ink">
              {author.username}
            </span>
            {author.handle && (
              <span className="truncate font-display text-[13.5px] font-medium text-ink-subtle">
                @{author.handle}
              </span>
            )}
          </div>
          <span className="text-[12.5px] text-ink-subtle">
            {t("Theme author. Your published themes are tied to this account.")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AvatarButton author={author} />
          <button
            onClick={() => setPwOpen((v) => !v)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold ring-1 transition-colors ${
              pwOpen
                ? "bg-elevated text-ink ring-edge"
                : "text-ink-muted ring-edge-soft hover:text-ink hover:ring-edge"
            }`}
          >
            <KeyRound size={14} strokeWidth={2.2} /> {t("Change password")}
          </button>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-danger hover:ring-danger disabled:opacity-50"
          >
            {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}{" "}
            {t("Sign out")}
          </button>
        </div>
      </div>

      {stats && <StatsStrip stats={stats} />}

      {pwOpen && (
        <div className="relative border-t border-edge-soft p-6">
          <ChangePassword onDone={() => setPwOpen(false)} />
        </div>
      )}
    </div>
  );
}

function AvatarButton({ author }: { author: Author }) {
  const t = useT();
  const { activeProfile, updateProfile } = useProfiles();
  const { update: updateSettings } = useSettings();
  const [busy, setBusy] = useState<"set" | "remove" | null>(null);
  const profileAvatar = activeProfile?.avatar ?? null;

  const use = async () => {
    if (!profileAvatar) return;
    setBusy("set");
    try {
      const blob = await (await fetch(profileAvatar)).blob();
      await uploadAvatar(blob);
      markAvatarSynced(profileAvatar);
    } catch {
      void 0;
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("remove");
    try {
      await removeEcosystemAvatar();
      updateSettings({ harborAvatar: null });
      if (activeProfile) updateProfile(activeProfile.id, { avatar: null });
      markAvatarSynced(null);
    } catch {
      void 0;
    } finally {
      setBusy(null);
    }
  };

  const hint = !profileAvatar ? t("Set a Harbor profile picture first") : undefined;

  if (author.avatar) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={use}
          disabled={busy != null || !profileAvatar}
          title={hint ?? t("Re-sync from your Harbor profile picture")}
          className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink hover:ring-edge disabled:opacity-50"
        >
          {busy === "set" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} strokeWidth={2.2} />
          )}{" "}
          {t("Update photo")}
        </button>
        <button
          onClick={remove}
          disabled={busy != null}
          aria-label={t("Remove community photo")}
          title={t("Remove your community photo")}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas text-ink-muted transition-colors hover:text-danger hover:ring-danger disabled:opacity-50"
        >
          {busy === "remove" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} strokeWidth={2.2} />
          )}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={use}
      disabled={busy != null || !profileAvatar}
      title={hint ?? t("Show your Harbor profile picture on the community")}
      className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink hover:ring-edge disabled:opacity-50"
    >
      {busy === "set" ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <ImagePlus size={14} strokeWidth={2.2} />
      )}{" "}
      {t("Use my photo")}
    </button>
  );
}

function StatsStrip({ stats }: { stats: AuthorStats }) {
  const t = useT();
  const cells = [
    { label: "Published", value: String(stats.published) },
    { label: "Downloads", value: fmtNum(stats.downloads) },
    { label: "Avg rating", value: stats.rating != null ? stats.rating.toFixed(1) : "—" },
    { label: "In review", value: String(stats.inReview) },
  ];
  return (
    <div className="relative grid grid-cols-2 gap-px border-t border-edge-soft bg-edge-soft/50 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-0.5 bg-surface px-6 py-4">
          <span className="text-[23px] font-semibold tabular-nums leading-none tracking-tight text-ink">
            {c.value}
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t(c.label)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = oldPassword.length > 0 && newPassword.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await changeAuthorPassword(oldPassword, newPassword);
      setDone(true);
      setTimeout(onDone, 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("Current password")}
          type="password"
          value={oldPassword}
          onChange={setOldPassword}
          maxLength={200}
        />
        <TextField
          label={t("New password")}
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder={t("At least 8 characters")}
          maxLength={200}
        />
      </div>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!ready || busy || done}
          className={`flex h-10 items-center gap-1.5 rounded-[8px] px-4 text-[13px] font-semibold transition-opacity disabled:opacity-40 ${
            done ? "bg-success text-canvas" : "bg-ink text-canvas hover:opacity-90"
          }`}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : done ? (
            <Check size={14} className="harbor-pop" />
          ) : null}
          {done ? t("Password updated") : t("Update password")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-[8px] px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
