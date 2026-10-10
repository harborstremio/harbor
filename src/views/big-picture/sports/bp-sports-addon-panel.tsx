import { useEffect, useRef } from "react";
import type { SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { BpStreams } from "../bp-streams";
import { bpFirstVisible } from "../bp-visible";
import { currentBpFocus, recoverBpFocus, setBpFocus } from "../use-bp-focus";
import { BpSportsAddonListings } from "./bp-sports-addon-listings";
import { useBpSportsAddonPick } from "./bp-sports-addon-play";
import { BP_ADDON_HEAD, BP_ADDON_NOTE } from "./bp-sports-addon-parts";
import { BpSportsAddonStreams } from "./bp-sports-addon-streams";
import type { BpSportsAddonSources } from "./bp-sports-addon-sources";

const SCRIM =
  "absolute inset-0 z-[72] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_84%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]";

const CARD =
  "flex max-h-[92vh] w-[min(88vw,1040px)] flex-col gap-[clamp(12px,1.6vh,24px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(24px,2.6vw,44px)]";

export function BpSportsAddonPanel({
  sources,
  initial,
  onClose,
}: {
  sources: BpSportsAddonSources;
  initial: SportsAddonListing | null;
  onClose: () => void;
}) {
  const t = useBpT();
  const pick = useBpSportsAddonPick(sources);
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const state = useRef({ picked: false, handoff: false });
  const { choose, back, handoff, picked, closeHandoff } = pick;
  state.current = { picked: picked !== null, handoff: handoff !== null };

  useEffect(() => {
    if (initial) choose(initial);
  }, [initial, choose]);

  useEffect(() => {
    const previous = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  const listing = picked ? picked.key : "list";
  const filled = picked ? pick.streams.length > 0 : sources.rows.length > 0;
  const view = `${listing}:${filled ? "ready" : "empty"}`;
  const placed = useRef<HTMLElement | null>(null);

  useEffect(() => {
    placed.current = null;
  }, [listing]);

  useEffect(() => {
    if (state.current.handoff) return;
    const id = window.requestAnimationFrame(() => {
      const next = seedRef.current;
      if (!next) return;
      const now = currentBpFocus(bpFirstVisible("[data-bp-root]"));
      if (placed.current !== null && now !== null && now !== placed.current) return;
      setBpFocus(next, { silent: true });
      placed.current = next;
    });
    return () => window.cancelAnimationFrame(id);
  }, [view]);

  useEffect(
    () =>
      pushBpBack(() => {
        if (state.current.handoff) return false;
        if (state.current.picked) {
          back();
          return true;
        }
        onClose();
        return true;
      }),
    [back, onClose],
  );

  return (
    <>
      <div
        role="dialog"
        aria-label={t("Addon sources")}
        data-bp-dialog
        className={`${SCRIM} ${handoff ? "invisible pointer-events-none" : ""}`}
      >
        <div className={CARD}>
          <h2 className={BP_ADDON_HEAD}>{picked ? t("Addon streams") : t("Addon sources")}</h2>

          {sources.failed && (
            <p role="status" className={BP_ADDON_NOTE}>
              {t("Some addons did not respond. Try again.")}
            </p>
          )}

          {picked ? (
            <BpSportsAddonStreams pick={pick} seedRef={seedRef} />
          ) : (
            <BpSportsAddonListings
              sources={sources}
              onChoose={choose}
              onClose={onClose}
              seedRef={seedRef}
            />
          )}
        </div>
      </div>

      {handoff && (
        <BpStreams
          meta={handoff}
          onClose={() => {
            closeHandoff();
            window.requestAnimationFrame(() => recoverBpFocus());
          }}
        />
      )}
    </>
  );
}
