import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useSettings } from "@/lib/settings";
import { readBpRowPosition, restoreKeyOf, rowKeyOf } from "./bp-restore";
import { revealBpRows } from "./bp-focus-core";
import { bpFocusables, bpOverlayOpen, recoverBpFocus, setBpFocus } from "./use-bp-focus";

export type BpPinnedRows = { cwHidden: boolean; collectionsHidden: boolean };

// Desktop keeps four home blocks out of homeRows.order and gates them by key in
// homeRows.hidden instead: cw, hero, top10, collections. Only two of those are
// Big Picture bands. `hero` is the spotlight, which is the whole backdrop
// system rather than a row, and `top10` has no band here at all, so neither is
// mapped. A TV has no customize page, so honouring a key whose surface Big
// Picture cannot offer back would blank a band with no way to restore it.
export function useBpPinnedRows(): BpPinnedRows {
  const { settings } = useSettings();
  const raw = settings.homeRows?.hidden;
  // settings.update is a shallow top level replace with no normalisation, and the
  // DEFAULT backfill only runs on disk load, so a synced homeRows whose `hidden` is
  // absent or not an array lands here verbatim. Unguarded, .includes throws during
  // BpHome's render, which on the Android TV shell is a dead screen with no customize
  // page and no pointer to recover with. A malformed payload must degrade to "show
  // every band", never to a crash: a crashed TV cannot pull the corrected layout.
  return useMemo(() => {
    const hidden = Array.isArray(raw) ? raw : [];
    return {
      cwHidden: hidden.includes("cw"),
      collectionsHidden: hidden.includes("collections"),
    };
  }, [raw]);
}

export function bpHomeSignature(
  cw: boolean,
  services: boolean,
  collections: boolean,
  rows: readonly { key: string }[],
): string {
  const bands = `${cw ? "c" : ""}${services ? "s" : ""}${collections ? "l" : ""}`;
  return bpRailSignature([bands, ...rows.map((r) => r.key)]);
}

export function bpRailSignature(keys: readonly string[]): string {
  return keys.filter(Boolean).join("\u0000");
}

type BpReflow = {
  railRef: RefObject<HTMLElement | null>;
  signature: string;
  routeKey: string;
};

// A layout pulled from another device lands mid-session, so the rail can
// reorder or lose a row while the ring is sitting in one. data-bp-rail-row
// renumbers on that pass, which is why it can never be used to put the ring
// back: the index that held it now holds a different row. Restore by the cell's
// own restore key, then by the row's remembered cell, and only then give up to
// the first cell in the rail.
export function useBpLayoutReflow({ railRef, signature, routeKey }: BpReflow): void {
  const lastRef = useRef({ cell: "", row: "" });
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (!el) return;
      lastRef.current = { cell: restoreKeyOf(el), row: rowKeyOf(el) };
    };
    rail.addEventListener("focusin", onFocus);
    return () => rail.removeEventListener("focusin", onFocus);
    // The rail is not in the tree while the surface is still a skeleton, so this
    // has to re-run on the same signature that brings the rows in.
  }, [railRef, signature]);

  useEffect(() => {
    const previous = seenRef.current;
    seenRef.current = signature;
    const rail = railRef.current;
    if (previous === null || previous === signature || !rail) return;
    if (bpOverlayOpen()) return;
    // Any ring still in the document owns itself: the cell survived the reorder,
    // or the user walked up into the top bar. Only a ring the new layout deleted
    // is this hook's business, and taking focus back would fight the shell.
    if (document.querySelector("[data-bp-focus='true']")) return;
    const { cell, row } = lastRef.current;
    if (!cell && !row) return;
    const remembered = row ? readBpRowPosition(routeKey, row) : null;
    // This hook only runs when NO element carries data-bp-focus, and bp-tokens puts
    // content-visibility: auto on every row that does not contain the ring. Skipped
    // content reports a zero rect and refuses focus(), so without revealing first the
    // last two fallbacks are measured against rows the browser is not laying out:
    // firstCellOf returns null for anything off screen and bpFocusables(rail)[0] is the
    // first cell that happens to be in frame rather than the first cell in the rail.
    const revert = revealBpRows(rail);
    const target =
      cellOf(rail, cell) ??
      cellOf(rail, remembered ?? "") ??
      firstCellOf(rail, row) ??
      bpFocusables(rail)[0] ??
      null;
    // setBpFocus(null) returns false WITHOUT scheduling recovery, so an empty rail left
    // the ring nowhere and the next D-pad press teleported to the autofocus seed.
    if (!target || !setBpFocus(target, { silent: true })) recoverBpFocus(rail);
    revert();
  }, [railRef, signature, routeKey]);
}

function cellOf(rail: HTMLElement, key: string): HTMLElement | null {
  if (!key) return null;
  return rail.querySelector<HTMLElement>(`[data-bp-restore-key="${CSS.escape(key)}"]`);
}

function firstCellOf(rail: HTMLElement, rowKey: string): HTMLElement | null {
  if (!rowKey) return null;
  const row = rail.querySelector<HTMLElement>(`[data-bp-row-key="${CSS.escape(rowKey)}"]`);
  return row ? (bpFocusables(row)[0] ?? null) : null;
}
