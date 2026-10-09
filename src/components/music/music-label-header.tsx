import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadMusicLabelPage, type MusicLabelPage } from "@/lib/music/label-page-data";
import "./music-label-header.css";

const YEAR = /^(\d{4})/;
const year = (value: string) => YEAR.exec(value)?.[1] ?? "";

export function MusicLabelHeader({ labelId, name }: { labelId: string; name: string }) {
  const t = useT();
  const [page, setPage] = useState<MusicLabelPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    const controller = new AbortController();
    void loadMusicLabelPage(labelId, controller.signal)
      .then((next) => {
        if (!cancelled) setPage(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [labelId]);

  const profile = page?.profile;
  const began = year(profile?.began ?? "");
  const ended = year(profile?.ended ?? "");
  const facts = [
    profile?.kind,
    profile?.country,
    began ? (ended ? `${began}–${ended}` : t("music.label.since", { year: began })) : "",
  ].filter((fact): fact is string => Boolean(fact));

  if (!page) return <div className="music-label-header" data-loading aria-hidden="true" />;

  return (
    <div className="music-label-header">
      {page.logo ? (
        <img className="music-label-logo" src={page.logo} alt="" draggable={false} />
      ) : (
        <span className="music-label-mark" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
      <div className="music-label-facts">
        {facts.length > 0 && <p className="music-label-line">{facts.join(" · ")}</p>}
        {page.description && <p className="music-label-note">{page.description}</p>}
        {profile?.homepage && (
          <button type="button" onClick={() => openUrl(profile.homepage)}>
            {t("music.label.website")}
          </button>
        )}
      </div>
      {page.releases.length > 0 && (
        <p className="music-label-count">
          {t("music.label.releaseCount", { count: page.releases.length })}
        </p>
      )}
    </div>
  );
}
