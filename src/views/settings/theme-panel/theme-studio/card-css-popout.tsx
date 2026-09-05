import { Sparkles, X } from "lucide-react";
import { useModalExit } from "@/components/modal-shell";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor } from "@/components/code-editor";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";

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
  const t = useT();
  const { settings } = useSettings();
  const tvNav = settings.tvNavigation;
  const [picks, setPicks] = useState(FALLBACK);
  const doneRef = useRef<HTMLButtonElement>(null);

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

  const { closing, close } = useModalExit(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (document.querySelector("[data-search-editing]")) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  useEffect(() => {
    if (tvNav && doneRef.current) tvFocus(doneRef.current);
  }, [tvNav]);

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} pointer-events-auto fixed inset-0 z-[246] grid place-items-center p-8`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex h-[min(680px,86vh)] w-[min(1080px,100%)] flex-col overflow-hidden rounded-md bg-surface`}
      >
        <header className="flex shrink-0 items-start gap-4 px-6 pb-5 pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">{t("Custom cards")}</span>
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-ink">
              {t("Write CSS, watch real posters react")}
            </h2>
          </div>
          <button
            type="button"
            ref={doneRef}
            onClick={onClose}
            aria-label={t("Done")}
            title={t("Done")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 gap-3 px-6 pb-6">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-canvas">
            <div className="flex h-14 shrink-0 items-center gap-2 px-3">
              <span className="font-mono text-[15.5px] leading-[22px] text-ink-subtle">styles.css</span>
              <button
                type="button"
                onClick={() => onChange({ css: css.trim() ? css : STARTER })}
                className="harbor-press-pop ms-auto flex h-11 items-center gap-1.5 rounded-md bg-elevated px-3 text-[15.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
              >
                <Sparkles size={16} strokeWidth={2.2} />
                {t("Insert starter")}
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <CodeEditor
                value={css}
                onChange={(v) => onChange({ css: v })}
                language="css"
                autoFocus={!tvNav}
                className="h-full"
              />
              {!css && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                  <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
                    {t(
                      "Style {selector} and the posters on the right update live. Hit Insert starter for a head start.",
                      {
                        selector: ".your-card",
                      },
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-[42%] shrink-0 flex-col overflow-hidden rounded-md bg-canvas">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-4 py-3">
              {HOOKS.map((h) => (
                <span
                  key={h.sel}
                  className="inline-flex min-h-8 items-center gap-2 rounded-md bg-elevated px-2.5 py-1 text-[15.5px] leading-[22px]"
                  title={t(h.note)}
                >
                  <code className="font-mono text-ink">{h.sel}</code>
                  <span className="text-ink-subtle">{t(h.note)}</span>
                </span>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1">
              <div data-tv-skip className="grid grid-cols-3 gap-5">
                {picks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    tabIndex={-1}
                    className="group relative flex w-full min-w-0 cursor-default flex-col gap-2 text-start transition-[z-index] hover:z-10"
                  >
                    <div className="your-card relative aspect-[2/3] rounded-md bg-elevated">
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
                    <p className="line-clamp-2 text-[15.5px] font-medium leading-[22px] text-ink">
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
