import { Zap } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { useDebridClients } from "@/lib/debrid/registry";
import { useT } from "@/lib/i18n";
import type { ScoredStream } from "@/lib/streams/types";
import { directStreamAvailable } from "@/lib/torrent/stremio-stream";

export function PlayProvenance({
  stream,
  debrids,
  isCached,
  addonLogo,
}: {
  stream: ScoredStream;
  debrids: ReturnType<typeof useDebridClients>;
  isCached: boolean;
  addonLogo: string | null;
}) {
  const t = useT();
  const addonChip = (
    <span className="inline-flex items-center gap-1.5">
      <AddonLogo
        addonId={stream.addonId}
        addonName={stream.addonName}
        manifestLogo={addonLogo}
        size="xs"
      />
      <span>{stream.addonName}</span>
    </span>
  );

  if (stream.url) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-subtle">
        <span>{t("via")}</span>
        {addonChip}
      </p>
    );
  }
  if (debrids.length === 0) {
    if (directStreamAvailable(stream)) {
      return (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            {t("Streams from peers")}
          </p>
          <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-ink-subtle/70">
            <span>{t("found by")}</span>
            {addonChip}
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-danger/80">
          {t("No debrid configured")}
        </p>
        <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-ink-subtle/80">
          <span>{t("add one in settings")}</span>
          <span aria-hidden>·</span>
          <span>{t("found by")}</span>
          {addonChip}
        </p>
      </div>
    );
  }
  const cached = debrids.find((d) => stream.cached[d.slug]);
  const target = cached ?? debrids[0];
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
        {isCached && <Zap size={10} fill="currentColor" strokeWidth={0} className="text-accent" />}
        {isCached ? (
          <>
            <span>{t("plays via")}</span>
            <span>{target.name}</span>
          </>
        ) : (
          t("uncached on debrid")
        )}
      </p>
      <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-ink-subtle/70">
        <span>{t("found by")}</span>
        {addonChip}
      </p>
    </div>
  );
}
