import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor } from "@/components/code-editor";
import { topMovies, type Meta } from "@/lib/cinemeta";

const STARTER = `/* Custom cards: .your-card targets each poster. */
.your-card {
  border-radius: 10px;
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.7);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.group:hover .your-card {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 26px 52px -16px rgba(0, 0, 0, 0.85);
}
`;

const HOOKS = [
  { sel: ".your-card", note: "each poster" },
  { sel: ".group:hover .your-card", note: "on hover" },
  { sel: ".harbor-poster", note: "poster image" },
];

const FALLBACK: Array<{ id: string; name: string; poster: string }> = [
  {
    id: "tt0111161",
    name: "The Shawshank Redemption",
    poster: "https://images.metahub.space/poster/medium/tt0111161/img",
  },
  {
    id: "tt0468569",
    name: "The Dark Knight",
    poster: "https://images.metahub.space/poster/medium/tt0468569/img",
  },
  {
    id: "tt1375666",
    name: "Inception",
    poster: "https://images.metahub.space/poster/medium/tt1375666/img",
  },
  {
    id: "tt0816692",
    name: "Interstellar",
    poster: "https://images.metahub.space/poster/medium/tt0816692/img",
  },
  {
    id: "tt0137523",
    name: "Fight Club",
    poster: "https://images.metahub.space/poster/medium/tt0137523/img",
  },
  {
    id: "tt0110912",
    name: "Pulp Fiction",
    poster: "https://images.metahub.space/poster/medium/tt0110912/img",
  },
];

export function CardCssPopout({
  css,
  onChange,
  onClose,
}: {
  css: string;
  onChange: (patch: { css: string }) => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    topMovies()
      .then((metas: Meta[]) => {
        const out = metas
          .filter((m) => m.poster)
          .slice(0, 6)
          .map((m) => ({ id: m.id, name: m.name, poster: m.poster as string }));
        if (!cancelled && out.length >= 4) setPicks(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return createPortal(
    <div
      className="animate-in fade-in pointer-events-auto fixed inset-0 z-[235] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-in zoom-in-95 fade-in flex h-[min(680px,90vh)] w-[min(1080px,94vw)] flex-col overflow-hidden rounded-2xl border border-edge bg-canvas shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85)] duration-150"
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge-soft bg-surface/80 px-5">
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
              Custom cards
            </span>
            <span className="truncate text-[14px] font-semibold text-ink">
              Write CSS, watch real posters react
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Done"
            className="ms-auto flex h-9 items-center rounded-lg px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            Done
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col border-e border-edge-soft">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-edge-soft px-3">
              <span className="font-mono text-[12px] text-ink-subtle">styles.css</span>
              <button
                type="button"
                onClick={() => onChange({ css: css.trim() ? css : STARTER })}
                className="ms-auto flex h-7 items-center gap-1.5 rounded-md border border-edge-soft px-2.5 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                <Sparkles size={13} strokeWidth={2.2} />
                Insert starter
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <CodeEditor
                value={css}
                onChange={(v) => onChange({ css: v })}
                language="css"
                autoFocus
                className="h-full"
              />
              {!css && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                  <span className="text-[13.5px] leading-relaxed text-ink-subtle">
                    Style <span className="font-mono text-ink-muted">.your-card</span> and the
                    posters on the right update live. Hit Insert starter for a head start.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-[42%] shrink-0 flex-col bg-surface/40">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-edge-soft px-4 py-2.5">
              {HOOKS.map((h) => (
                <span
                  key={h.sel}
                  className="inline-flex items-center gap-1.5 rounded-md bg-elevated/60 px-2 py-1 text-[11px]"
                  title={h.note}
                >
                  <code className="font-mono text-ink">{h.sel}</code>
                  <span className="text-ink-subtle">{h.note}</span>
                </span>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-5">
                {picks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    tabIndex={-1}
                    className="group relative flex w-full min-w-0 cursor-default flex-col gap-2 text-start transition-[z-index] hover:z-10"
                  >
                    <div className="your-card relative aspect-[2/3] rounded-xl bg-elevated">
                      <div className="harbor-poster absolute inset-0 overflow-hidden rounded-[inherit]">
                        <img
                          src={p.poster}
                          alt=""
                          loading="lazy"
                          draggable={false}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="line-clamp-2 text-[12px] font-medium leading-snug text-ink">
                      {p.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
