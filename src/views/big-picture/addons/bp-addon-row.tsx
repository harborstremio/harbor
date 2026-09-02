import { useCallback, useEffect, useMemo, useRef } from "react";
import { pushBigPicture } from "@/lib/big-picture";
import { useBpT } from "../bp-i18n";
import { BpRowHeader } from "../bp-row-header";
import { publishBpBandArt, type BpBandArt } from "../use-bp-sections";
import { BP_ADDON_TRACK, BpAddonCard } from "./bp-addon-card";
import { BP_ADDON_MOSAIC_MIN } from "./bp-addon-posters";
import { useBpAddonRow, type BpAddonEntry } from "./use-bp-addon-row";

export function BpAddonRow() {
  const t = useBpT();
  const { entries, posters, onFocusAddon } = useBpAddonRow();

  const byUrl = useMemo(
    () => new Map(entries.map((e) => [e.transportUrl, e] as const)),
    [entries],
  );

  // same() in use-bp-sections compares poster lists by length alone, which is
  // only safe because the pool appends and never replaces: a base's list length
  // is monotonic for the session, so a genuine update always changes it. Do not
  // add a path that shortens a pool without revisiting that comparison.
  const recordFor = useCallback(
    (entry: BpAddonEntry, list: readonly string[] | undefined): BpBandArt => ({
      key: `addon:${entry.transportUrl}`,
      // "bug", never "subject": BpBandIdentity paints the subject mark through
      // --service-logo-filter, which is brightness(0) invert(1) inside Big
      // Picture. Correct for a monochrome service wordmark, and it would render
      // a colour addon icon as a white blob. As a bug the mark keeps its own
      // colour and the addon name becomes the hero subject.
      logoScale: "bug",
      logo: entry.logo,
      title: entry.name,
      posters: list && list.length >= BP_ADDON_MOSAIC_MIN ? list : undefined,
    }),
    [],
  );

  // No tint is published. BpAmbient's own useArtGlow(bandArt.logo) samples the
  // addon's mark for the tint band, so the colour still comes from the addon's
  // own artwork rather than from anything invented here.
  //
  // Held in a ref, not state. Focus is written on every arrow step, and routing
  // it through state re-rendered the row and all sixteen cards per step on a
  // panel that repeats D-pad presses.
  const focusedRef = useRef<BpAddonEntry | null>(null);

  // The poster pool resolves long after the focus that asked for it, so the band
  // has to be republished when it lands. Publishing from onFocus alone leaves the
  // band mosaic permanently empty.
  useEffect(() => {
    const entry = focusedRef.current;
    if (entry) publishBpBandArt("addons", recordFor(entry, posters.get(entry.base)));
  }, [posters, recordFor]);

  // publishBpBandArt writes into a module map that outlives this row, so a record
  // for an addon that has since been uninstalled would keep painting the hero on
  // every later focus in this band.
  useEffect(() => {
    if (entries.length === 0) publishBpBandArt("addons", null);
  }, [entries.length]);

  useEffect(() => () => publishBpBandArt("addons", null), []);

  const openAddon = useCallback((entry: BpAddonEntry) => {
    pushBigPicture({
      kind: "addon",
      addonId: entry.id,
      name: entry.name,
      base: entry.base,
      logo: entry.logo,
    });
  }, []);

  const title = t("Your addons");

  // No action, and therefore no data-bp-row-tab: Big Picture has no addon
  // management surface, bp-settings.tsx does not mention addons at all, so an
  // escape here would promise a page that does not exist. Left at the start of
  // this row falls through to the plain active-tab landing, which is honest.
  // When a surface is built this gains an action and a tab and nothing else.
  //
  // This row used to open with a lead tile carrying exactly that missing
  // destination: it took focus, played a click on Enter, and did nothing. On a
  // remote there is nothing more expensive than a rectangle that lights up and
  // does not answer.

  // bp-home pushes this row unconditionally and empty:hidden collapses the
  // wrapper, so the rail index stays present and contiguous while the row itself
  // contributes nothing focusable. There is no loading state to stand in for:
  // readLocalAddonEntries is a synchronous localStorage read, so a user with
  // addons has real cards in frame 0 and a user without them never sees a
  // placeholder for something they do not have.
  const lead = entries[0];
  if (!lead) return null;

  return (
    <section data-bp-row data-bp-row-key="addons" aria-label={title} className="relative">
      <BpRowHeader title={title} />
      <div
        data-bp-scroll-x
        onFocus={(e) => {
          const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-bp-addon]");
          const entry = (cell?.dataset.bpAddon ? byUrl.get(cell.dataset.bpAddon) : undefined) ?? lead;
          focusedRef.current = entry;
          // The label tile publishes its own record for the lead addon, so this
          // only speaks for real cards. Both paths agree because both are
          // recordFor of the same entry.
          if (cell) {
            publishBpBandArt("addons", recordFor(entry, posters.get(entry.base)));
            onFocusAddon(entry.transportUrl);
          } else {
            onFocusAddon(null);
          }
        }}
        className={BP_ADDON_TRACK}
      >
        {entries.map((entry) => (
          <BpAddonCard
            key={entry.key}
            entry={entry}
            posters={posters.get(entry.base)}
            onOpen={openAddon}
          />
        ))}
      </div>
    </section>
  );
}
