import { useState } from "react";
import { Check, ImagePlus, KeyRound, Loader2, LogOut, RefreshCw, Trash2 } from "../../../icons";
import { useT } from "@/lib/i18n";
import { changeAuthorPassword, logoutAuthor, type Author } from "@/lib/theme-auth";
import { removeAvatar as removeEcosystemAvatar, uploadAvatar } from "@/lib/social/avatar";
import { markAvatarSynced } from "@/lib/account/avatar-sync";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY } from "../../../kit";
import { ROW_DESC, RowNote } from "../../../shared";
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
        <div className="me-auto flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-[22px] font-semibold tracking-tight text-ink">
              {author.username}
            </span>
            {author.handle && (
              <span className="truncate font-display text-[15.5px] font-medium leading-[22px] text-ink-subtle">
                @{author.handle}
              </span>
            )}
          </div>
          <span className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("Theme author. Your published themes are tied to this account.")}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AvatarButton author={author} />
          <button onClick={() => setPwOpen((v) => !v)} className={ROW_ACTION}>
            <KeyRound size={18} strokeWidth={2.2} /> {t("Change password")}
          </button>
          <button onClick={signOut} disabled={signingOut} className={ROW_ACTION_DANGER}>
            {signingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}{" "}
            {t("Sign out")}
          </button>
        </div>
      </div>

      {stats && <StatsStrip stats={stats} />}

      {pwOpen && (
        <div className="relative p-6">
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={use}
          disabled={busy != null || !profileAvatar}
          title={hint ?? t("Re-sync from your Harbor profile picture")}
          className={ROW_ACTION}
        >
          {busy === "set" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <RefreshCw size={18} strokeWidth={2.2} />
          )}{" "}
          {t("Update photo")}
        </button>
        <button
          onClick={remove}
          disabled={busy != null}
          aria-label={t("Remove community photo")}
          title={t("Remove your community photo")}
          className={`${ROW_ACTION_DANGER} justify-center`}
        >
          {busy === "remove" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Trash2 size={18} strokeWidth={2.2} />
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
      className={ROW_ACTION}
    >
      {busy === "set" ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <ImagePlus size={18} strokeWidth={2.2} />
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
    { label: "Avg rating", value: stats.rating != null ? stats.rating.toFixed(1) : t("None") },
    { label: "In review", value: String(stats.inReview) },
  ];
  return (
    <div className="relative grid grid-cols-2 gap-px bg-edge-soft/50 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1 bg-surface px-6 py-4">
          <span className="text-[23px] font-semibold leading-none tracking-tight tabular-nums text-ink">
            {c.value}
          </span>
          <span className="harbor-settings-label">{t(c.label)}</span>
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
      {error && <RowNote>{error}</RowNote>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!ready || busy || done}
          style={done ? { background: "var(--color-success)" } : undefined}
          className={ROW_ACTION_PRIMARY}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : done ? (
            <Check size={18} className="harbor-pop" />
          ) : null}
          {done ? t("Password updated") : t("Update password")}
        </button>
        <button type="button" onClick={onDone} className={ROW_ACTION}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
