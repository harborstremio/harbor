import { Check, Loader2, Plus, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n";
import { jlAccountsConfigured, signInJl, signOutJl, useJlSession } from "@/lib/jl/account/client";
import {
  createJlProfile,
  linkJlProfile,
  listJlProfiles,
  syncNow,
  unlinkJlProfile,
  useJlLink,
  type JlProfile,
} from "@/lib/jl/account/sync";
import { JlDialog } from "./jl-dialog";

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const session = useJlSession();
  const link = useJlLink();
  return (
    <JlDialog title={t("JL account")} onClose={onClose}>
      {!jlAccountsConfigured() ? (
        <p className="text-[13px] text-ink-muted">{t("JL accounts aren't set up in this build.")}</p>
      ) : !session ? (
        <SignInForm />
      ) : !link ? (
        <ProfilePicker />
      ) : (
        <Linked name={link.name} email={session.email} />
      )}
    </JlDialog>
  );
}

function SignInForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInJl(email, password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {t("Sign in to keep your teams, players and favorites the same on every device.")}
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("Email")}
        autoComplete="email"
        className="h-11 rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none focus:border-ink-subtle"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("Password")}
        autoComplete="current-password"
        className="h-11 rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none focus:border-ink-subtle"
      />
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy || !email.trim() || !password}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-canvas disabled:opacity-50"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {t("Sign in")}
      </button>
    </form>
  );
}

function ProfilePicker() {
  const t = useT();
  const [profiles, setProfiles] = useState<JlProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listJlProfiles()
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch(() => {
        if (!cancelled) setError(t("This account isn't a JL household member yet, or JL is unreachable."));
      });
    return () => {
      cancelled = true;
    };
    // Loads once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      linkJlProfile(await createJlProfile(newName));
    } catch {
      setError(t("The profile could not be created (an account has at most 6)."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-muted">{t("Which JL profile is this?")}</p>
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      {!profiles && !error && <Loader2 size={16} className="animate-spin text-ink-subtle" />}
      {profiles?.map((p) => (
        <button
          key={p.id}
          onClick={() => linkJlProfile(p)}
          className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5 text-start text-[14px] text-ink hover:border-edge focus:border-ink-subtle focus:outline-none"
        >
          <UserRound size={16} className="text-ink-subtle" />
          {p.name}
        </button>
      ))}
      {profiles && (
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("New profile name")}
            maxLength={40}
            className="h-10 flex-1 rounded-xl border border-edge bg-canvas px-3 text-[13.5px] text-ink outline-none focus:border-ink-subtle"
          />
          <button
            onClick={() => void create()}
            disabled={busy || !newName.trim()}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13px] font-semibold text-canvas disabled:opacity-50"
          >
            <Plus size={14} />
            {t("Create")}
          </button>
        </div>
      )}
      <button onClick={() => void signOutJl()} className="self-start text-[12.5px] text-ink-subtle hover:text-ink">
        {t("Sign out")}
      </button>
    </div>
  );
}

function Linked({ name, email }: { name: string; email: string | null }) {
  const t = useT();
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-[13.5px] text-ink">
        <Check size={15} className="text-accent" />
        {t("Syncing with {profile}", { profile: name })}
      </p>
      {email && <p className="text-[12.5px] text-ink-subtle">{email}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setSyncing(true);
            void syncNow().finally(() => setSyncing(false));
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink"
        >
          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
          {t("Sync now")}
        </button>
        <button
          onClick={unlinkJlProfile}
          className="flex h-9 items-center rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink"
        >
          {t("Change profile")}
        </button>
        <button
          onClick={() => {
            unlinkJlProfile();
            void signOutJl();
          }}
          className="flex h-9 items-center rounded-lg border border-edge px-3 text-[12.5px] font-semibold text-ink-muted"
        >
          {t("Sign out")}
        </button>
      </div>
    </div>
  );
}
