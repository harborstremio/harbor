import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { aiIsGroq, aiKey, modelLabelFor, providerForModel } from "@/lib/ai-models";
import { aiFindEpisodes, type EpisodeCandidate } from "@/lib/ai-episode-search";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { AiThinking } from "@/components/search/ai-search/ai-thinking";
import { CrossSeasonResults } from "./cross-season-results";
import { EpisodeResultRow } from "./episode-result-row";
import { AiExampleHint } from "@/components/ai-example-hint";

type Video = NonNullable<Meta["videos"]>[number];
type Status = "idle" | "loading" | "done";

export function EpisodeAiMode({
  meta,
  videos,
  imdbId,
  onExit,
}: {
  meta: Meta;
  videos?: Meta["videos"];
  imdbId?: string | null;
  onExit: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const playLocalAware = useLocalAwareSeriesPlay();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<Video[]>([]);
  const [fellBack, setFellBack] = useState(false);
  const [ranQuery, setRanQuery] = useState("");

  const provider = providerForModel(settings.aiSearchModel);
  const label = modelLabelFor(settings.aiSearchModel);

  const candidates = useMemo<EpisodeCandidate[]>(() => {
    if (!videos) return [];
    return videos
      .filter((v) => v.season != null && v.season >= 1 && v.episode != null)
      .map((v) => ({
        season: v.season!,
        episode: v.episode!,
        name: v.name ?? v.title,
        overview: v.overview ?? v.description,
      }));
  }, [videos]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || status === "loading") return;
    setStatus("loading");
    setFellBack(false);
    setRanQuery(q);
    try {
      const refs = await aiFindEpisodes(
        aiKey(settings),
        settings.aiSearchModel,
        aiIsGroq(settings),
        meta.name,
        candidates,
        q,
      );
      const found: Video[] = [];
      for (const r of refs) {
        const v = videos?.find((x) => x.season === r.season && x.episode === r.episode);
        if (v) found.push(v);
      }
      setMatches(found);
      setFellBack(found.length === 0);
      setStatus("done");
    } catch {
      setMatches([]);
      setFellBack(true);
      setStatus("done");
    }
  };

  const play = (v: Video) =>
    playLocalAware({
      meta,
      episode: {
        season: v.season ?? 1,
        episode: v.episode ?? 1,
        name: v.name || undefined,
        still: v.thumbnail || undefined,
      },
      opts: { autoPlay: settings.instantPlay || settings.seasonSourceLock },
      imdbId,
      videos,
    });

  return (
    <div className="animate-ai-morph flex flex-col gap-4">
      <form
        onSubmit={submit}
        className="relative flex items-center gap-2.5 overflow-hidden rounded-2xl bg-accent/10 px-3.5 ring-1 ring-accent/40"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-16deg] bg-gradient-to-r from-transparent via-ink/10 to-transparent animate-ai-sheen" />
        <span className="animate-ai-logo-swap relative shrink-0">
          <ProviderLogo provider={provider} size={18} round />
        </span>
        <div className="relative flex-1">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-12 w-full bg-transparent text-[14.5px] text-ink outline-none"
          />
          <AiExampleHint hidden={input.length > 0} />
        </div>
        <button
          type="button"
          onClick={onExit}
          aria-label={t("Exit AI mode")}
          className="shrink-0 text-ink-subtle transition-colors hover:text-ink"
        >
          <X size={16} />
        </button>
      </form>

      {status === "idle" && (
        <p className="animate-ai-entrance text-[13px] text-ink-subtle [animation-delay:80ms]">
          {t("Ask AI to find an episode by vibe")}
        </p>
      )}

      {status === "loading" && (
        <AiThinking
          provider={provider}
          label={label}
          rows={3}
          phrases={[t("Recalling the season"), t("Matching moments"), t("Finding the one")]}
        />
      )}

      {status === "done" && !fellBack && (
        <div className="flex flex-col gap-1.5">
          {matches.map((v, i) => (
            <EpisodeResultRow
              key={v.id ?? `${v.season}-${v.episode}`}
              video={v}
              onPlay={() => play(v)}
              index={i}
            />
          ))}
        </div>
      )}

      {status === "done" && fellBack && (
        <div className="flex flex-col gap-3">
          <p className="animate-ai-entrance text-[13px] text-ink-muted">
            {t("Showing keyword matches instead")}
          </p>
          <CrossSeasonResults meta={meta} videos={videos} query={ranQuery} imdbId={imdbId} />
        </div>
      )}
    </div>
  );
}
