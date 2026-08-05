import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAuthor, type Author } from "@/lib/theme-auth";
import { VerifiedBadge } from "./verified-badge";
import { useT } from "@/lib/i18n";

export function AccountSignedInBar({ author }: { author: Author }) {
  const t = useT();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await logoutAuthor();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto flex min-w-0 flex-col">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-[19px] font-medium tracking-tight text-ink">
            {author.handle ? `@${author.handle}` : author.username}
          </span>
          {author.verified && <VerifiedBadge />}
        </div>
        <span className="text-[12px] text-ink-subtle">
          {author.handle ? t("Signed in as {username}", { username: author.username }) : t("Signed in to your Harbor account")}
        </span>
      </div>
      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-edge-soft px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:border-danger/40 hover:text-danger disabled:opacity-50"
      >
        {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} {t("Sign out")}
      </button>
    </div>
  );
}
