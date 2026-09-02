import { BookOpen } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { RemoteMangaState } from "@/lib/remote/protocol";

const MANGA_NOWBAR_CSS = `
.harbor-manga-nowbar-in { animation: harbor-manga-nowbar-in 420ms var(--ease-out) both; }
.harbor-manga-nowbar-slide { transition: transform 320ms var(--ease-out); }
.harbor-manga-nowbar-slide[data-hidden="true"] { transform: translateY(calc(100% + env(safe-area-inset-bottom, 0px) + 74px + 24px)); }
@keyframes harbor-manga-nowbar-in {
  0% { opacity: 0; transform: translate3d(0, 16px, 0) scale(0.985); }
  55% { opacity: 1; }
  78% { transform: translate3d(0, -2px, 0) scale(1); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .harbor-manga-nowbar-in { animation: none; }
  .harbor-manga-nowbar-slide { transition: none; }
  .harbor-manga-nowbar-slide[data-hidden="true"] { transform: none; visibility: hidden; }
}
`;

export function MangaNowBar({
  m,
  hidden,
  onExpand,
}: {
  m: RemoteMangaState;
  hidden: boolean;
  onExpand: () => void;
}) {
  const t = useT();
  return (
    <div
      className="harbor-manga-nowbar-slide pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3"
      data-hidden={hidden ? "true" : undefined}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)" }}
    >
      <style>{MANGA_NOWBAR_CSS}</style>
      <div className="harbor-manga-nowbar-in w-[min(440px,100%)]">
        <button
          type="button"
          onClick={onExpand}
          className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-edge-soft/60 bg-elevated/80 p-2 pe-4 text-start shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-transform active:scale-[0.99]"
        >
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface">
            {m.cover && <img src={m.cover} alt="" className="h-full w-full object-cover" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] font-semibold text-ink">
              {m.title || t("Reading")}
            </span>
            <span className="truncate text-[11.5px] text-ink-muted">
              {t("Reading {chapter}", { chapter: m.chapterLabel })}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
            <BookOpen size={16} strokeWidth={2.2} />
          </span>
        </button>
      </div>
    </div>
  );
}
