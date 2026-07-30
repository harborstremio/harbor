import { useT } from "@/lib/i18n";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { UserHoverCard } from "./user-hover-card";

export function MentionLink({
  handle,
  label,
  onOpen,
}: {
  handle: string;
  label: string;
  onOpen?: (handle: string) => void;
}) {
  const t = useT();
  return (
    <UserHoverCard handle={handle}>
      <button
        type="button"
        onClick={() => (onOpen ? onOpen(handle) : requestOpenProfile(handle))}
        aria-label={t("Open @{handle} profile", { handle })}
        className="rounded-[4px] font-semibold text-accent transition-colors hover:underline"
      >
        {label}
      </button>
    </UserHoverCard>
  );
}
