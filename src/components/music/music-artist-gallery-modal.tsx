import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Search,
  X,
} from "@/components/icons/music-icons";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { MusicLinkFavicon, linkHost } from "./music-link-favicon";
import { MusicLinkedBio } from "./music-linked-bio";
import { saveArtwork } from "@/lib/music/artwork-save";
import { loadArtistGallery, type ArtistImage } from "@/lib/music/artist-gallery";
import type { MusicArtistProfile } from "@/lib/music/artist-profile";
import "./music-artist-gallery-modal.css";

const ZOOM_STEPS = [1, 1.6, 2.4] as const;

const SOCIAL_NAMES: Record<string, string> = {
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "twitter.com": "X",
  "x.com": "X",
  "tiktok.com": "TikTok",
  "threads.net": "Threads",
};

function socialName(host: string): string {
  return SOCIAL_NAMES[host] ?? host;
}

export function MusicArtistGalleryModal({
  profile,
  tmdbKey,
  onClose,
}: {
  profile: MusicArtistProfile;
  tmdbKey?: string;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const { closing, close } = useModalExit(onClose);
  const [images, setImages] = useState<ArtistImage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [saved, setSaved] = useState<"idle" | "saving" | "done" | "error">("idle");
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadArtistGallery(profile, tmdbKey, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setImages(found);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("ready");
      });
    return () => controller.abort();
  }, [profile, tmdbKey]);

  const total = images.length;
  const step = useCallback(
    (delta: number) => {
      if (total < 2) return;
      setAt((index) => (index + delta + total) % total);
      setZoom(0);
      setSaved("idle");
    },
    [total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const current = images[at];
  const socials = profile.links.filter((link) => link.kind === "social");

  const save = () => {
    if (!current || saved === "saving") return;
    setSaved("saving");
    void saveArtwork(current.full, current.title || profile.name, profile.name)
      .then(() => setSaved("done"))
      .catch(() => setSaved("error"));
  };

  return (
    <ModalShell
      closing={closing}
      onDismiss={close}
      width={1120}
      labelledBy={titleId}
      backdropClassName="bg-black/72"
    >
      <div className="music-artist-gallery">
        <button
          type="button"
          className="music-artist-gallery-close"
          onClick={close}
          aria-label={t("common.close")}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="music-artist-gallery-stage" ref={stage} data-zoom={zoom || undefined}>
          {status === "loading" ? (
            <span className="music-artist-gallery-wait" role="status">
              <LoaderCircle size={22} className="animate-spin motion-reduce:animate-none" />
            </span>
          ) : current ? (
            <img
              key={current.full}
              src={current.full}
              alt={current.title}
              draggable={false}
              style={{ transform: `scale(${ZOOM_STEPS[zoom]})` }}
              onClick={() => setZoom((value) => (value + 1) % ZOOM_STEPS.length)}
            />
          ) : (
            <p className="music-artist-gallery-wait">{t("music.row.emptyRow")}</p>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                className="music-artist-gallery-arrow"
                data-side="start"
                onClick={() => step(-1)}
                aria-label={t("common.previous")}
              >
                <ChevronLeft className="dir-icon" size={22} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="music-artist-gallery-arrow"
                data-side="end"
                onClick={() => step(1)}
                aria-label={t("common.next")}
              >
                <ChevronRight className="dir-icon" size={22} aria-hidden="true" />
              </button>
            </>
          )}

          {current && (
            <div className="music-artist-gallery-tools">
              <button
                type="button"
                onClick={() => setZoom((value) => (value + 1) % ZOOM_STEPS.length)}
                aria-label={t("music.artist.zoom")}
                title={t("music.artist.zoom")}
              >
                <Search size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saved === "saving"}
                aria-label={t("music.artwork.save")}
                title={t("music.artwork.save")}
              >
                {saved === "saving" ? (
                  <LoaderCircle
                    size={17}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Download size={17} aria-hidden="true" />
                )}
              </button>
              {total > 1 && (
                <span className="music-artist-gallery-count">
                  {at + 1} / {total}
                </span>
              )}
            </div>
          )}
        </div>

        <aside className="music-artist-gallery-side">
          <h2 id={titleId}>{profile.name}</h2>
          {current?.credit && <p className="music-artist-gallery-credit">{current.credit}</p>}
          {profile.biography && (
            <p className="music-artist-gallery-bio">
              <MusicLinkedBio body={profile.biography} profile={profile} />
            </p>
          )}

          <dl className="music-artist-gallery-facts">
            {profile.origin && (
              <div>
                <dt>{t("music.artist.origin")}</dt>
                <dd>{profile.origin}</dd>
              </div>
            )}
            {profile.began && (
              <div>
                <dt>{t("music.artist.began")}</dt>
                <dd>{profile.began}</dd>
              </div>
            )}
          </dl>

          {socials.length > 0 && (
            <div className="music-artist-gallery-socials">
              {socials.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => {
                    event.preventDefault();
                    openUrl(link.url);
                  }}
                >
                  <MusicLinkFavicon url={link.url} fallback={null} size={16} />
                  {socialName(linkHost(link.url))}
                </a>
              ))}
            </div>
          )}

          {images.length > 1 && (
            <div className="music-artist-gallery-strip">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-current={index === at}
                  onClick={() => {
                    setAt(index);
                    setZoom(0);
                    setSaved("idle");
                  }}
                >
                  <img src={image.thumb} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </ModalShell>
  );
}
