import { useT } from "@/lib/i18n";
import { MUSIC_QUALITY_LABELS, musicTrackQuality, type MusicQuality } from "@/lib/music/quality";
import type { MusicTrack } from "@/lib/music/types";
import "./music-signal.css";

export function MusicQualityGlyph({ tier }: { tier: MusicQuality["tier"] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {tier === "hi-res" ? (
        <>
          <path
            d="M3 12V8m4 8V4m4 14V2m4 13V5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M17 2v4m-2-2h4" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : tier === "lossless" ? (
        <path
          d="M3 8v4m4-7v10m4-13v16m4-13v10m3-7v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : tier === "lossy" ? (
        <path
          d="M3 9v2m4-6v3m0 4v3m4-12v5m0 4v5m4-12v3m0 4v3m3-6v2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle
            cx="10"
            cy="10"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray="2 3"
          />
          <path d="M7 10h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function MusicQualityBadge({
  track,
  className = "",
  showEvidence = false,
}: {
  track: MusicTrack;
  className?: string;
  showEvidence?: boolean;
}) {
  const t = useT();
  const quality = musicTrackQuality(track);
  if (!quality) return null;
  const tier = t(MUSIC_QUALITY_LABELS[quality.tier]);
  const label =
    quality.tier === "lossy" && quality.format
      ? `${quality.format} · ${tier}`
      : quality.tier === "unverified"
        ? (quality.format ?? quality.label)
        : tier;
  const evidence = quality.detail
    .split(" · ")
    .filter((part) => part !== label && !label.split(" · ").includes(part))
    .join(" · ");
  return (
    <span
      className={`music-quality-badge ${className}`}
      data-tier={quality.tier}
      title={`${tier} · ${quality.detail}`}
      aria-label={`${tier} · ${quality.detail}`}
    >
      <MusicQualityGlyph tier={quality.tier} />
      <span>{label}</span>
      {showEvidence && evidence && <span className="music-quality-evidence"> · {evidence}</span>}
    </span>
  );
}
