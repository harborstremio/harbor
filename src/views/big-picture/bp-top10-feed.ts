import { useEffect } from "react";
import type { Meta } from "@/lib/cinemeta";
import { setTop10Metas } from "@/lib/top10-set";

/**
 * setTop10Metas had exactly one caller, views/home.tsx, which never mounts on
 * the TV entry. isTop10() was therefore permanently false inside Big Picture and
 * the top-ten mark could not appear however the user had it set.
 *
 * The store holds one set at a time, the same as desktop. Two things seed it
 * here: the shell's own catalog, which is mounted for the whole session, and a
 * catalog page, which is not. The shell set is the floor, so a page pops back to
 * it on the way out instead of leaving the Shows top ten marked on Home forever.
 */
let baseMetas: Meta[] = [];
let pageOwned = 0;

/**
 * The always-mounted seed. Home reads isTop10 from the frame it boots on.
 *
 * It defers while a catalog page holds the store, because the shell's catalog
 * re-resolves when addon rows merge in and that would otherwise wipe the Shows
 * top ten out from under a user standing on it.
 */
export function useBpTop10Base(ranked: Meta[]): void {
  useEffect(() => {
    baseMetas = ranked;
    if (pageOwned === 0) setTop10Metas(ranked);
  }, [ranked]);
}

/** A catalog page's own set, surrendered back to the shell's when it unmounts. */
export function useBpTop10Feed(ranked: Meta[]): void {
  useEffect(() => {
    if (ranked.length === 0) return;
    pageOwned += 1;
    setTop10Metas(ranked);
    return () => {
      pageOwned -= 1;
      if (pageOwned === 0) setTop10Metas(baseMetas);
    };
  }, [ranked]);
}
