import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";
import "./music-skeletons.css";

export function MusicPlaylistLoading() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, []);
  return <div aria-busy="true" aria-label={t("music.loading")} style={{ minHeight: 480 }}>
    {visible && <>
      <div className="music-library-playlist-hero" aria-hidden="true" style={{ marginBottom: 40 }}>
        <span className="music-skeleton-fill music-skeleton-cover-square" />
        <div className="music-library-playlist-meta">
          <span className="music-skeleton-fill" style={{ width: "min(340px, 85%)", height: 34, marginBottom: 12 }} />
          <span className="music-skeleton-fill" style={{ width: 52, height: 52, borderRadius: "50%" }} />
          <span className="music-skeleton-fill music-skeleton-subtitle" style={{ width: 80 }} />
        </div>
      </div>
      <MusicTrackRowsSkeleton rows={6} />
    </>}
  </div>;
}

export function MusicTrackRowsSkeleton({ rows = 6 }: { rows?: number }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-label={t("music.loading")}
      aria-busy="true"
      className="music-skeleton-tracks"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="music-skeleton-track" aria-hidden="true">
          <span className="music-skeleton-fill music-skeleton-cover" />
          <span className="music-skeleton-copy">
            <span
              className="music-skeleton-fill music-skeleton-title"
              style={{ width: `${190 - (index % 3) * 25}px` }}
            />
            <span
              className="music-skeleton-fill music-skeleton-subtitle"
              style={{ width: `${110 - (index % 2) * 20}px` }}
            />
          </span>
          <span className="music-skeleton-fill music-skeleton-duration" />
        </div>
      ))}
    </div>
  );
}

export function MusicCardsSkeleton({
  count = 7,
  round = false,
}: {
  count?: number;
  round?: boolean;
}) {
  const t = useT();
  return (
    <div
      role="status"
      aria-label={t("music.loading")}
      aria-busy="true"
      className="music-skeleton-cards"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`music-skeleton-card${round ? " is-round" : ""}`}
          aria-hidden="true"
        >
          <span className="music-skeleton-fill music-skeleton-art" />
          <span className="music-skeleton-fill music-skeleton-title" />
          <span className="music-skeleton-fill music-skeleton-subtitle" />
        </div>
      ))}
    </div>
  );
}

export function MusicSectionSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="music-skeleton-section">
      <MusicTrackRowsSkeleton rows={rows} />
      <MusicCardsSkeleton />
    </div>
  );
}

export function MusicPlaylistGridSkeleton({ count = 8 }: { count?: number }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-label={t("music.loading")}
      aria-busy="true"
      className="music-library-cover-grid"
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="music-library-playlist-card is-skeleton" aria-hidden="true">
          <span className="music-skeleton-fill music-skeleton-cover-square" />
          <span
            className="music-skeleton-fill music-skeleton-title"
            style={{ width: `${68 - (index % 3) * 12}%` }}
          />
          <span className="music-skeleton-fill music-skeleton-subtitle" style={{ width: "42%" }} />
        </span>
      ))}
    </div>
  );
}

const HERO_CHOICES = 5;

export function MusicHomeHeroSkeleton() {
  const t = useT();
  return (
    <div
      role="status"
      aria-label={t("music.loading")}
      aria-busy="true"
      className="music-home-intro"
    >
      <section className="music-home-feature is-skeleton" aria-hidden="true">
        <div className="music-home-feature-copy">
          <div className="music-home-feature-swap">
            <span className="music-home-eyebrow">
              <span className="music-skeleton-fill music-skeleton-line" style={{ width: "104px" }} />
            </span>
            <h2>
              <span className="music-skeleton-fill music-skeleton-line" style={{ width: "88%" }} />
              <span className="music-skeleton-fill music-skeleton-line" style={{ width: "54%" }} />
            </h2>
            <p>
              <span className="music-skeleton-fill music-skeleton-line" style={{ width: "100%" }} />
              <span className="music-skeleton-fill music-skeleton-line" style={{ width: "66%" }} />
            </p>
            <div className="music-home-feature-actions">
              <span className="music-skeleton-fill music-skeleton-cta" />
              <span className="music-skeleton-fill music-skeleton-ghost" />
              <span className="music-skeleton-fill music-skeleton-ghost" />
            </div>
          </div>
        </div>
        <div className="music-hero-media">
          <span className="music-skeleton-fill music-skeleton-hero-art" />
        </div>
      </section>
      <div className="music-feature-browse" aria-hidden="true">
        <div
          className="music-feature-selector"
          style={{ gridTemplateColumns: `repeat(${HERO_CHOICES}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: HERO_CHOICES }, (_, index) => (
            <span key={index} className="music-feature-choice is-skeleton">
              <span className="music-skeleton-fill music-skeleton-choice-art" />
              <span className="music-skeleton-choice-copy">
                <span
                  className="music-skeleton-fill music-skeleton-choice-line"
                  style={{ width: `${84 - (index % 3) * 16}%` }}
                />
                <span
                  className="music-skeleton-fill music-skeleton-choice-line is-sub"
                  style={{ width: "52%" }}
                />
              </span>
            </span>
          ))}
        </div>
        <span className="music-skeleton-fill music-skeleton-hero-controls" />
      </div>
      <MusicCardsSkeleton count={7} />
    </div>
  );
}
