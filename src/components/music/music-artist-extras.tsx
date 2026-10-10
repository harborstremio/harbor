import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, ShoppingBag } from "@/components/icons/music-icons";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { MusicArtistProfile } from "@/lib/music/artist-profile";
import { loadArtistExtras, type ArtistExtras } from "@/lib/music/artist-extras";
import "./music-artist-extras.css";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function SiteFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);
  if (failed || !host) return <ShoppingBag size={16} aria-hidden="true" />;
  return (
    <img
      className="music-merch-favicon"
      src={`https://icons.duckduckgo.com/ip3/${host}.ico`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function MusicArtistExtras({
  profile,
  active = true,
}: {
  profile: MusicArtistProfile;
  active?: boolean;
}) {
  const t = useT();
  const language = useUiLanguage();
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    data: ArtistExtras;
  } | null>(null);
  const key = `${profile.id}:${profile.links.map((link) => link.url).join("|")}`;
  useEffect(() => {
    if (!active || near || !root.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [active, near]);
  useEffect(() => {
    if (!active || !near) return;
    const controller = new AbortController();
    void loadArtistExtras(profile, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [active, near, key]);
  const data = result?.key === key ? result.data : null;
  const events = data?.events ?? [];
  const links = data?.links ?? [];
  const tours = links.filter((link) => link.kind === "tour");
  const official = links.find((link) => link.kind === "official");
  return (
    <section ref={root} className="music-artist-extras" aria-busy={active && near && !data}>
      {!data && active && near && (
        <p className="music-artist-extras-loading" role="status">
          <LoaderCircle size={16} aria-hidden="true" />
          {t("music.extras.loading")}
        </p>
      )}
      {(events.length > 0 || tours.length > 0) && (
        <section>
          <header>
            <h2>{t("music.extras.tour")}</h2>
            {tours.slice(0, 2).map((link) => (
              <button
                key={link.url}
                type="button"
                className="music-artist-extras-link"
                onClick={() => openUrl(link.url)}
              >
                {t("music.extras.tourLink")}
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            ))}
          </header>
          {events.length > 0 && (
            <div className="music-tour-list">
              {events.map((event) => (
                <button
                  key={`${event.date}:${event.url}`}
                  type="button"
                  className="music-tour-event"
                  onClick={() => openUrl(event.url)}
                >
                  <time className="music-tour-date" dateTime={event.date}>
                    <span className="music-tour-month">
                      {new Intl.DateTimeFormat(language, {
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(`${event.date.slice(0, 10)}T12:00:00Z`))}
                    </span>
                    <span className="music-tour-day">
                      {new Intl.DateTimeFormat(language, {
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(`${event.date.slice(0, 10)}T12:00:00Z`))}
                    </span>
                  </time>
                  <span className="music-tour-where">
                    <strong>{event.city || event.venue || event.name}</strong>
                    <small>
                      {[event.venue, event.venue ? event.name : ""].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <span className="music-tour-year">
                    {new Intl.DateTimeFormat(language, {
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${event.date.slice(0, 10)}T12:00:00Z`))}
                  </span>
                  <ArrowUpRight size={18} aria-label={t("music.extras.event")} />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {data && !events.length && !tours.length && official && (
        <button type="button" className="music-merch-store" onClick={() => openUrl(official.url)}>
          <SiteFavicon url={official.url} />
          <span>{t("music.extras.official")}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      )}
      {data && events.length > 0 && (
        <p className="music-artist-extras-source">
          {t("music.extras.source", {
            source: [
              ...new Set(
                events.map((item) => new URL(item.sourceUrl).hostname.replace(/^www\./, "")),
              ),
            ].join(" · "),
          })}
        </p>
      )}
    </section>
  );
}
