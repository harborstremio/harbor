import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { canStremioWebAuth, startStremioWebAuth } from "@/lib/stremio-auth";

export function StremioWebButton({ onDone, disabled }: { onDone: () => void; disabled?: boolean }) {
  const { signInWithKey } = useAuth();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canStremioWebAuth()) return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const key = await startStremioWebAuth();
      await signInWithKey(key);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy || disabled}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[14.5px] font-semibold text-canvas transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {t("Continue in your browser...")}
          </>
        ) : (
          <>
            {t("Sign in with Stremio")}
            <ExternalLink size={14} />
          </>
        )}
      </button>
      <p className="text-center text-[11.5px] leading-snug text-ink-subtle">
        {t("Opens Stremio in your browser. Works with email, Facebook, and Apple accounts.")}
      </p>
      {error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger">{error}</p>
      )}
    </div>
  );
}
