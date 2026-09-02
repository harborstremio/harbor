import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";

export function AuthorIdentity({ account }: { account: Author }) {
  const t = useT();
  const initials = account.username.slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink">{t("Publishing as")}</span>
      <div className="flex items-center gap-3 rounded-md bg-elevated px-3.5 py-2.5 ring-1 ring-edge-soft">
        {account.avatar ? (
          <img
            src={account.avatar}
            alt=""
            draggable={false}
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-edge-soft"
          />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-[13px] font-bold text-ink-muted ring-1 ring-edge-soft">
            {initials}
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13.5px] font-semibold text-ink">{account.username}</span>
          {account.handle && (
            <span className="truncate font-display text-[12.5px] text-ink-subtle">
              @{account.handle}
            </span>
          )}
        </div>
      </div>
      <span className="text-[11.5px] text-ink-subtle">
        {t("Tied to your account. Manage it in My themes.")}
      </span>
    </div>
  );
}
