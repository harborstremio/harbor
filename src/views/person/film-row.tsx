import { Poster, usePosterChain } from "@/components/poster";
import { Row } from "@/components/row";
import { useContextMenu } from "@/lib/context-menu";
import { creditToMeta, type PersonCredit } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useMemo } from "react";

export function FilmRow({ title, credits, showRole }: { title: string; credits: PersonCredit[]; showRole: boolean }) {
  return (
    <Row title={title}>
      {credits.map((c, i) => (
        <FilmCard key={`${c.mediaType}-${c.id}-${i}`} credit={c} showRole={showRole} />
      ))}
    </Row>
  );
}

function FilmCard({ credit, showRole }: { credit: PersonCredit; showRole: boolean }) {
  const { openMeta } = useView();
  const { open: openContextMenu } = useContextMenu();
  const { settings } = useSettings();
  const role = credit.character?.trim() || credit.job?.trim() || "";
  const meta = useMemo(() => creditToMeta(credit), [credit]);
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    credit.poster,
    credit.mediaType === "tv" ? "series" : "movie",
  );
  return (
    <button
      onClick={() => openMeta(meta)}
      onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta })}
      className="group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <Poster
        src={poster.src}
        onError={poster.onError}
        seed={`${credit.mediaType}-${credit.id}`}
        ratio="portrait"
        className="rounded-xl shadow-[0_0_0_rgba(0,0,0,0)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-2 group-hover:shadow-[0_24px_44px_-14px_rgba(0,0,0,0.6)]"
      />
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{credit.title}</p>
        {showRole && (role || credit.releaseInfo) && (
          <p className="line-clamp-1 text-[11.5px] text-ink-subtle">
            {[role, credit.releaseInfo].filter(Boolean).join(" · ")}
          </p>
        )}
        {!showRole && credit.releaseInfo && <p className="text-[11.5px] text-ink-subtle">{credit.releaseInfo}</p>}
      </div>
    </button>
  );
}
