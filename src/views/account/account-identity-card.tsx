import { useId, useState } from "react";
import { Loader2, LogOut, Pencil } from "@/views/settings/icons";
import { HarborMark } from "@/components/icons/harbor-mark";
import { logoutAuthor, type Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_DANGER } from "@/views/settings/kit";
import { VerifiedBadge } from "./verified-badge";
import { HandleClaimCard } from "./handle-claim-card";

export function AccountIdentityCard({ author }: { author: Author }) {
  const t = useT();
  const handleEditorId = useId();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(!author.handle);

  const signOut = async () => {
    setSigningOut(true);
    await logoutAuthor();
  };

  return (
    <div className="flex flex-col gap-6 border-b border-edge-soft py-7">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-[18px] border border-edge-soft bg-canvas text-ink">
          <HarborMark className="h-14 w-14" />
        </span>

        <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <bdi dir="ltr" className="min-w-0 break-words text-[28px] font-semibold leading-[34px] tracking-[-0.5px] text-ink">
              {author.handle ? `@${author.handle}` : author.username}
            </bdi>
            {author.verified && <VerifiedBadge />}
          </span>
          <span className="flex items-start gap-2 text-[15.5px] leading-[23px] text-ink-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            {author.handle
              ? t("Signed in as {username}", { username: author.username })
              : t("Signed in to your Harbor account")}
          </span>
        </span>

        <span className="flex max-w-full flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-controls={handleEditorId}
            className={ROW_ACTION}
          >
            <Pencil size={16} strokeWidth={2.2} />
            {author.handle ? t("Change handle") : t("Claim a handle")}
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-busy={signingOut}
            className={ROW_ACTION_DANGER}
          >
            {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {t("Sign out")}
          </button>
        </span>
      </div>

      {editing && (
        <div id={handleEditorId} className="animate-lift-in w-full max-w-[560px] border-t border-edge-soft pt-6">
          <HandleClaimCard author={author} />
        </div>
      )}
    </div>
  );
}
