import { ROW_ACTION } from "../kit";
import { useMemo, useState } from "react";
import { LogIn } from "lucide-react";
import stremioWordmark from "@/assets/stremio-wordmark.png";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

export function StremioCard() {
  const t = useT();
  const { user, signOut } = useAuth();
  const [reveal, setReveal] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const maskedEmail = useMemo(() => {
    if (!user?.email) return "";
    const [local, domain] = user.email.split("@");
    if (!domain) return "*****";
    return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 4))}@${domain}`;
  }, [user]);

  if (!user) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-md bg-elevated px-5 py-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-canvas text-ink-subtle">
            <LogIn size={20} strokeWidth={2} />
          </span>
          <span className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-[19px] font-semibold leading-tight tracking-tight text-ink">
              {t("Not signed in")}
            </span>
            <span className="text-[12.5px] leading-snug text-ink-subtle">
              {t("Sign in to sync your library, watch progress, and addons.")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowAuth(true)}
            className="harbor-press-pop flex h-9 shrink-0 items-center rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas"
          >
            {t("Sign in")}
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-md bg-elevated px-5 py-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <img
            src={stremioWordmark}
            alt="Stremio"
            className="pointer-events-none h-7 w-auto shrink-0 opacity-45 select-none"
            style={{ filter: "invert(1) grayscale(1) brightness(1.1)" }}
            draggable={false}
          />
          <span className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="truncate font-mono text-[16px] font-medium leading-tight text-ink">
              {reveal ? user.email : maskedEmail}
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] leading-snug text-ink-subtle">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              {t("Library, watch progress, and addons are syncing.")}
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setReveal((v) => !v)} className={ROW_ACTION}>
              {reveal ? t("Hide") : t("Reveal")}
            </button>
            <button type="button" onClick={() => setShowAuth(true)} className={ROW_ACTION}>
              {t("Re-authenticate")}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="harbor-press-pop flex h-9 shrink-0 items-center rounded-md bg-canvas px-3.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-danger"
            >
              {t("Sign out")}
            </button>
          </span>
        </div>

        <span className="flex flex-wrap items-baseline gap-2 text-[11.5px] text-ink-subtle">
          <span className="font-bold uppercase tracking-[0.16em]">{t("Stremio ID")}</span>
          <span className="truncate font-mono text-ink-muted">{user._id}</span>
        </span>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
