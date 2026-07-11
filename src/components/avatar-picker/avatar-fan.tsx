import { AVATAR_CATALOG, avatarUrl } from "@/lib/avatars/catalog";
import { useT } from "@/lib/i18n";
import { Shuffle } from "lucide-react";
import { useMemo } from "react";

const ALL_IDS = AVATAR_CATALOG.flatMap((g) => g.items.map((i) => i.id));

function randomId(): string {
  return ALL_IDS[Math.floor(Math.random() * ALL_IDS.length)];
}

export function AvatarFan({
  onClick,
  onRandomize,
  label,
}: {
  onClick: () => void;
  onRandomize: (id: string) => void;
  label?: string;
}) {
  const t = useT();
  const picks = useMemo(() => {
    const ids = [...ALL_IDS];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 5);
  }, []);
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-edge-soft">
      <button
        type="button"
        onClick={onClick}
        className="group flex flex-1 items-center gap-3 px-2.5 py-1.5 text-start transition-colors hover:bg-canvas/50"
      >
        <span className="flex items-center">
          {picks.map((id, i) => {
            const last = i === picks.length - 1;
            return (
              <span key={id} className="relative -ms-3 block h-9 w-9 shrink-0 first:ms-0" style={{ zIndex: i }}>
                <span className="block h-full w-full overflow-hidden rounded-full ring-2 ring-canvas">
                  <img src={avatarUrl(id)} alt="" draggable={false} className="h-full w-full object-cover" />
                </span>
                {last && (
                  <span className="absolute -bottom-1 -end-1.5 z-10 rounded-full bg-ink px-1.5 py-px text-[9.5px] font-bold leading-tight text-canvas ring-2 ring-canvas">
                    {ALL_IDS.length}
                  </span>
                )}
              </span>
            );
          })}
        </span>
        <span className="text-start text-[12.5px] font-medium leading-tight text-ink-muted transition-colors group-hover:text-ink">
          {label ?? t("or use one of our avatars")}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRandomize(randomId())}
        aria-label={t("Random avatar")}
        title={t("Random avatar")}
        className="flex w-10 shrink-0 items-center justify-center self-stretch border-s border-edge-soft text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
      >
        <Shuffle size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
