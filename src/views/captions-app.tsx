import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Maximize2, Minimize2, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useT } from "@/lib/i18n";

type Cue = { text: string; lang: string | null; paused: boolean };

const SMALL = { w: 468, h: 168 };
const LARGE = { w: 720, h: 260 };

const CHROME_BTN =
  "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-ink-subtle transition-colors duration-150 ease-[var(--ease-out)] hover:bg-white/[0.10] hover:text-ink active:scale-[0.97]";

export function CaptionsApp() {
  const t = useT();
  const [cue, setCue] = useState<Cue>({ text: "", lang: null, paused: false });
  const [big, setBig] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let dead = false;
    let off: (() => void) | null = null;
    void (async () => {
      const un = await listen<Cue>("captions://cue", (e) => {
        if (!dead) setCue({ text: e.payload.text ?? "", lang: e.payload.lang ?? null, paused: Boolean(e.payload.paused) });
      });
      if (dead) {
        un();
        return;
      }
      off = un;
      void invoke("captions_request_state").catch(() => {});
    })();
    return () => {
      dead = true;
      try {
        off?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [cue.text, atBottom]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, []);

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, []);

  const resize = useCallback(async () => {
    const next = !big;
    setBig(next);
    const s = next ? LARGE : SMALL;
    try {
      await getCurrentWindow().setSize(new LogicalSize(s.w, s.h));
    } catch {}
  }, [big]);

  const close = useCallback(() => {
    void invoke("captions_close").catch(() => {});
  }, []);

  const drag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-no-drag]")) return;
    void getCurrentWindow().startDragging().catch(() => {});
  }, []);

  return (
    <div className="h-screen w-screen bg-transparent p-[6px]">
      <section
        onPointerDown={drag}
        className="flex h-full w-full cursor-grab select-none flex-col gap-[10px] rounded-md bg-elevated p-[14px] ring-1 ring-edge shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] active:cursor-grabbing"
      >
        <header className="flex shrink-0 items-center gap-[10px]">
          <span className="rounded-full bg-white/[0.06] px-[10px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle ring-1 ring-edge-soft">
            {cue.lang ?? t("Subtitles")}
          </span>
          {cue.paused && (
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              {t("Paused")}
            </span>
          )}
          <div className="ms-auto flex items-center gap-[6px]" data-no-drag>
            <button
              type="button"
              onClick={resize}
              aria-label={big ? t("Shrink") : t("Expand")}
              title={big ? t("Shrink") : t("Expand")}
              className={CHROME_BTN}
            >
              {big ? <Minimize2 size={14} strokeWidth={2.2} /> : <Maximize2 size={14} strokeWidth={2.2} />}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={t("Close")}
              title={t("Close")}
              className={CHROME_BTN}
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          data-no-drag
          className="min-h-0 flex-1 overflow-y-auto rounded-md bg-canvas/50 px-[12px] py-[10px] ring-1 ring-inset ring-edge-soft [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cue.text ? (
            <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-ink">{cue.text}</p>
          ) : (
            <p className="text-[13px] leading-[1.55] text-ink-subtle">{t("Waiting for the next line")}</p>
          )}
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={toBottom}
            data-no-drag
            aria-label={t("Jump to latest")}
            title={t("Jump to latest")}
            className="mx-auto flex h-[24px] w-[36px] shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink-subtle transition-colors duration-150 ease-[var(--ease-out)] hover:bg-white/[0.10] hover:text-ink"
          >
            <ChevronDown size={15} strokeWidth={2.4} />
          </button>
        )}
      </section>
    </div>
  );
}
