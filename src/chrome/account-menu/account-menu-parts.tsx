import { AvatarImage } from "@/components/avatar-image";
import { useT } from "@/lib/i18n";
import { type Profile } from "@/lib/profiles";
import type { User } from "@/lib/stremio";
import { openUrl } from "@/lib/window";

const STREMIO_REGISTER_URL = "https://www.stremio.com/register";

export function ProfileAvatar({
  profile,
  user,
  fallbackAvatar,
  size = "md",
}: {
  profile: Profile | null;
  user: User | null;
  fallbackAvatar: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const src = profile?.avatar ?? fallbackAvatar ?? user?.avatar ?? null;
  const ringStyle = profile?.color ? { boxShadow: `0 0 0 2px ${profile.color}` } : undefined;
  return (
    <div className={`${dim} shrink-0 overflow-hidden rounded-full bg-elevated`} style={ringStyle}>
      <AvatarImage src={src} className="h-full w-full object-cover" />
    </div>
  );
}

export function SubtitleText({
  active,
  profiles,
  user,
}: {
  active: Profile | null;
  profiles: Profile[];
  user: User | null;
}) {
  const t = useT();
  if (active?.shareStremioWith) {
    const src = profiles.find((p) => p.id === active.shareStremioWith);
    if (src) return <>{t("Sharing {name}'s Stremio", { name: src.name })}</>;
  }
  if (user) {
    return <>{t("profile.signedIn")}</>;
  }
  return (
    <>
      {t("Sign in to")}{" "}
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          openUrl(STREMIO_REGISTER_URL);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openUrl(STREMIO_REGISTER_URL);
          }
        }}
        className="cursor-pointer text-ink transition-colors hover:text-accent"
      >
        Stremio
      </span>
    </>
  );
}
