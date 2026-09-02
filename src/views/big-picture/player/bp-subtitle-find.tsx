import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search as SearchIcon } from "lucide-react";
import { isVeryNewRelease } from "@/components/player/subtitle-menu/utils";
import type { Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import type { SubtitleAddHandler } from "@/lib/player/subtitle-load";
import { useSettings } from "@/lib/settings";
import { markAddedSub, useAddedSubs } from "@/lib/subtitles/added-subs";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { languageName } from "@/lib/subtitles/language";
import { providerLabel, releaseOf, subtitleLoadMetadataOf } from "@/lib/subtitles/provider-label";
import { searchSubtitles, type SearchOptions } from "@/lib/subtitles/search";
import {
  bestCandidate,
  parseTitleQuery,
  searchTitleCandidates,
} from "@/lib/subtitles/title-search";
import type { SubResult } from "@/lib/subtitles/types";
import { useBpT } from "../bp-i18n";
import { BpKeyboard } from "../bp-keyboard";
import {
  Chip,
  LABEL,
  NOTE,
  Row,
  SPIN,
  SubLine,
  Stepper,
  resultDetail,
  tagsOf,
} from "./bp-subtitle-parts";

const PAGE = 40;

export type BpSubtitleTarget = {
  imdbId: string;
  type: "movie" | "series";
  title: string;
  season?: number;
  episode?: number;
};

export type BpSubtitleFindProps = {
  home: BpSubtitleTarget;
  metaTitle: string | null | undefined;
  metaReleaseDate: string | null | undefined;
  /** Ids the player already resolved, so the search can ask the right addons. */
  candidateIds?: string[];
  stremioId?: string;
  hideHI: boolean;
  forcedOnly: boolean;
  onToggleHideHI: () => void;
  onToggleForcedOnly: () => void;
  onAddSubtitle: SubtitleAddHandler;
};

export function BpSubtitleFind(props: BpSubtitleFindProps) {
  const t = useBpT();
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const addedUrls = useAddedSubs();
  const { home, hideHI, forcedOnly, onAddSubtitle } = props;

  const [target, setTarget] = useState<BpSubtitleTarget>(home);
  const [override, setOverride] = useState(false);
  const [query, setQuery] = useState(props.metaTitle ?? "");
  const [results, setResults] = useState<SubResult[] | null>(null);
  const [pending, setPending] = useState(0);
  const [searching, setSearching] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const seq = useRef(0);
  const ranOnce = useRef(false);

  useEffect(() => {
    let alive = true;
    gatherSubtitleAddons(authKey)
      .then((a) => alive && setAddons(a))
      .catch(() => alive && setAddons([]));
    return () => {
      alive = false;
    };
  }, [authKey]);

  const run = useCallback(
    async (tgt: BpSubtitleTarget) => {
      const mine = ++seq.current;
      setSearching(true);
      setResults(null);
      setLimit(PAGE);
      const enabled = settings.subProvidersEnabled ?? {};
      const playing = tgt.imdbId === home.imdbId && tgt.title === home.title;
      const opts: SearchOptions = {
        timeoutMs: 8_000,
        providers: {
          wyzie: tgt.imdbId ? enabled.wyzie === true : true,
          addons: enabled.addons ?? true,
          opensubtitles: enabled.opensubtitles ?? true,
        },
        addons: addons ?? [],
        preferredLangs: settings.preferredSubLangs ?? [],
        extra: {
          userAgent: "Harbor",
          netAllowed: true,
          subdlApiKey: settings.subdlApiKey || null,
          subsourceApiKey: settings.subsourceApiKey || null,
          enabled: { subdl: enabled.subdl === true, subsource: enabled.subsource === true },
        },
        onPartial: (partial, still) => {
          if (mine !== seq.current) return;
          setResults(partial);
          setPending(still);
          if (partial.length > 0) setSearching(false);
        },
      };
      try {
        const found = await searchSubtitles(
          {
            imdbId: tgt.imdbId || undefined,
            title: tgt.imdbId ? undefined : tgt.title || undefined,
            type: tgt.type,
            season: tgt.season,
            episode: tgt.episode,
            langs: settings.preferredSubLangs ?? [],
            candidateIds: playing ? props.candidateIds : undefined,
            stremioId: playing ? props.stremioId : undefined,
          },
          opts,
        );
        if (mine !== seq.current) return;
        setResults(found);
        setPending(0);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    },
    [addons, home, settings, props.candidateIds, props.stremioId],
  );

  useEffect(() => {
    if (addons === null || ranOnce.current) return;
    if (!target.imdbId && !target.title) return;
    ranOnce.current = true;
    void run(target);
  }, [addons, target, run]);

  const submit = useCallback(async () => {
    const parsed = parseTitleQuery(query);
    if (parsed.title.length < 2) {
      void run(target);
      return;
    }
    setSearching(true);
    setResults(null);
    const cands = await searchTitleCandidates(query).catch(() => []);
    const top = bestCandidate(cands, parsed);
    const series = top ? top.type === "series" : parsed.season != null;
    const next: BpSubtitleTarget = {
      imdbId: top?.imdbId ?? "",
      type: series ? "series" : "movie",
      title: top?.name ?? parsed.title,
      season: series ? (parsed.season ?? target.season ?? 1) : undefined,
      episode: series ? (parsed.episode ?? target.episode ?? 1) : undefined,
    };
    setTarget(next);
    setOverride(true);
    await run(next);
  }, [query, run, target]);

  const changeEp = (patch: Partial<BpSubtitleTarget>) => {
    const next = { ...target, ...patch };
    setTarget(next);
    void run(next);
  };

  const flat = useMemo(() => {
    const kept = (results ?? []).filter(
      (r) => !(hideHI && r.hearingImpaired) && !(forcedOnly && !r.forced),
    );
    const byLang = new Map<string, SubResult[]>();
    for (const r of kept) {
      const key = languageName(r.lang);
      byLang.set(key, [...(byLang.get(key) ?? []), r]);
    }
    return [...byLang.entries()].flatMap(([lang, items]) => items.map((r) => ({ lang, r })));
  }, [results, hideHI, forcedOnly]);

  // The only key this surface listens for, and it is deliberately not a
  // direction, Enter, Escape, Backspace or Space: those all belong to the
  // shell's single listener, and a second one on window fires as well.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1 || e.key === " " || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      setQuery((q) => q + e.key);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <>
      <Row>
        <span className={LABEL}>{t("Search")}</span>
        <span className="line-clamp-1 flex-1 text-[clamp(15px,2.1vh,26px)] font-semibold text-ink">
          {query || t("Search any show or movie")}
        </span>
      </Row>
      <BpKeyboard
        onChar={(c) => setQuery((q) => q + c)}
        onBackspace={() => setQuery((q) => q.slice(0, -1))}
        onClear={() => setQuery("")}
      />
      <Row>
        <Chip
          label={searching ? t("Searching…") : t("Search")}
          seed
          icon={
            searching ? (
              <Loader2 size={19} className={SPIN} />
            ) : (
              <SearchIcon size={19} strokeWidth={2.2} />
            )
          }
          onPress={() => void submit()}
        />
        {override && (
          <Chip
            label={t("Back to what's playing")}
            onPress={() => {
              setOverride(false);
              setQuery(props.metaTitle ?? "");
              setTarget(home);
              void run(home);
            }}
          />
        )}
        {target.type === "series" && (
          <>
            <Stepper
              label={t("Season")}
              value={String(target.season ?? 1)}
              t={t}
              onReset={() => void run(target)}
              onStep={(d) => changeEp({ season: Math.max(1, (target.season ?? 1) + d) })}
            />
            <Stepper
              label={t("Episode")}
              value={String(target.episode ?? 1)}
              t={t}
              onReset={() => void run(target)}
              onStep={(d) => changeEp({ episode: Math.max(1, (target.episode ?? 1) + d) })}
            />
          </>
        )}
        <Chip label={t("Hide HI/SDH")} on={hideHI} onPress={props.onToggleHideHI} />
        <Chip label={t("Forced only")} on={forcedOnly} onPress={props.onToggleForcedOnly} />
      </Row>
      {(searching || pending > 0) && (
        <p className={NOTE}>
          <Loader2 size={20} className={SPIN} strokeWidth={2.2} />
          {pending > 0
            ? t("Still searching {count} more…", { count: pending })
            : t("Searching {count} sources…", { count: 1 + (addons?.length ?? 0) })}
        </p>
      )}
      {results !== null && flat.length === 0 && !searching && pending === 0 && (
        <p className={NOTE}>
          {isVeryNewRelease(props.metaReleaseDate)
            ? t("Too new. Subtitles haven't been published yet.")
            : t("No subtitles found. Try another title above, or adjust the season and episode.")}
        </p>
      )}
      {flat.slice(0, limit).map(({ lang, r }, i) => {
        const added = addedUrls.has(r.url);
        return (
          <div key={`${r.source}:${r.id}:${r.url}`} className="contents">
            {(i === 0 || flat[i - 1].lang !== lang) && <p className={LABEL}>{lang}</p>}
            <SubLine
              title={releaseOf(r) || r.title || lang}
              detail={resultDetail(r, t)}
              badges={added ? [t("Added"), ...tagsOf(r, t)] : tagsOf(r, t)}
              icon={
                added ? <Check size={22} strokeWidth={3} /> : <Plus size={22} strokeWidth={2.4} />
              }
              onPress={() => {
                markAddedSub(r.url);
                void onAddSubtitle(r.url, r.lang, providerLabel(r), subtitleLoadMetadataOf(r));
              }}
            />
          </div>
        );
      })}
      {flat.length > limit && (
        <Row>
          <Chip
            label={t("Show {count} more", { count: flat.length - limit })}
            onPress={() => setLimit((n) => n + PAGE)}
          />
        </Row>
      )}
    </>
  );
}
