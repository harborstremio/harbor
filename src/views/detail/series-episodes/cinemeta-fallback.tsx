import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { CinemetaEpisodeRow } from "../cinemeta-episodes";

export function CinemetaFallback({
  meta,
  videos,
  season,
}: {
  meta: Meta;
  videos: NonNullable<Meta["videos"]> | undefined;
  season: number;
}) {
  const t = useT();
  const eps = useMemo(() => {
    if (!videos) return [];
    return videos
      .filter((v) => v.season === season && v.episode != null)
      .slice()
      .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  }, [videos, season]);
  if (eps.length === 0) {
    return (
      <p className="text-[14px] text-ink-subtle">{t("No episodes available for this season.")}</p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {eps.map((ep) => (
        <CinemetaEpisodeRow key={ep.id ?? `${ep.season}-${ep.episode}`} meta={meta} ep={ep} />
      ))}
    </div>
  );
}
