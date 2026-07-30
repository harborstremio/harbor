import { useT } from "@/lib/i18n";
import { Avatar } from "./profile-bits";
import type { MentionHit } from "./use-mention-suggest";

export function MentionPopover({
  hits,
  active,
  onPick,
}: {
  hits: MentionHit[];
  active: number;
  onPick: (hit: MentionHit) => void;
}) {
  const t = useT();
  if (!hits.length) return null;
  return (
    <ul
      role="listbox"
      aria-label={t("Mention a user")}
      className="absolute bottom-full left-2 z-30 mb-1 max-h-60 w-64 overflow-y-auto rounded-[10px] bg-raised p-1 shadow-lg ring-1 ring-edge"
    >
      {hits.map((h, i) => (
        <li key={h.handle} role="option" aria-selected={i === active}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(h);
            }}
            className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors ${
              i === active ? "bg-elevated" : "hover:bg-elevated/60"
            }`}
          >
            <Avatar src={h.avatarUrl} size={24} alias={h.alias} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{h.alias}</span>
            <span className="shrink-0 text-[12px] text-ink-subtle">@{h.handle}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}