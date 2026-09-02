import { useState } from "react";
import { Loader2, LogOut, Pencil } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { logoutAuthor, type Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { VerifiedBadge } from "./verified-badge";
import { HandleClaimCard } from "./handle-claim-card";

const CHIP =
  "harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors";

export function AccountIdentityCard({ author }: { author: Author }) {
  const t = useT();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(!author.handle);

  const signOut = async () => {
    setSigningOut(true);
    await logoutAuthor();
  };

  return (
    <div className="flex flex-col gap-4 rounded-md bg-elevated px-5 py-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-canvas text-ink">
          <HarborMark className="h-7 w-7" />
        </span>

        <span className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-[21px] font-medium leading-tight tracking-tight text-ink">
              {author.handle ? `@${author.handle}` : author.username}
            </span>
            {author.verified && <VerifiedBadge size="sm" />}
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] leading-snug text-ink-subtle">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            {author.handle
              ? t("Signed in as {username}", { username: author.username })
              : t("Signed in to your Harbor account")}
          </span>
        </span>

        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`${CHIP} ${editing ? "text-ink" : "hover:text-ink"}`}
          >
            <Pencil size={12} strokeWidth={2.2} />
            {author.handle ? t("Change handle") : t("Claim a handle")}
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={`${CHIP} hover:text-danger disabled:opacity-50`}
          >
            {signingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            {t("Sign out")}
          </button>
        </span>
      </div>

      {editing && (
        <div className="animate-lift-in rounded-md bg-canvas px-4 py-4">
          <HandleClaimCard author={author} />
        </div>
      )}
    </div>
  );
}
