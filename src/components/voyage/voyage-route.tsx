import { useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import {
  closeVoyage,
  launchVoyage,
  metaById,
  nextUnplayedId,
  voyageReady,
} from "@/lib/voyage/store";
import type { Voyage } from "@/lib/voyage/types";
import { RouteRail } from "./route-rail";
import { CompletePanel, ExhaustedPanel } from "./voyage-panels";
import { VoyagePicker } from "./voyage-picker";
import { VoyageReady } from "./voyage-ready";
import { VoyageLaunch, type LaunchThumb } from "./voyage-launch";
import { VoyagePrefetch } from "./voyage-prefetch";
import { VoyageSailing } from "./voyage-sailing";

export function VoyageRoute({ voyage, inline = false }: { voyage: Voyage; inline?: boolean }) {
  const t = useT();
  const { openMeta, openPicker } = useView();
  const root = useRef<HTMLDivElement>(null);
  const launching = useRef(false);
  const sailing = voyage.phase === "sailing";
  const nextId = sailing ? nextUnplayedId(voyage) : undefined;
  const next = nextId ? metaById(voyage, nextId) : undefined;
  const ready = voyageReady(voyage);
  const stuck = !sailing && !ready && voyage.headingIds.length === 0;

  const play = (meta: Meta) => {
    closeVoyage();
    if (meta.type === "movie") openPicker(meta, undefined, { autoPlay: true, resume: true });
    else openMeta(meta);
  };

  const [launch, setLaunch] = useState<LaunchThumb[] | null>(null);
  const firstUp = !sailing ? metaById(voyage, voyage.routeIds[0]) : next;

  const sail = () => {
    const first = metaById(voyage, voyage.routeIds[0]);
    launchVoyage();
    if (first) play(first);
  };

  const start = () => {
    if (launching.current) return;
    launching.current = true;
    const confirmation = root.current?.querySelectorAll<HTMLImageElement>("[data-voyage-launch-thumb]");
    const images = confirmation?.length ? confirmation : root.current?.querySelectorAll<HTMLImageElement>("[data-voyage-thumb]");
    const thumbs = [...(images ?? [])]
      .map((img) => ({ src: img.currentSrc || img.src, rect: img.getBoundingClientRect() }))
      .filter((thumb) => thumb.src && thumb.rect.width > 0);
    if (thumbs.length === 0) {
      sail();
      return;
    }
    setLaunch(thumbs);
  };

  return (
    <div ref={root} className={inline ? "voyage-inline-route" : "flex flex-col gap-6"} aria-busy={!!launch} inert={launch ? true : undefined}>
      {firstUp?.type === "movie" && <VoyagePrefetch key={firstUp.id} meta={firstUp} />}
      {launch && (
        <VoyageLaunch
          thumbs={launch}
          onDone={() => {
            setLaunch(null);
            sail();
          }}
        />
      )}
      <div className={inline ? "voyage-inline-summary" : "contents"}>
        <div className="flex flex-col gap-1">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: voyage.accent }}
          >
            {sailing ? t("On a voyage") : ready ? t("Your voyage is ready") : t("Building your voyage")}
          </span>
          <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
            {voyage.themeLabel}
          </h2>
        </div>

        <RouteRail voyage={voyage} onPlay={sailing ? play : undefined} />

      </div>
      <div className={inline ? "voyage-inline-main" : "contents"}>
        {sailing ? (
          next ? (
            <VoyageSailing voyage={voyage} next={next} onPlay={play} />
          ) : (
            <CompletePanel total={voyage.routeIds.length} />
          )
        ) : ready ? (
          <VoyageReady voyage={voyage} onStart={start} inline={inline} />
        ) : stuck ? (
          <ExhaustedPanel picked={voyage.routeIds.length} onStart={start} />
        ) : (
          <VoyagePicker voyage={voyage} inline={inline} />
        )}
      </div>
    </div>
  );
}
