import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";

export function EpisodePager({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
  onGoToEpisode,
  maxEpisode,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
  onGoToEpisode?: (n: number) => void;
  maxEpisode?: number;
}) {
  const t = useT();
  if (pageCount <= 1) return null;
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);
  const pages = windowPages(page, pageCount);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1">
      <span className="text-[12px] tabular-nums text-ink-subtle">
        {t("{start}-{end} of {total}", { start, end, total })}
      </span>
      <div className="flex items-center gap-1">
        <NavBtn label={t("First page")} disabled={page === 0} onClick={() => onChange(0)}>
          <ChevronsLeft size={16} strokeWidth={2.2} />
        </NavBtn>
        <NavBtn label={t("Previous")} disabled={page === 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} strokeWidth={2.2} />
        </NavBtn>
        {pages.map((p, i) =>
          p === 0 ? (
            <span key={`gap-${i}`} className="px-1 text-[12px] text-ink-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p - 1)}
              className={`h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-medium tabular-nums transition-colors ${
                p - 1 === page ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <NavBtn label={t("Next")} disabled={page === pageCount - 1} onClick={() => onChange(page + 1)}>
          <ChevronRight size={16} strokeWidth={2.2} />
        </NavBtn>
        <NavBtn label={t("Last page")} disabled={page === pageCount - 1} onClick={() => onChange(pageCount - 1)}>
          <ChevronsRight size={16} strokeWidth={2.2} />
        </NavBtn>
      </div>
      {onGoToEpisode && maxEpisode ? <GoToEpisode max={maxEpisode} onGo={onGoToEpisode} /> : <span />}
    </div>
  );
}

function windowPages(page: number, count: number): number[] {
  const cur = page + 1;
  const keep = new Set<number>([1, count, cur, cur - 1, cur + 1]);
  const arr = [...keep].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: number[] = [];
  let prev = 0;
  for (const p of arr) {
    if (p - prev > 1) out.push(0);
    out.push(p);
    prev = p;
  }
  return out;
}

function NavBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function GoToEpisode({ max, onGo }: { max: number; onGo: (n: number) => void }) {
  const t = useT();
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n >= 1 && n <= max) {
          onGo(n);
          setV("");
        }
      }}
    >
      <input
        type="number"
        min={1}
        max={max}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={t("Go to ep")}
        aria-label={t("Go to episode")}
        className="h-8 w-[104px] rounded-lg border border-edge-soft bg-canvas px-2.5 text-[12px] text-ink outline-none transition-colors focus:border-ink-subtle"
      />
    </form>
  );
}
