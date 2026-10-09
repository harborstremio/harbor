import { useMusicConnections } from "@/components/music/music-connections";
import { SECONDARY_BUTTON } from "@/components/music/music-connections/connection-row";
import { connectorGlyph } from "@/components/music/music-cover-card";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { useT } from "@/lib/i18n";
import type { MusicConnection } from "@/lib/music/types";
import "./music-connect-card.css";

export function MusicConnectCard({
  sourceId,
  sourceName,
  body,
  connection,
  className = "",
}: {
  sourceId: string;
  sourceName?: string;
  body?: string;
  connection?: MusicConnection | null;
  className?: string;
}) {
  const t = useT();
  const { openConnections } = useMusicConnections();

  const name = sourceName ?? connection?.name ?? sourceId;
  const title = t("music.connect.shelfTitle", { name });
  const sentence = body ?? t("music.connect.shelfBody");
  const detail = connection?.error ?? connection?.detail ?? "";
  const glyph = connectorGlyph(sourceId);

  if (sourceId === "lastfm") {
    return (
      <section aria-label={title} className={`music-connect-shelf ${className}`}>
        <MusicServiceLogo source={sourceId} size={56} className="music-connect-shelf-logo" />
        <div className="music-connect-shelf-copy">
          <h3>{title}</h3>
          <p>{sentence}</p>
          {detail && <p>{detail}</p>}
        </div>
        <button
          type="button"
          onClick={() => openConnections(sourceId)}
          aria-label={t("music.connect.title", { name })}
          className="music-connect-shelf-action"
        >
          {t("music.connect.action")}
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={`animate-row-in flex min-h-[248px] w-full flex-col justify-center gap-4 rounded-xl border border-edge-soft bg-surface px-8 py-9 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {glyph && (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-[13px] font-extrabold text-ink"
          >
            {glyph}
          </span>
        )}
        <h3
          className="min-w-0 truncate text-[17px] font-medium tracking-tight text-ink"
          title={title}
        >
          {title}
        </h3>
      </div>

      <p className="max-w-[68ch] text-[13px] leading-5 text-ink-subtle">{sentence}</p>
      {detail && <p className="max-w-[68ch] text-[13px] leading-5 text-ink-subtle">{detail}</p>}

      <button
        type="button"
        onClick={() => openConnections(sourceId)}
        aria-label={t("music.connect.title", { name })}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {t("music.connect.action")}
      </button>
    </section>
  );
}
