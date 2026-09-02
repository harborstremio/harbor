import { requestOpenProfile } from "@/lib/social/open-profile";
import { UserHoverCard } from "@/views/profile/user-hover-card";

export function ThemeAuthorButton({
  handle,
  name,
  className = "",
}: {
  handle: string;
  name: string;
  className?: string;
}) {
  return (
    <UserHoverCard handle={handle}>
      <button
        type="button"
        aria-label={`Open ${name} profile`}
        onClick={(event) => {
          event.stopPropagation();
          requestOpenProfile(handle);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        }}
        className={`pointer-events-auto relative z-20 inline cursor-pointer rounded-sm text-inherit underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline ${className}`}
      >
        {name}
      </button>
    </UserHoverCard>
  );
}
