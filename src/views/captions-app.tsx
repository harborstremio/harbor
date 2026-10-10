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
  "flex h-[26px] w-[26px] shrink-0 items-center justify-center bg-white/[0.08] text-white/70 transition-colors duration-150 hover:bg-white/[0.18] hover:text-white active:scale-[0.97]";

export function CaptionsApp() {
  const t = useT();
  const [cue, setCue] = useState<Cue>({ text: "", lang: null, paused: false });
  const [last, setLast] = useState("");
  const [big, setBig] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let dead = false;
    let off: (() => void) | null = null;
    void (async () => {
      const un = await listen<Cue>("captions://cue", (e) => {
        if (!dead)
          setCue({
            text: e.payload.text ?? "",
            lang: e.payload.lang ?? null,
            paused: Boolean(e.payload.paused),
          });
      });
      const unText = await listen<string>("captions://text", (e) => {
        if (!dead) setCue((c) => ({ ...c, text: typeof e.payload === "string" ? e.payload : "" }));
      });
      if (dead) {
        un();
        unText();
        return;
      }
      off = () => {
        un();
        unText();
      };
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
    if (cue.text) setLast(cue.text);
  }, [cue.text]);

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
    const edge = 8;
    if (
      e.clientX < edge ||
      e.clientY < edge ||
      e.clientX > window.innerWidth - edge ||
      e.clientY > window.innerHeight - edge
    )
      return;
    void getCurrentWindow()
      .startDragging()
      .catch(() => {});
  }, []);

  const shown = cue.text || last;

  return (
    <div className="h-screen w-screen bg-transparent p-[6px]">
      <section
        onPointerDown={drag}
        className="group relative flex h-full w-full cursor-grab select-none flex-col bg-black/70 active:cursor-grabbing"
      >
        <div
          data-no-drag
          className="absolute end-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          {cue.lang && (
            <span className="me-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">
              {cue.lang}
            </span>
          )}
          {cue.paused && (
            <span className="me-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">
              {t("Paused")}
            </span>
          )}
          <button
            type="button"
            onClick={resize}
            aria-label={big ? t("Shrink") : t("Expand")}
            title={big ? t("Shrink") : t("Expand")}
            className={CHROME_BTN}
          >
            {big ? (
              <Minimize2 size={13} strokeWidth={2.2} />
            ) : (
              <Maximize2 size={13} strokeWidth={2.2} />
            )}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            title={t("Close")}
            className={CHROME_BTN}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-h-full items-center justify-center px-7 py-5">
            {shown ? (
              <p
                className={`whitespace-pre-wrap text-center text-[18px] font-medium leading-[1.4] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${
                  cue.text ? "" : "opacity-40"
                }`}
              >
                {shown}
              </p>
            ) : (
              <p className="text-center text-[14px] text-white/55">
                {t("Waiting for the next line")}
              </p>
            )}
          </div>
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={toBottom}
            data-no-drag
            aria-label={t("Jump to latest")}
            title={t("Jump to latest")}
            className="absolute bottom-1.5 left-1/2 flex h-[22px] w-[34px] -translate-x-1/2 items-center justify-center bg-white/[0.1] text-white/70 transition-colors duration-150 hover:bg-white/[0.2] hover:text-white"
          >
            <ChevronDown size={14} strokeWidth={2.4} />
          </button>
        )}
      </section>
    </div>
  );
}
