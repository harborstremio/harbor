import { CatAvatar } from "@/components/icons/cat-avatar";
import { useT } from "@/lib/i18n";

export function AvatarRing({
  src,
  size,
  onClick,
}: {
  src: string | null;
  size: number;
  onClick?: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      type="button"
      className="group relative shrink-0 overflow-hidden rounded-full ring-2 ring-edge-soft transition hover:ring-ink"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <CatAvatar className="h-full w-full" />
      )}
      <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/65 to-transparent pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white opacity-0 transition-opacity group-hover:opacity-100">
        {t("Change")}
      </span>
    </button>
  );
}
