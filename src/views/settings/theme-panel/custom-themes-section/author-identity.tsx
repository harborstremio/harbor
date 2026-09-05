import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../../shared";

export function AuthorIdentity({ account }: { account: Author }) {
  const t = useT();
  const initials = account.username.slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col gap-2">
      <span className="harbor-settings-label">{t("Publishing as")}</span>
      <div className="flex items-center gap-3">
        {account.avatar ? (
          <img
            src={account.avatar}
            alt=""
            draggable={false}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-edge-soft"
          />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-[15.5px] font-bold text-ink-muted ring-1 ring-edge-soft">
            {initials}
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className={`truncate ${ROW_TITLE}`}>{account.username}</span>
          {account.handle && (
            <span className="truncate font-display text-[15.5px] leading-[22px] text-ink-subtle">
              @{account.handle}
            </span>
          )}
        </div>
      </div>
      <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
        {t("Tied to your account. Manage it in My themes.")}
      </span>
    </div>
  );
}
