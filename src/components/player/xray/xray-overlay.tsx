import { useRef, useState, type RefObject } from "react";
import { ScanFace } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayerBridge } from "@/lib/player/bridge";
import type { CastEntry } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";
import { useFaceId } from "@/lib/face/use-face-id";
import { useXrayCast } from "@/lib/xray/use-xray-cast";
import { usePageVisible } from "@/lib/visibility";
import { TrailerOverlay } from "@/views/detail/trailer-overlay";
import { XrayRail } from "./xray-rail";
import { XrayBrowser } from "./xray-browser";
import type { XrayPerson } from "./xray-actor-card";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const NO_CAST: CastEntry[] = [];

async function loadBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const response = IS_TAURI ? await tauriHttpFetch(url, { signal }) : await fetch(url, { signal });
  const buf = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
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
  const pageVisible = usePageVisible();
  const [view, setView] = useState<View>("closed");
  const [trailer, setTrailer] = useState<{ ytId: string; name: string } | null>(null);
  const resumeRef = useRef(false);
  const active = settings.xrayEnabled && view !== "closed";
  // Matching is meaningful only on the compact now-playing rail. Stop the
  // expensive frame capture while the user is browsing the cast or a profile.
  const liveScan = view === "rail" && settings.xrayLiveScan;
  const { cast, details } = useXrayCast(meta, active);
  const { people, ready, galleryReady, progress, error } = useFaceId({
    metaKey: meta.id,
    cast: cast ?? NO_CAST,
    liveScan: liveScan && pageVisible,
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

  const castFallback: XrayPerson[] = (cast ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sub: c.character,
    profilePath: c.profilePath,
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
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setView("rail");
          }}
          aria-label={t("X-Ray")}
          className="pointer-events-auto absolute left-4 top-20 z-30 flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 text-[12.5px] font-semibold text-white backdrop-blur-md transition-[background-color,transform] hover:bg-black/65 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <ScanFace size={15} strokeWidth={2.2} className="text-accent" /> {t("X-Ray")}
        </button>
      )}
      {view === "rail" && (
        <XrayRail
          people={scenePeople}
          castPeople={castFallback}
          ready={ready}
          galleryReady={galleryReady}
          progress={progress}
          error={error}
          liveScan={liveScan}
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
        <TrailerOverlay
          id={trailer.ytId}
          title={trailer.name}
          logo={details?.logo ?? undefined}
          onClose={closeTrailer}
        />
      )}
    </>
  );
}
