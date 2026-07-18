import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useContextMenu } from "@/lib/context-menu";
import { setPreviewTmdbKey } from "@/lib/hover-preview/preview-data";
import {
  closeHoverPreview,
  getHoverPreviewSnapshot,
  hoverPreviewPanelEnter,
  hoverPreviewPanelLeave,
  setHoverPreviewGates,
  setHoverPreviewPanel,
  subscribeHoverPreview,
} from "@/lib/hover-preview/store";
import {
  CHILD_MS,
  CHILD_RISE_PX,
  CLICK_SHIELD_MOVE_PX,
  CLICK_SHIELD_MS,
  CLOSE_EASE,
  CLOSE_MS,
  CLOSE_SCALE_TO,
  EASE_OUT,
  GUTTER_PX,
  HALO_MORPH_MS,
  HARD_CLOSE_MS,
  MORPH_FADE_IN_MS,
  MORPH_FADE_OUT_MS,
  MORPH_MOVE_MS,
  MORPH_RISE_PX,
  OPEN_EASE,
  PANEL_DRAG_CLICK_PX,
  REDUCED_MS,
  STAGGER_STEP_MS,
  TOPBAR_INSET_PX,
} from "@/lib/hover-preview/timing";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { activeLayout } from "@/lib/theme";
import { useView } from "@/lib/view";
import { PreviewBlock } from "./hover-preview/block";
import { PreviewCrown } from "./hover-preview/crown";
import { useMedia, type Scene } from "./hover-preview/scene";
import { crownHeightFor, panelWidthFor, placePanel } from "./hover-preview/use-preview-position";

export function HoverPreview() {
  const { settings } = useSettings();
  const view = useView();
  const search = useSearch();
  const menu = useContextMenu();
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const viewRef = useRef(view);
  viewRef.current = view;
  const menuRef = useRef(menu);
  menuRef.current = menu;

  useEffect(() => {
    setPreviewTmdbKey(settings.tmdbKey);
  }, [settings.tmdbKey]);

  useEffect(() => {
    setHoverPreviewGates({
      enabled: settings.hoverPreviewEnabled && settings.cardHoverStyle === "default",
      finePointer,
      viewClear: view.player === null && view.picker === null && !view.chromeHidden,
      searchClosed: !search.open,
      menuClosed: menu.state === null,
    });
  }, [
    settings.hoverPreviewEnabled,
    settings.cardHoverStyle,
    finePointer,
    view.player,
    view.picker,
    view.chromeHidden,
    search.open,
    menu.state,
  ]);

  const snap = useSyncExternalStore(subscribeHoverPreview, getHoverPreviewSnapshot);

  const [scene, setScene] = useState<Scene | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  sceneRef.current = scene;

  const frameRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef(new Map<number, HTMLDivElement>());
  const layerKeyRef = useRef(0);
  const revealedSeqRef = useRef(0);
  const morphedKeyRef = useRef(0);
  const prevSnapRef = useRef({ status: "idle" as string, openSeq: 0, morphSeq: 0, artSeq: 0 });

  const openedAtRef = useRef(0);
  const travelRef = useRef(0);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const prev = prevSnapRef.current;
    prevSnapRef.current = {
      status: snap.status,
      openSeq: snap.openSeq,
      morphSeq: snap.morphSeq,
      artSeq: snap.artSeq,
    };
    if (snap.status === "open" && snap.payload) {
      const payload = snap.payload;
      if (snap.openSeq !== prev.openSeq) {
        const width = panelWidthFor(settingsRef.current.posterScale);
        const layout = activeLayout(settingsRef.current.theme);
        layerKeyRef.current += 1;
        setScene({
          seq: snap.openSeq,
          width,
          crownH: crownHeightFor(width),
          topInset: layout === "topdock" || layout === "royal" ? TOPBAR_INSET_PX : GUTTER_PX,
          pos: null,
          height: 0,
          nextHeight: 0,
          current: { key: layerKeyRef.current, payload },
          outgoing: null,
          incoming: null,
          exiting: null,
        });
      } else if (snap.morphSeq !== prev.morphSeq) {
        layerKeyRef.current += 1;
        const key = layerKeyRef.current;
        setScene((s) => (s && !s.exiting ? { ...s, incoming: { key, payload } } : s));
      } else if (snap.artSeq !== prev.artSeq) {
        setScene((s) => {
          if (!s || s.exiting) return s;
          if (s.incoming) return { ...s, incoming: { ...s.incoming, payload } };
          return { ...s, current: { ...s.current, payload } };
        });
      }
    } else if (snap.status === "idle" && prev.status === "open") {
      setScene((s) => (s && !s.exiting ? { ...s, exiting: snap.closeMode } : s));
    }
  }, [snap]);

  useLayoutEffect(() => {
    if (!scene || scene.pos || scene.exiting) return;
    const el = layerEls.current.get(scene.current.key);
    if (!el) return;
    const h = Math.round(el.offsetHeight);
    const pos = placePanel(
      scene.current.payload.rect,
      scene.width,
      h,
      scene.topInset,
      settingsRef.current.hoverPreviewPlacement,
    );
    setScene((s) => (s && s.seq === scene.seq && !s.pos ? { ...s, pos, height: h } : s));
  }, [scene]);

  useLayoutEffect(() => {
    if (!scene?.pos || scene.exiting) return;
    if (revealedSeqRef.current === scene.seq) return;
    revealedSeqRef.current = scene.seq;
    morphedKeyRef.current = scene.current.key;
    openedAtRef.current = performance.now();
    travelRef.current = 0;
    lastPosRef.current = null;
    downPosRef.current = null;
    if (reduced) {
      frameRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: REDUCED_MS,
        easing: "linear",
        fill: "backwards",
      });
      return;
    }
    const layer = layerEls.current.get(scene.current.key);
    layer?.querySelectorAll<HTMLElement>("[data-stagger]").forEach((el) => {
      const group = Number(el.dataset.stagger) || 0;
      el.animate(
        [
          { opacity: 0, transform: `translateY(${CHILD_RISE_PX}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: CHILD_MS, delay: group * STAGGER_STEP_MS, easing: EASE_OUT, fill: "backwards" },
      );
    });
  }, [scene, reduced]);

  useLayoutEffect(() => {
    if (!scene?.incoming || scene.exiting) return;
    const el = layerEls.current.get(scene.incoming.key);
    if (!el) return;
    const h = Math.round(el.offsetHeight);
    const pos = placePanel(
      scene.incoming.payload.rect,
      scene.width,
      h,
      scene.topInset,
      settingsRef.current.hoverPreviewPlacement,
    );
    setScene((s) => {
      if (!s || !s.incoming || s.incoming.key !== scene.incoming?.key) return s;
      return { ...s, outgoing: s.current, current: s.incoming, incoming: null, pos, nextHeight: h };
    });
  }, [scene]);

  const morphTimersRef = useRef<number[]>([]);
  useEffect(
    () => () => {
      for (const t of morphTimersRef.current) window.clearTimeout(t);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!scene?.outgoing || scene.exiting) return;
    if (morphedKeyRef.current === scene.current.key) return;
    morphedKeyRef.current = scene.current.key;
    const currentKey = scene.current.key;
    const outEl = layerEls.current.get(scene.outgoing.key);
    const inEl = layerEls.current.get(currentKey);
    if (reduced) {
      outEl?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: REDUCED_MS,
        easing: "linear",
        fill: "forwards",
      });
      inEl?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: REDUCED_MS,
        easing: "linear",
        fill: "backwards",
      });
    } else {
      outEl?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: MORPH_FADE_OUT_MS,
        easing: "ease-in",
        fill: "forwards",
      });
      inEl?.animate(
        [
          { opacity: 0, transform: `translateY(${MORPH_RISE_PX}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: MORPH_FADE_IN_MS, easing: EASE_OUT, fill: "backwards" },
      );
    }
    for (const t of morphTimersRef.current) window.clearTimeout(t);
    morphTimersRef.current = [
      window.setTimeout(
        () => {
          setScene((s) => (s && s.current.key === currentKey ? { ...s, height: s.nextHeight } : s));
        },
        reduced ? 0 : MORPH_FADE_OUT_MS,
      ),
      window.setTimeout(
        () => {
          setScene((s) => (s && s.current.key === currentKey ? { ...s, outgoing: null } : s));
        },
        reduced ? REDUCED_MS : Math.max(MORPH_MOVE_MS, HALO_MORPH_MS),
      ),
    ];
  }, [scene, reduced]);

  useEffect(() => {
    if (!scene?.exiting) return;
    const frame = frameRef.current;
    if (!frame) {
      setScene(null);
      return;
    }
    const seq = scene.seq;
    const done = () => setScene((s) => (s && s.seq === seq ? null : s));
    if (reduced) {
      frame.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: REDUCED_MS,
        easing: "linear",
        fill: "forwards",
      }).onfinish = done;
      return;
    }
    if (scene.exiting === "hard") {
      frame.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: HARD_CLOSE_MS,
        easing: "linear",
        fill: "forwards",
      }).onfinish = done;
      return;
    }
    panelRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${CLOSE_SCALE_TO})` }],
      {
        duration: CLOSE_MS,
        easing: CLOSE_EASE,
        fill: "forwards",
      },
    );
    frame.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: CLOSE_MS,
      easing: CLOSE_EASE,
      fill: "forwards",
    }).onfinish = done;
  }, [scene?.exiting, scene?.seq, reduced]);

  useLayoutEffect(() => {
    if (scene && !scene.exiting) setHoverPreviewPanel(panelRef.current);
    else setHoverPreviewPanel(null);
  }, [scene]);

  useEffect(() => () => setHoverPreviewPanel(null), []);

  const setLayerEl = useCallback(
    (key: number) => (el: HTMLDivElement | null) => {
      if (el) layerEls.current.set(key, el);
      else layerEls.current.delete(key);
    },
    [],
  );

  const onDetails = useCallback(() => {
    const payload = sceneRef.current?.current.payload;
    closeHoverPreview("hard");
    if (payload) viewRef.current.openMeta(payload.meta);
  }, []);

  const onPanelPointerMove = useCallback((e: React.PointerEvent) => {
    const last = lastPosRef.current;
    if (last) travelRef.current += Math.hypot(e.clientX - last.x, e.clientY - last.y);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPanelPointerDown = useCallback((e: React.PointerEvent) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPanelClick = useCallback((e: React.MouseEvent) => {
    const s = sceneRef.current;
    if (!s || s.exiting) return;
    const down = downPosRef.current;
    downPosRef.current = null;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > PANEL_DRAG_CLICK_PX) return;
    const payload = s.current.payload;
    const shielded =
      performance.now() - openedAtRef.current < CLICK_SHIELD_MS &&
      travelRef.current < CLICK_SHIELD_MOVE_PX;
    closeHoverPreview("hard");
    const resume = payload.data.resume;
    if (!shielded && resume && !resume.external) {
      const episode =
        resume.season != null && resume.episode != null
          ? { season: resume.season, episode: resume.episode }
          : undefined;
      viewRef.current.openPicker(payload.meta, episode, {
        autoPlay: settingsRef.current.instantPlay,
        resume: true,
      });
    } else {
      viewRef.current.openMeta(payload.meta);
    }
  }, []);

  const onPanelContextMenu = useCallback((e: React.MouseEvent) => {
    const payload = sceneRef.current?.current.payload;
    closeHoverPreview("hard");
    if (payload) menuRef.current.open(e, { kind: "meta", meta: payload.meta });
  }, []);

  if (!scene) return null;

  const revealed = scene.pos !== null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[110]">
      <div
        key={scene.seq}
        ref={frameRef}
        className={`absolute left-0 top-0 ${scene.exiting ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{
          width: scene.width,
          transform: scene.pos
            ? `translate3d(${scene.pos.left}px, ${scene.pos.top}px, 0)`
            : "translate3d(0px, 0px, 0)",
          visibility: revealed ? "visible" : "hidden",
          transition:
            scene.outgoing && !reduced ? `transform ${MORPH_MOVE_MS}ms ${OPEN_EASE}` : undefined,
        }}
      >
        <div
          ref={panelRef}
          role="presentation"
          aria-hidden
          onPointerEnter={hoverPreviewPanelEnter}
          onPointerLeave={hoverPreviewPanelLeave}
          onPointerMove={onPanelPointerMove}
          onPointerDown={onPanelPointerDown}
          onClick={onPanelClick}
          onContextMenu={onPanelContextMenu}
          className={`group relative cursor-pointer overflow-hidden rounded-xl bg-elevated shadow-[0_24px_60px_-20px_rgba(0,0,0,0.78)] ring-1 ring-edge-soft ${
            revealed && !reduced ? "animate-preview-in" : ""
          }`}
          style={{
            height: revealed ? scene.height : undefined,
            transformOrigin: scene.pos
              ? `${scene.pos.originX}px ${scene.pos.originY}px`
              : undefined,
          }}
        >
          {scene.outgoing && (
            <div
              key={scene.outgoing.key}
              ref={setLayerEl(scene.outgoing.key)}
              className="absolute inset-x-0 top-0"
            >
              <PreviewCrown data={scene.outgoing.payload.data} height={scene.crownH} />
              <PreviewBlock data={scene.outgoing.payload.data} onDetails={onDetails} />
            </div>
          )}
          <div key={scene.current.key} ref={setLayerEl(scene.current.key)}>
            <PreviewCrown data={scene.current.payload.data} height={scene.crownH} />
            <PreviewBlock data={scene.current.payload.data} onDetails={onDetails} />
          </div>
          {scene.incoming && (
            <div
              key={scene.incoming.key}
              ref={setLayerEl(scene.incoming.key)}
              className="invisible absolute inset-x-0 top-0"
            >
              <PreviewCrown data={scene.incoming.payload.data} height={scene.crownH} />
              <PreviewBlock data={scene.incoming.payload.data} onDetails={onDetails} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
