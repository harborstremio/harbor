import { useRef, useState, type RefObject } from "react";
import { ScanFace } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayerBridge } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";
import { useFaceId } from "@/lib/face/use-face-id";
import { ensureFaceEngine } from "@/lib/face/face-engine";
import { useXrayCast } from "@/lib/xray/use-xray-cast";
import { TrailerOverlay } from "@/views/detail/trailer-overlay";
import { XrayRail } from "./xray-rail";
import { XrayBrowser } from "./xray-browser";
import type { XrayPerson } from "./xray-actor-card";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const doFetch = IS_TAURI ? tauriHttpFetch : fetch;
  const buf = await (await doFetch(url)).arrayBuffer();
  return createImageBitmap(new Blob([buf]));
}

type View = "closed" | "rail" | "browser";

export function XrayOverlay({
  meta,
  visible,
  isPaused,
  bridgeRef,
}: {
  meta: Meta;
  visible: boolean;
  isPaused: boolean;
  bridgeRef?: RefObject<PlayerBridge | null>;
}) {
  const { settings } = useSettings();
  const t = useT();
  const [view, setView] = useState<View>("closed");
  const [trailer, setTrailer] = useState<{ ytId: string; name: string } | null>(null);
  const resumeRef = useRef(false);
  const active = settings.xrayEnabled && view !== "closed";
  const { cast, details } = useXrayCast(meta, active);
  const { people, ready, galleryReady, progress, error } = useFaceId({
    metaKey: meta.id,
    cast: cast ?? [],
    liveScan: active,
    isPaused,
    loadBitmap,
  });

  if (!settings.xrayEnabled) return null;

  const scenePeople: XrayPerson[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    sub: p.character,
    profilePath: p.profilePath,
  }));

  const playVideo = (ytId: string, name: string) => {
    resumeRef.current = !isPaused;
    if (!isPaused) bridgeRef?.current?.pause();
    setTrailer({ ytId, name });
  };
  const closeTrailer = () => {
    setTrailer(null);
    if (resumeRef.current) void bridgeRef?.current?.play();
  };

  return (
    <>
      {visible && view === "closed" && (
        <button
          type="button"
          onClick={() => setView("rail")}
          onPointerEnter={() => void ensureFaceEngine().catch(() => {})}
          aria-label={t("X-Ray")}
          className="absolute left-4 top-20 z-20 flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 text-[12.5px] font-semibold text-white backdrop-blur-md transition-[background-color,transform] hover:bg-black/65 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <ScanFace size={15} strokeWidth={2.2} className="text-accent" /> {t("X-Ray")}
        </button>
      )}
      {view === "rail" && (
        <XrayRail
          people={scenePeople}
          ready={ready}
          galleryReady={galleryReady}
          progress={progress}
          error={error}
          needsTmdbKey={!settings.tmdbKey}
          onViewAll={() => setView("browser")}
          onClose={() => setView("closed")}
        />
      )}
      {view === "browser" && (
        <XrayBrowser
          meta={meta}
          details={details}
          people={scenePeople}
          onPlayVideo={playVideo}
          onClose={() => setView("rail")}
        />
      )}
      {trailer && (
        <TrailerOverlay id={trailer.ytId} title={trailer.name} logo={details?.logo ?? undefined} onClose={closeTrailer} />
      )}
    </>
  );
}
