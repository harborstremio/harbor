import { CatAvatar } from "@/components/icons/cat-avatar";

export function AvatarRing({ src, size, onClick }: { src: string | null; size: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="group relative shrink-0 overflow-hidden rounded-full ring-2 ring-edge-soft transition-all hover:ring-ink"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <CatAvatar className="h-full w-full" />
      )}
      <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/65 to-transparent pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white opacity-0 transition-opacity group-hover:opacity-100">
        Change
      </span>
    </button>
  );
}
