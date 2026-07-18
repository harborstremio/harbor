import { Lock, Pencil } from "lucide-react";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { useT } from "@/lib/i18n";
import { type Profile } from "@/lib/profiles";

export function ProfileTile({
  profile,
  onSelect,
  onEdit,
  size = "lg",
  initialFocus = false,
}: {
  profile: Profile;
  onSelect: () => void;
  onEdit?: () => void;
  size?: "sm" | "md" | "lg";
  initialFocus?: boolean;
}) {
  const t = useT();
  const dim = size === "lg" ? "h-24 w-24" : size === "md" ? "h-16 w-16" : "h-12 w-12";
  const ring = size === "lg" ? "ring-[3px]" : "ring-2";
  const fontName = size === "lg" ? "text-[14px]" : size === "md" ? "text-[12.5px]" : "text-[11px]";

  return (
    <div className="group flex flex-col items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className="block cursor-pointer outline-none"
          aria-label={t("Switch to {name}", { name: profile.name })}
          data-tv-initial-focus={initialFocus || undefined}
        >
          <span
            className={`relative flex ${dim} items-center justify-center overflow-hidden rounded-full bg-elevated ${ring} transition-all duration-200 group-hover:scale-[1.04]`}
            style={{ boxShadow: `0 0 0 3px ${profile.color}` }}
          >
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <CatAvatar className="h-full w-full" />
            )}
          </span>
        </button>
        {profile.passwordHash && (
          <span
            aria-label={t("chrome.locked")}
            className="pointer-events-none absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-ink shadow-md ring-1 ring-edge"
          >
            <Lock size={12} strokeWidth={2.4} />
          </span>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("Edit {name}", { name: profile.name })}
            className="absolute -end-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/95 text-ink opacity-0 ring-1 ring-edge transition-opacity duration-150 group-hover:opacity-100 hover:bg-elevated"
          >
            <Pencil size={12} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className={`font-medium text-ink ${fontName}`}>{profile.name}</span>
        {profile.isPrimary && size !== "sm" && (
          <span
            className="text-[9.5px] font-bold uppercase tracking-[0.18em]"
            style={{ color: profile.color }}
          >
            {t("profile.primary")}
          </span>
        )}
      </div>
    </div>
  );
}
