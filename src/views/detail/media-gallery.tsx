import { useCallback, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { createPortal } from "react-dom";
import { saveImageToDisk, saveTrailerToDisk } from "@/lib/download/save-binary";
import { t } from "@/lib/i18n";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { setTitleLogo } from "@/lib/title-logo";
import { resolveTrailerQuality } from "@/lib/trailer";
import { TrailerOverlay } from "./trailer-overlay";
import { MediaLightbox } from "./media-lightbox";
import { MediaRail } from "./media-gallery/media-rail";
import { ImageTile, LogoTile, VideoTile, type GalleryVideo } from "./media-gallery/media-tiles";

type Tab = "videos" | "backdrops" | "posters" | "logos";

const BACKDROP_DIM = 0.5;

export function MediaGallery({
  detail,
  title,
  logo,
  metaId,
}: {
  detail: TmdbDetail;
  title: string;
  logo?: string;
  metaId: string;
}) {
  const { settings, update } = useSettings();
  const videos = useMemo(() => collectVideos(detail), [detail]);
  const backdrops = detail.gallery.backdrops;
  const posters = detail.gallery.posters;
  const logos = detail.gallery.logos;

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string; count: number }> = [];
    if (videos.length > 0) list.push({ id: "videos", label: t("Videos"), count: videos.length });
    if (backdrops.length > 0)
      list.push({ id: "backdrops", label: t("Backdrops"), count: backdrops.length });
    if (posters.length > 0)
      list.push({ id: "posters", label: t("Posters"), count: posters.length });
    if (logos.length > 0) list.push({ id: "logos", label: t("Logos"), count: logos.length });
    return list;
  }, [videos.length, backdrops.length, posters.length, logos.length]);

  const [active, setActive] = useState<Tab | null>(null);
  const current = active ?? tabs[0]?.id ?? null;
  const [trailer, setTrailer] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number; kind: Tab } | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((cur) => (cur === text ? null : cur)), 2400);
  }, []);

  const slug = useMemo(() => baseName(title), [title]);

  const downloadImage = useCallback(
    (url: string, kind: string, i: number) => {
      saveImageToDisk(url, `${slug}-${kind}-${i + 1}`)
        .then((r) => {
          if (r.saved) flash(t("Saved to disk"));
        })
        .catch(() => flash(t("Download failed")));
    },
    [slug, flash],
  );

  const downloadVideo = useCallback(
    (v: GalleryVideo) => {
      flash(t("Downloading..."));
      saveTrailerToDisk(
        v.ytId,
        resolveTrailerQuality(settings.trailerQuality),
        `${slug}-${baseName(v.name)}`,
      )
        .then((r) => flash(r.saved ? t("Saved to disk") : t("Download failed")))
        .catch(() => flash(t("Download failed")));
    },
    [slug, settings.trailerQuality, flash],
  );

  const setBackdrop = useCallback(
    (url: string) => {
      update({ theme: { ...settings.theme, backgroundImage: url, backgroundDim: BACKDROP_DIM } });
      flash(t("Set as theme backdrop"));
    },
    [settings.theme, update, flash],
  );

  const setLogo = useCallback(
    (url: string) => {
      setTitleLogo(metaId, url);
      flash(t("Set as show logo"));
    },
    [metaId, flash],
  );

  if (tabs.length === 0) return null;

  return (
    <section className="flex flex-col gap-5 ps-[9px]">
      <div className="flex items-center gap-2.5 pe-1">
        <h3 className="text-[17px] font-medium tracking-tight text-ink">{t("Media")}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
                current === tab.id
                  ? "bg-elevated text-ink ring-1 ring-edge"
                  : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {tab.label}
              <span className="text-[11px] tabular-nums text-ink-subtle">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {current === "videos" && (
        <MediaRail>
          {videos.map((v) => (
            <VideoTile
              key={v.ytId}
              v={v}
              onPlay={() => setTrailer(v.ytId)}
              onDownload={() => downloadVideo(v)}
            />
          ))}
        </MediaRail>
      )}
      {current === "backdrops" && (
        <MediaRail>
          {backdrops.map((src, i) => (
            <ImageTile
              key={src}
              src={src}
              ratio="landscape"
              pinnable
              onOpen={() => setLightbox({ images: backdrops, index: i, kind: "backdrops" })}
              onDownload={() => downloadImage(src, "backdrop", i)}
              onSetBackdrop={() => setBackdrop(src)}
            />
          ))}
        </MediaRail>
      )}
      {current === "posters" && (
        <MediaRail>
          {posters.map((src, i) => (
            <ImageTile
              key={src}
              src={src}
              ratio="portrait"
              onOpen={() => setLightbox({ images: posters, index: i, kind: "posters" })}
              onDownload={() => downloadImage(src, "poster", i)}
            />
          ))}
        </MediaRail>
      )}
      {current === "logos" && (
        <MediaRail>
          {logos.map((src, i) => (
            <LogoTile
              key={src}
              src={src}
              onOpen={() => setLightbox({ images: logos, index: i, kind: "logos" })}
              onDownload={() => downloadImage(src, "logo", i)}
              onSetLogo={() => setLogo(src)}
            />
          ))}
        </MediaRail>
      )}

      {trailer && (
        <TrailerOverlay id={trailer} title={title} logo={logo} onClose={() => setTrailer(null)} />
      )}
      {lightbox &&
        createPortal(
          <MediaLightbox
            images={lightbox.images}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onDownload={(url, i) => downloadImage(url, lightbox.kind.slice(0, -1), i)}
            onSetBackdrop={lightbox.kind === "backdrops" ? setBackdrop : undefined}
          />,
          document.body,
        )}
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[160] -translate-x-1/2 animate-popover-in">
            <div className="flex items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/95 py-1.5 ps-1.5 pe-4 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Check size={13} strokeWidth={2.6} />
              </span>
              <span className="text-[12.5px] font-medium text-ink">{toast}</span>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

function collectVideos(detail: TmdbDetail): GalleryVideo[] {
  const seen = new Set<string>();
  const out: GalleryVideo[] = [];
  for (const id of detail.trailerCandidates) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ytId: id, name: "Trailer", type: "Trailer" });
  }
  for (const v of detail.extraVideos) {
    if (seen.has(v.ytId)) continue;
    seen.add(v.ytId);
    out.push({ ytId: v.ytId, name: v.name, type: v.type });
  }
  return out;
}

function baseName(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "media";
}
