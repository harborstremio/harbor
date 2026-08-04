import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Meta } from "@/lib/cinemeta";
import {
  expandingCardArtworkKey,
  invalidateExpandingCardArtwork,
  prepareExpandingCardArtwork,
} from "@/lib/expanding-card-artwork";
import { POSTER_CARD_ANIMATION, expandedCardWidth } from "@/lib/poster-backdrop-expansion";
import { observe } from "@/lib/visibility";
import { useRowCardExpansion } from "../row-card-expansion";

type ArtworkState = {
  key: string;
  url?: string;
  ready?: boolean;
};

export function useExpandingCard({
  cardRef,
  meta,
  tmdbKey,
  focusEnabled,
}: {
  cardRef: RefObject<HTMLButtonElement | null>;
  meta: Meta;
  tmdbKey: string;
  focusEnabled: boolean;
}) {
  const row = useRowCardExpansion();
  const enabled = row?.enabled === true;
  const focusedCardEffectEnabled = focusEnabled;
  const collapseRowCard = row?.collapse;
  const artworkKey = expandingCardArtworkKey(meta, tmdbKey);
  const artworkKeyRef = useRef(artworkKey);
  const previousArtworkKeyRef = useRef(artworkKey);
  const [artworkState, setArtworkState] = useState<ArtworkState>({ key: artworkKey });
  const [collapsing, setCollapsing] = useState(false);
  const [titleCollapsing, setTitleCollapsing] = useState(false);
  const artwork = artworkState.key === artworkKey ? artworkState.url : undefined;
  const artworkReady = artworkState.key === artworkKey && artworkState.ready === true;
  const artworkRef = useRef(artwork);
  const artworkReadyRef = useRef(artworkReady);
  const requestRef = useRef<{
    key: string;
    priority: "auto" | "high";
    promise: Promise<string | undefined>;
  } | null>(null);
  const focusIntentRef = useRef(false);
  const collapseTimerRef = useRef<number | null>(null);
  const titleCollapseTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (previousArtworkKeyRef.current !== artworkKey) {
      previousArtworkKeyRef.current = artworkKey;
      artworkRef.current = undefined;
      artworkReadyRef.current = false;
      focusIntentRef.current = false;
      collapseRowCard?.();
      setCollapsing(false);
      setTitleCollapsing(false);
    }
    artworkKeyRef.current = artworkKey;
  }, [artworkKey, collapseRowCard]);

  const loadArtwork = useCallback(
    (priority: "auto" | "high"): Promise<string | undefined> => {
      if (!enabled) return Promise.resolve(undefined);
      if (artworkRef.current) return Promise.resolve(artworkRef.current);
      const activeRequest = requestRef.current;
      if (
        activeRequest?.key === artworkKey &&
        (priority === "auto" || activeRequest.priority === "high")
      ) {
        return activeRequest.promise;
      }

      const prepared = prepareExpandingCardArtwork(meta, tmdbKey, priority);

      const promise = prepared
        .then((url) => {
          if (url && artworkKeyRef.current === artworkKey) {
            artworkRef.current = url;
            artworkReadyRef.current = false;
            setArtworkState({ key: artworkKey, url, ready: false });
          }
          return url;
        })
        .finally(() => {
          if (requestRef.current?.promise === promise) requestRef.current = null;
        });
      requestRef.current = { key: artworkKey, priority, promise };
      return promise;
    },
    [artworkKey, enabled, meta, tmdbKey],
  );

  const expandReadyCard = useCallback(
    (url: string | undefined) => {
      if (!url || !row || !enabled) return;
      if (!focusIntentRef.current) return;
      const anchor = cardRef.current?.querySelector<HTMLElement>("[data-preview-anchor]");
      if (!anchor) return;
      row.expand(expandedCardWidth(anchor.getBoundingClientRect().height));
    },
    [cardRef, enabled, row],
  );

  const armFocus = useCallback(() => {
    if (!enabled) return;
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (titleCollapseTimerRef.current !== null) {
      window.clearTimeout(titleCollapseTimerRef.current);
      titleCollapseTimerRef.current = null;
    }
    setCollapsing(false);
    setTitleCollapsing(false);
    focusIntentRef.current = true;
    const currentArtwork = artworkRef.current;
    if (currentArtwork && artworkReadyRef.current) {
      expandReadyCard(currentArtwork);
      return;
    }
    void loadArtwork("high");
  }, [enabled, expandReadyCard, loadArtwork]);

  const onArtworkReady = useCallback(
    (url: string) => {
      if (artworkKeyRef.current !== artworkKey) return;
      artworkReadyRef.current = true;
      setArtworkState((current) =>
        current.key === artworkKey && current.url === url ? { ...current, ready: true } : current,
      );
      expandReadyCard(url);
    },
    [artworkKey, expandReadyCard],
  );

  const onArtworkError = useCallback(
    (url: string) => {
      if (artworkKeyRef.current !== artworkKey) return;
      invalidateExpandingCardArtwork(artworkKey, url);
      artworkRef.current = undefined;
      artworkReadyRef.current = false;
      setArtworkState((current) =>
        current.key === artworkKey && current.url === url ? { key: artworkKey } : current,
      );
    },
    [artworkKey],
  );

  const onFocus = useCallback(() => {
    if (
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-input-modality") === "pointer"
    ) {
      focusIntentRef.current = false;
      return;
    }
    armFocus();
  }, [armFocus]);
  const onBlur = useCallback(() => {
    focusIntentRef.current = false;
    if (!enabled) return;
    setCollapsing(true);
    setTitleCollapsing(true);
    if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current);
    if (titleCollapseTimerRef.current !== null) window.clearTimeout(titleCollapseTimerRef.current);
    titleCollapseTimerRef.current = window.setTimeout(() => {
      titleCollapseTimerRef.current = null;
      setTitleCollapsing(false);
    }, POSTER_CARD_ANIMATION.wideFadeMs);
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      setCollapsing(false);
    }, POSTER_CARD_ANIMATION.expansionMs + POSTER_CARD_ANIMATION.settleMs);
    row?.collapse();
  }, [enabled, row]);

  useEffect(() => {
    if (!enabled) return;
    const card = cardRef.current;
    if (!card) return;
    let requested = false;
    return observe(card, (visible) => {
      if (!visible || requested) return;
      requested = true;
      void loadArtwork("auto");
    });
  }, [artworkKey, cardRef, enabled, loadArtwork]);

  useEffect(() => {
    if (artwork || !enabled || !focusIntentRef.current) return;
    void loadArtwork("high");
  }, [artwork, enabled, loadArtwork]);

  useEffect(() => {
    if (enabled) return;
    focusIntentRef.current = false;
    row?.collapse();
  }, [enabled, row]);

  useEffect(
    () => () => {
      focusIntentRef.current = false;
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current);
      if (titleCollapseTimerRef.current !== null) window.clearTimeout(titleCollapseTimerRef.current);
      collapseRowCard?.();
    },
    [collapseRowCard],
  );

  return {
    artwork,
    enabled,
    expanded: row?.expanded === true,
    collapsing,
    titleCollapsing,
    focusEnabled: focusedCardEffectEnabled,
    onBlur,
    onFocus,
    onArtworkError,
    onArtworkReady,
  };
}

export function ExpandingCardArtwork({
  src,
  onError,
  onReady,
}: {
  src?: string;
  onError: (url: string) => void;
  onReady: (url: string) => void;
}) {
  if (!src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      fetchPriority="high"
      onLoad={() => onReady(src)}
      onError={() => onError(src)}
      data-expanding-card-artwork
      className="expanding-card-artwork pointer-events-none absolute inset-0 h-full w-full object-cover"
    />
  );
}
