import { useEffect, useRef } from "react";
import {
  fitLevel,
  hasNativeZoom,
  nativePan,
  type FlipBookView,
  type FlipCtor,
  type FlipInstance,
} from "./flipbook";
import { IMAGE_FALLBACK_HEADERS, measureAspect } from "./reader-utils";

const BASE = "/flipbook";
const NAME = "harborBook";
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const hostOf = (u: string): string => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

const SNAP_BACK_MS = 220;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

const CHROME_HIDDEN = [
  ".flipbook-nav",
  ".flipbook-menuTop",
  ".flipbook-menuBottom",
  ".flipbook-menu-btn-wrapper",
  ".flipbook-menu-floating",
  ".flipbook-menu-fixed",
  ".flipbook-center-btn-expand",
  ".flipbook-currentPageNumber",
  ".flipbook-currentPageInput",
  ".flipbook-progress-bar",
  ".flipbook-left-arrow",
  ".flipbook-right-arrow",
]
  .map((c) => `.harbor-flipbook ${c}`)
  .join(",");

let loaded: Promise<void> | null = null;

function ensureStyle() {
  if (document.getElementById("harbor-flipbook-chrome")) return;
  const st = document.createElement("style");
  st.id = "harbor-flipbook-chrome";
  st.textContent = `${CHROME_HIDDEN}{display:none!important}`;
  document.head.appendChild(st);
}

function loadFlipbook(): Promise<void> {
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    if ((window as unknown as { FlipBook?: unknown }).FlipBook) {
      resolve();
      return;
    }
    if (!document.getElementById("harbor-flipbook-css")) {
      const css = document.createElement("link");
      css.id = "harbor-flipbook-css";
      css.rel = "stylesheet";
      css.href = `${BASE}/css/flipbook.min.css`;
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = `${BASE}/js/flipbook.min.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("flipbook script failed"));
    document.head.appendChild(s);
  });
  return loaded;
}

function sampledAspect(srcs: string[]): Promise<number> {
  if (srcs.length === 0) return Promise.resolve(1.4);
  const idxs = [
    ...new Set(
      [0, Math.floor(srcs.length * 0.25), Math.floor(srcs.length * 0.5), Math.floor(srcs.length * 0.75)].filter(
        (i) => i < srcs.length,
      ),
    ),
  ];
  return Promise.all(idxs.map((i) => measureAspect(srcs[i]))).then((aspects) => {
    const valid = aspects.filter((a) => a > 0.2 && a < 6).sort((a, b) => a - b);
    if (!valid.length) return 1.4;
    return valid[Math.floor((valid.length - 1) / 2)];
  });
}

export type BookApi = {
  goToPage: (page: number) => void;
  next: () => void;
  prev: () => void;
  pan: (dx: number, dy: number) => void;
  drag: (progress: number) => void;
  dragEnd: (commit: boolean, dir: "next" | "prev") => void;
};

export function BookFlip({
  pages,
  rtl,
  bg,
  resumePage,
  soundEnabled,
  instanceName = NAME,
  zoom = 1,
  onProgress,
  onReady,
}: {
  pages: string[];
  rtl: boolean;
  bg: string;
  resumePage: number;
  soundEnabled: boolean;
  instanceName?: string;
  zoom?: number;
  onProgress: (page: number, spread: string) => void;
  onReady?: (api: BookApi) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const report = useRef(onProgress);
  report.current = onProgress;
  const ready = useRef(onReady);
  ready.current = onReady;
  const soundOn = useRef(soundEnabled);
  soundOn.current = soundEnabled;
  const instRef = useRef<FlipInstance | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  const applyTransform = (smooth: boolean) => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition =
      smooth && !prefersReducedMotion() ? "transform 240ms cubic-bezier(0.22,0.61,0.36,1)" : "none";
    el.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`;
  };

  const clampPan = () => {
    const host = wrapRef.current?.parentElement;
    if (!host) return;
    const z = zoomRef.current;
    const maxX = Math.max(0, (host.clientWidth * (z - 1)) / 2);
    const maxY = Math.max(0, (host.clientHeight * (z - 1)) / 2);
    const p = panRef.current;
    p.x = Math.max(-maxX, Math.min(maxX, p.x));
    p.y = Math.max(-maxY, Math.min(maxY, p.y));
  };

  const resetWrapper = () => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "translate3d(0px, 0px, 0) scale(1)";
  };

  const applyZoom = (smooth: boolean) => {
    const inst = instRef.current;
    const z = zoomRef.current;
    if (hasNativeZoom(inst) && inst) {
      resetWrapper();
      const level = z <= 1.001 ? fitLevel(inst) : z;
      try {
        inst.zoomTo?.(level, 0);
      } catch {
        /* noop */
      }
      return;
    }
    clampPan();
    applyTransform(smooth);
  };

  useEffect(() => {
    instRef.current?.toggleSound?.(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const z = Math.max(1, Math.min(3, zoom));
    zoomRef.current = z;
    if (z <= 1.001) panRef.current = { x: 0, y: 0 };
    applyZoom(true);
  }, [zoom]);

  useEffect(() => {
    ensureStyle();
    let cancelled = false;
    let inst: FlipInstance | null = null;

    const origFetch = window.fetch;
    const origOnPopState = window.onpopstate;
    const hosts = new Set<string>();
    if (isTauri) {
      for (const p of pages) {
        if (p.includes(".localhost")) continue;
        const h = hostOf(p);
        if (h) hosts.add(h);
      }
    }
    const httpMod = hosts.size ? import("@tauri-apps/plugin-http") : null;
    if (httpMod) {
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const host = hostOf(u);
        if (host && hosts.has(host)) {
          return httpMod.then((m) =>
            (m.fetch as unknown as typeof fetch)(u, { headers: IMAGE_FALLBACK_HEADERS }),
          );
        }
        return origFetch(input, init);
      }) as typeof fetch;
    }

    const onPage = (e: Event) => {
      const d = (e as CustomEvent).detail as { page?: string | number; name?: string } | undefined;
      if (!d || d.name !== instanceName) return;
      const spread = String(d.page);
      const first = Number(spread.split("-")[0]);
      if (!Number.isFinite(first) || first <= 0) return;
      report.current(first - 1, spread);
    };
    window.addEventListener("r3d-pagechange", onPage);
    void (async () => {
      const aspect = await sampledAspect(pages);
      await loadFlipbook();
      if (cancelled || !ref.current) return;
      const Ctor = (window as unknown as { FlipBook?: FlipCtor }).FlipBook;
      if (!Ctor) return;
      const FB = (window as unknown as { FLIPBOOK?: Record<string, unknown> }).FLIPBOOK;
      if (FB) {
        FB.threejsSrc = `${BASE}/js/libs/three.min.js`;
        FB.flipbookWebGlSrc = `${BASE}/js/flipbook.webgl.min.js`;
      }
      const singlePageMode = aspect < 1.2 || aspect > 1.9;
      inst = new Ctor(ref.current, {
        name: instanceName,
        pages: pages.map((src) => ({ src })),
        viewMode: "webgl",
        singlePageMode,
        cover: false,
        rightToLeft: rtl,
        startPage: Math.min(pages.length, Math.max(1, resumePage + 1)),
        sound: true,
        backgroundColor: bg,
        backgroundTransparent: true,
        assets: { flipMp3: `${BASE}/assets/mp3/turnPage.mp3` },
        autoEnableOutline: false,
        autoEnableThumbnail: false,
        lightboxCloseOnBack: false,
        deeplinkingEnabled: false,
        pageTextureSize: 2048,
        pageTextureSizeSmall: 2048,
        minPixelRatio: 2,
        loadPagesF: 4,
        loadPagesB: 2,
      });
      const local = inst;
      instRef.current = local;
      local.toggleSound?.(soundOn.current);
      if (zoomRef.current > 1.001) applyZoom(false);
      const snapBack = (view: FlipBookView, dir: "next" | "prev") => {
        const page = dir === "next" ? view.getRightPage?.() : view.getLeftPage?.();
        const rest = dir === "next" ? 0 : 180;
        if (!page || typeof page._setAngle !== "function") return;
        const from = typeof page.angle === "number" ? (page.angle * 180) / Math.PI : rest;
        const settle = () => {
          try {
            page._setAngle?.(rest);
          } catch {
            /* noop */
          }
          page.dragging = false;
        };
        if (prefersReducedMotion() || Math.abs(from - rest) < 0.5) {
          settle();
          return;
        }
        const t0 = performance.now();
        const stepBack = () => {
          if (instRef.current !== local) return;
          const k = Math.min(1, (performance.now() - t0) / SNAP_BACK_MS);
          const eased = 1 - Math.pow(1 - k, 3);
          try {
            page._setAngle?.(from + (rest - from) * eased);
          } catch {
            return;
          }
          if (k < 1) requestAnimationFrame(stepBack);
          else settle();
        };
        requestAnimationFrame(stepBack);
      };
      ready.current?.({
        goToPage: (n) => local?.goToPage?.(n),
        next: () => local?.nextPage?.(),
        prev: () => local?.prevPage?.(),
        pan: (dx, dy) => {
          if (hasNativeZoom(local)) {
            nativePan(local, dx, dy);
            return;
          }
          if (zoomRef.current <= 1.001) return;
          panRef.current.x += dx;
          panRef.current.y += dy;
          clampPan();
          applyTransform(false);
        },
        drag: (progress) => {
          const view = local?.Book;
          const w = view?.wrapperW ?? 0;
          if (!view || typeof view.onSwipe !== "function" || !(w > 0)) return;
          if (view.isZoomed?.()) return;
          const p = Math.max(-1, Math.min(1, progress));
          try {
            view.onSwipe(null, "move", p * w, 0, 0, 1);
          } catch {
            /* noop */
          }
        },
        dragEnd: (commit, dir) => {
          const view = local?.Book;
          if (!view || typeof view.onSwipe !== "function") {
            if (commit) {
              if (dir === "next") local?.nextPage?.();
              else local?.prevPage?.();
            }
            return;
          }
          if (commit) {
            try {
              view.onSwipe(null, "end", dir === "next" ? -1 : 1, 0, 0, 1);
            } catch {
              if (dir === "next") local?.nextPage?.();
              else local?.prevPage?.();
            }
            return;
          }
          snapBack(view, dir);
        },
      });
      window.setTimeout(() => {
        if (instRef.current === local) window.dispatchEvent(new Event("resize"));
      }, 250);
    })();
    return () => {
      cancelled = true;
      instRef.current = null;
      if (httpMod) window.fetch = origFetch;
      window.onpopstate = origOnPopState;
      window.removeEventListener("r3d-pagechange", onPage);
      try {
        inst?.dispose?.();
        inst?.destroy?.();
      } catch {
        /* noop */
      }
      ref.current?.replaceChildren();
    };
  }, [pages, rtl, bg, resumePage, instanceName]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={wrapRef}
        className="h-full w-full"
        style={{ transformOrigin: "center center", willChange: "transform" }}
      >
        <div ref={ref} className="harbor-flipbook h-full w-full" />
      </div>
    </div>
  );
}
