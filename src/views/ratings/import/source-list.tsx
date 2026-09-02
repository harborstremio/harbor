import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { SourceLogo } from "./source-logo";
import { IMPORT_SOURCES } from "@/lib/ratings/import/registry";
import type {ImportSourceId, RatingsSource} from "@/lib/ratings/import/types";

export type KeyField = { name: "apiKey" | "username"; label: string; placeholder: string };

const COVERAGE: Record<ImportSourceId, string> = {
  trakt: "Movies and shows you rated on Trakt",
  simkl: "Movies, shows and anime you rated on Simkl",
  anilist: "Anime and manga scores from your AniList",
  mal: "Anime and manga scores from your list",
  letterboxd: "Films, from your Letterboxd export",
  imdb: "Movies and shows, from your ratings.csv",
  tmdb: "Movies and shows, needs your TMDB credentials",
  mdblist: "Movies and shows, needs your MDBList key",
};

const FILE_ACCEPT: Partial<Record<ImportSourceId, string>> = {
  imdb: ".csv,text/csv",
  letterboxd: ".zip,.csv,text/csv,application/zip",
};

const FILE_HINT: Partial<Record<ImportSourceId, string>> = {
  imdb: "On IMDb open Your Ratings, use Export, then drop the ratings.csv here.",
  letterboxd:
    "Export from letterboxd.com/settings/data, which needs Letterboxd Pro. Drop the ZIP or the ratings.csv inside it.",
};

const KEY_FIELDS: Partial<Record<ImportSourceId, KeyField[]>> = {
  mdblist: [{ name: "apiKey", label: "MDBList API key", placeholder: "Paste your key" }],
  tmdb: [
    { name: "apiKey", label: "TMDB API key (v3)", placeholder: "32 character key" },
    {
      name: "username",
      label: "Session ID or v4 access token",
      placeholder: "40 character session ID",
    },
  ],
};

const KEY_HINT: Partial<Record<ImportSourceId, string>> = {
  mdblist: "Copy it from mdblist.com/preferences. It is used for this import only, never stored.",
  tmdb: "Both come from your TMDB account settings. The read only token on the API page cannot see your ratings.",
};

export function coverageOf(id: ImportSourceId): string {
  return COVERAGE[id];
}

export function fileAcceptOf(id: ImportSourceId): string {
  return FILE_ACCEPT[id] ?? ".csv";
}

export function fileHintOf(id: ImportSourceId): string {
  return FILE_HINT[id] ?? "";
}

export function keyFieldsOf(id: ImportSourceId): KeyField[] {
  return KEY_FIELDS[id] ?? [];
}

export function keyHintOf(id: ImportSourceId): string {
  return KEY_HINT[id] ?? "";
}

function useAvailability(): Partial<Record<ImportSourceId, boolean>> {
  const [ready, setReady] = useState<Partial<Record<ImportSourceId, boolean>>>({});

  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const pairs = await Promise.all(
        IMPORT_SOURCES.map(async (source): Promise<[ImportSourceId, boolean]> => {
          try {
            return [source.id, (await source.available()) === true];
          } catch {
            return [source.id, false];
          }
        }),
      );
      if (!alive) return;
      const next: Partial<Record<ImportSourceId, boolean>> = {};
      for (const [id, ok] of pairs) next[id] = ok;
      setReady(next);
    };
    void probe();
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}

export function SourceList({ onPick }: { onPick: (source: RatingsSource) => void }) {
  const ready = useAvailability();
  return (
    <div className="flex flex-col gap-1.5">
      {IMPORT_SOURCES.map((source) => (
        <SourceRow key={source.id} source={source} ok={ready[source.id]} onPick={onPick} />
      ))}
    </div>
  );
}

function SourceRow({
  source,
  ok,
  onPick,
}: {
  source: RatingsSource;
  ok: boolean | undefined;
  onPick: (source: RatingsSource) => void;
}) {
  const t = useT();
  const blocked = ok === false;
  const reason =
    source.kind === "session"
      ? t("Connect {name} in Settings first", { name: source.label })
      : t("Add your TMDB key in Settings first");

  return (
    <button
      type="button"
      disabled={ok !== true}
      onClick={() => onPick(source)}
      className="flex min-h-[60px] w-full items-center gap-3.5 rounded-lg border border-edge-soft bg-canvas/40 px-3.5 py-3 text-start transition-colors hover:bg-elevated/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-canvas/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-ink-subtle">
        <SourceLogo id={source.id} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{source.label}</span>
        <span className="block truncate text-[12px] text-ink-subtle">
          {blocked ? reason : t(coverageOf(source.id))}
        </span>
      </span>
      {ok === true && <ChevronRight size={16} className="shrink-0 text-ink-subtle" />}
    </button>
  );
}
