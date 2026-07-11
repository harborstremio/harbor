import type { PersonCredit } from "@/lib/providers/tmdb";
import { useMemo } from "react";

export function Bio({
  text,
  credits,
  onOpenCredit,
}: {
  text: string;
  credits?: PersonCredit[];
  onOpenCredit?: (c: PersonCredit) => void;
}) {
  const content = useMemo(() => {
    if (!credits || credits.length === 0 || !onOpenCredit) return null;
    const byTitle = new Map<string, PersonCredit>();
    for (const c of credits) {
      const t = c.title?.trim();
      if (!t || t.length < 4) continue;
      const existing = byTitle.get(t);
      if (!existing || (c.popularity ?? 0) > (existing.popularity ?? 0)) byTitle.set(t, c);
    }
    if (byTitle.size === 0) return null;
    const titles = [...byTitle.keys()].sort((a, b) => b.length - a.length);
    const pattern = titles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const rx = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, "gu");
    const parts = text.split(rx);
    return parts.map((part, i) => {
      const credit = byTitle.get(part);
      if (!credit) return <span key={i}>{part}</span>;
      return (
        <button
          key={i}
          type="button"
          onClick={() => onOpenCredit(credit)}
          className="font-semibold text-ink transition-colors hover:text-accent"
        >
          {part}
        </button>
      );
    });
  }, [text, credits, onOpenCredit]);

  return (
    <div className="max-w-2xl">
      <div
        className="max-h-[210px] overflow-y-auto pe-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0, black 6px, black calc(100% - 8px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, black 6px, black calc(100% - 8px), transparent 100%)",
        }}
      >
        <p className="text-[15px] leading-relaxed text-ink-muted">{content ?? text}</p>
      </div>
    </div>
  );
}
