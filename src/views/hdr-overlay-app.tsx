import { AuthProvider } from "@/lib/auth";
import { hdrOverlayEmitAction, onHdrStageProps } from "@/lib/hdr-overlay";
import { emptySnapshot, type PlayerSnapshot } from "@/lib/player/bridge";
import { createForwardingMpvBridge } from "@/lib/player/mpv-forward";
import { SettingsProvider } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { Component, useEffect, useMemo, useRef, useState } from "react";

import { DragClickStage } from "./player/drag-click-stage";
import { ShellLayer } from "./player/shell-layer";

export type HdrStagePayload = {
  snap: PlayerSnapshot;
  src: PlayerSrc;
  shellId: string;
  engine: "html5" | "mpv";
  visible: boolean;
  fullscreen: boolean;
  resolvedImdbId: string | null;
  tmdbKey: string | null;
  canChangeEpisode: boolean;
  hasPrevEp: boolean;
  hasNextEp: boolean;
  pipMode: boolean;
};

function emitDead() {
  void hdrOverlayEmitAction("hdr-stage://dead", {});
}

class OverlayErrorBoundary extends Component<{ children: React.ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch() {
    emitDead();
  }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

export function HdrOverlayApp() {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const root = document.getElementById("root");
    if (root) root.style.background = "transparent";
    window.addEventListener("beforeunload", emitDead);
    window.addEventListener("pagehide", emitDead);
    return () => {
      window.removeEventListener("beforeunload", emitDead);
      window.removeEventListener("pagehide", emitDead);
    };
  }, []);
  return (
    <AuthProvider>
      <SettingsProvider>
        <OverlayErrorBoundary>
          <HdrOverlayChrome />
        </OverlayErrorBoundary>
      </SettingsProvider>
    </AuthProvider>
  );
}

function HdrOverlayChrome() {
  const [payload, setPayload] = useState<HdrStagePayload | null>(null);
  const bridge = useMemo(() => createForwardingMpvBridge(), []);
  const bridgeRef = useRef(bridge);
  const snapRef = useRef<PlayerSnapshot>(emptySnapshot);
  const gotPayloadRef = useRef(false);

  useEffect(() => {
    const un = onHdrStageProps<HdrStagePayload>((p) => {
      gotPayloadRef.current = true;
      setPayload(p);
      snapRef.current = p.snap;
      bridge.pushSnapshot(p.snap);
    });
    void hdrOverlayEmitAction("hdr-stage://request", {});
    let tries = 0;
    const id = window.setInterval(() => {
      if (gotPayloadRef.current || tries++ > 40) {
        window.clearInterval(id);
        return;
      }
      void hdrOverlayEmitAction("hdr-stage://request", {});
    }, 150);
    return () => {
      window.clearInterval(id);
      void un.then((fn) => fn()).catch(() => {});
    };
  }, [bridge]);

  useEffect(() => {
    if (!payload) return;
    const id = requestAnimationFrame(() => void hdrOverlayEmitAction("hdr-stage://ready", {}));
    return () => cancelAnimationFrame(id);
  }, [payload]);

  useEffect(() => {
    let last = 0;
    const onMove = () => {
      const now = performance.now();
      if (now - last < 200) return;
      last = now;
      void hdrOverlayEmitAction("hdr-stage://activity", {});
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  if (!payload) return <div className="fixed inset-0" style={{ background: "transparent" }} />;
  const { snap, src } = payload;

  const act = (event: string, args: unknown = {}) => void hdrOverlayEmitAction(event, args);
  const download = {
    status: { kind: "idle" } as const,
    start: async () => {},
    cancel: () => {},
    reveal: async () => {},
    reset: () => {},
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "transparent" }}>
      <DragClickStage
        drawMode={false}
        pipMode={payload.pipMode}
        onClick={() => act("hdr-stage://play-pause")}
        onDoubleClick={() => act("hdr-stage://fullscreen")}
      />
      <ShellLayer
        shellId={payload.shellId}
        shellSnap={snap}
        snapRef={snapRef}
        bridgeRef={bridgeRef}
        engine={payload.engine}
        visible={payload.visible}
        fullscreen={payload.fullscreen}
        drawMode={false}
        hideOthersDrawings={false}
        pipMode={payload.pipMode}
        showDraw={false}
        metaId={src.meta.id}
        onMenuOpenChange={(open) => act("hdr-stage://menu-open", { open })}
        onBack={() => act("hdr-stage://back")}
        onPlayPause={() => act("hdr-stage://play-pause")}
        onSeek={(sec) => act("hdr-stage://seek", { sec })}
        onSeekStep={(delta) => act("hdr-stage://seek-step", { delta })}
        rememberSubChoice={(t) => act("hdr-stage://remember-sub", { lang: t?.lang ?? null })}
        onPiP={() => act("hdr-stage://pip")}
        onFullscreen={() => act("hdr-stage://fullscreen")}
        openCastMenu={() => act("hdr-stage://cast")}
        onToggleDraw={() => {}}
        onToggleHideOthers={() => {}}
        onClearDraw={() => {}}
        onScreenshot={() => act("hdr-stage://screenshot")}
        onPickAnother={() => act("hdr-stage://pick-another")}
        canPickAnother={false}
        title={src.title}
        subtitle={src.subtitle}
        hoverTitle={src.meta.name}
        hoverSub={
          src.episode
            ? `S${src.episode.imdbSeason ?? src.episode.season} · E${String(src.episode.imdbEpisode ?? src.episode.episode).padStart(2, "0")}`
            : undefined
        }
        hasPrevEp={payload.hasPrevEp}
        hasNextEp={payload.hasNextEp}
        onPrevEp={() => act("hdr-stage://prev-ep")}
        onNextEp={() => act("hdr-stage://next-ep")}
        metaImdbId={payload.resolvedImdbId}
        metaTitle={src.meta.name ?? null}
        metaReleaseDate={src.meta.releaseDate ?? null}
        meta={src.meta}
        tmdbKey={payload.tmdbKey}
        season={src.episode?.season ?? null}
        episode={src.episode?.episode ?? null}
        download={download}
        sleep={undefined}
      />
    </div>
  );
}
