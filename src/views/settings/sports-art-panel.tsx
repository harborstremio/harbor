import { ImageOff, Loader2, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { jlAccountsConfigured, useJlSession } from "@/lib/jl/account/client";
import { artKey, customArt, useCuratedArtVersion } from "@/lib/jl/sports/curated-art";
import {
  ART_GUIDE,
  ART_KINDS,
  ART_TYPES,
  artFileProblem,
  type ArtKind,
} from "@/lib/jl/sports/custom-art";
import { useJlSportsFavorites } from "@/lib/jl/sports/favorites";
import { useFollowedColleges } from "@/lib/jl/sports/college-follows";
import { collegeFavorite } from "@/lib/jl/sports/college-games";
import { logoUrl } from "@/lib/jl/sports/sidearm";
import { searchTeamsAndPlayers } from "@/lib/jl/sports/people";
import type { SportsSearchHit } from "@/lib/jl/sports/search-parse";
import { espnTeamLogo } from "@/lib/jl/sports/sport-art";
import { Section } from "./shared";

type ArtTeam = { league: string; id: string; name: string; logo: string | null };

const SEARCH_DELAY_MS = 350;
const ACCEPT = Object.keys(ART_TYPES).join(",");

/**
 * Settings → Sports plugins & keys → Sports art: the owner's own pictures for each team's five
 * slots, stored in their JL account so every device shows them. Followed teams are listed; any
 * other team is a search away.
 */
export function SportsArtSection() {
  const t = useT();
  const session = useJlSession();
  useCuratedArtVersion();
  const followed = useJlSportsFavorites();
  const [added, setAdded] = useState<ArtTeam[]>([]);

  useEffect(() => {
    if (session) void customArt.load();
  }, [session]);

  // Colleges followed on their College page (Gallaudet, say) hold art like any other team.
  const colleges = useFollowedColleges();
  const teams = artTeams(
    [
      ...followed,
      ...colleges.map((c) => ({ ...collegeFavorite(c), logo: c.site ? logoUrl(c.site) : null })),
    ],
    added,
  );

  const status = customArt.status();
  return (
    <Section
      title={t("Sports art")}
      subtitle={t(
        "Your own pictures for your teams. They sync with your JL account to every device and show ahead of TheSportsDB and Harbor's artwork.",
      )}
    >
      {!jlAccountsConfigured() ? (
        <p className="text-[13.5px] text-ink-muted">
          {t("JL accounts are not configured in this build, so sports art can't be synced.")}
        </p>
      ) : !session ? (
        <p className="rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 text-[13.5px] text-ink-muted">
          {t(
            "Sign in to your JL account to add sports art. Your pictures are stored privately in your account and sync to every device you sign in on.",
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <SizeGuide />
          <TeamSearch onPick={(team) => setAdded((list) => [team, ...list])} />
          {status === "loading" && (
            <p className="flex items-center gap-2 text-[13px] text-ink-subtle">
              <Loader2 size={14} className="animate-spin" />
              {t("Loading your sports art…")}
            </p>
          )}
          {status === "error" && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-danger">
              {t("Your sports art couldn't be loaded.")}
              <button
                type="button"
                onClick={() => void customArt.load(true)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12.5px] font-semibold text-ink hover:border-edge"
              >
                <RefreshCw size={13} />
                {t("Retry")}
              </button>
            </p>
          )}
          {teams.length === 0 ? (
            <p className="text-[13.5px] text-ink-muted">
              {t("Follow a team on the Sports page, or search for one above, to add its art.")}
            </p>
          ) : (
            teams.map((team) => <TeamArtCard key={`${team.league}:${team.id}`} team={team} />)
          )}
        </div>
      )}
    </Section>
  );
}

/** Followed teams, teams picked from search, and teams that already hold art, once each. */
function artTeams(
  followed: Array<{ league: string; id: string; name: string; logo?: string | null }>,
  added: ArtTeam[],
) {
  const out: ArtTeam[] = [];
  const seen = new Set<string>();
  const push = (team: ArtTeam) => {
    const key = artKey.team(team.league, team.id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(team);
  };
  for (const f of followed)
    push({
      league: f.league,
      id: f.id,
      name: f.name,
      logo: f.logo !== undefined ? f.logo : espnTeamLogo(f.league, f.id),
    });
  for (const a of added) push(a);
  for (const ref of customArt.refs()) {
    const m = /^team:([^:]+):(.+)$/.exec(ref);
    if (!m) continue;
    const label = Object.values(customArt.slots(ref)).find((s) => s?.label)?.label ?? "";
    const league = m[1].toUpperCase();
    push({
      league,
      id: m[2],
      name: label || `${league} ${m[2]}`,
      logo: espnTeamLogo(league, m[2]),
    });
  }
  return out;
}

function SizeGuide() {
  const t = useT();
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 text-[12.5px]">
      {ART_KINDS.map((kind) => (
        <div key={kind} className="rounded-xl border border-edge-soft bg-canvas/30 px-3 py-2">
          <dt className="font-semibold text-ink">{t(ART_GUIDE[kind].label)}</dt>
          <dd className="text-ink-muted">
            {t(ART_GUIDE[kind].size)} · {t(ART_GUIDE[kind].hint)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TeamSearch({ onPick }: { onPick: (team: ArtTeam) => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SportsSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchTeamsAndPlayers(q, controller.signal)
        .then((list) => setHits(list.filter((h) => h.kind === "team")))
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const shown = q.length >= 2 ? hits.slice(0, 8) : [];
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-canvas px-3.5 focus-within:border-ink-subtle">
        <Search size={15} className="text-ink-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search a team to add its art")}
          aria-label={t("Search a team to add its art")}
          className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        {searching && <Loader2 size={14} className="animate-spin text-ink-subtle" />}
      </label>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1">
          {shown.map((hit) => (
            <li key={`${hit.league}:${hit.id}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ league: hit.league, id: hit.id, name: hit.name, logo: hit.image });
                  setQuery("");
                  setHits([]);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3 py-2 text-start hover:border-edge"
              >
                {hit.image ? (
                  <img src={hit.image} alt="" className="h-7 w-7 object-contain" loading="lazy" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-elevated" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{hit.name}</span>
                  <span className="truncate text-[11.5px] text-ink-subtle">{hit.subtitle}</span>
                </span>
                <Plus size={15} className="text-accent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamArtCard({ team }: { team: ArtTeam }) {
  const ref = artKey.team(team.league, team.id);
  const slots = customArt.slots(ref);
  return (
    <section
      aria-label={team.name}
      className="flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/30 p-4"
    >
      <header className="flex items-center gap-3">
        <TeamLogo src={team.logo} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">{team.name}</span>
          <span className="text-[11.5px] uppercase tracking-[0.12em] text-ink-subtle">
            {team.league}
          </span>
        </span>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        {ART_KINDS.map((kind) => (
          <SlotTile
            key={kind}
            artRef={ref}
            kind={kind}
            teamName={team.name}
            url={slots[kind]?.url ?? null}
            filled={!!slots[kind]}
          />
        ))}
      </div>
    </section>
  );
}

function TeamLogo({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="h-9 w-9 shrink-0 rounded-full bg-elevated" />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 object-contain"
    />
  );
}

function SlotTile({
  artRef,
  kind,
  teamName,
  url,
  filled,
}: {
  artRef: string;
  kind: ArtKind;
  teamName: string;
  url: string | null;
  filled: boolean;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guide = ART_GUIDE[kind];
  const slotName = t(guide.label);

  const upload = async (file: File) => {
    const problem = artFileProblem(file);
    if (problem) {
      setError(t(problem));
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      await customArt.upload(artRef, kind, file, teamName);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("The picture could not be uploaded"));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("remove");
    setError(null);
    try {
      await customArt.remove(artRef, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("The picture could not be removed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-elevated/40 p-2.5">
      <div
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-canvas/60 ${kind === "wordmark" ? "bg-[repeating-conic-gradient(#ffffff10_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]" : ""}`}
      >
        {url ? (
          <img
            src={url}
            alt={t("{team} {slot} art", { team: teamName, slot: slotName })}
            className={`h-full w-full ${
              kind === "wordmark"
                ? "object-contain p-2"
                : kind === "story"
                  ? "object-contain"
                  : "object-cover"
            }`}
          />
        ) : (
          <ImageOff size={20} className="text-ink-subtle" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-canvas/60">
            <Loader2 size={18} className="animate-spin text-ink" />
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-ink">{slotName}</span>
        <span className="text-[11.5px] leading-snug text-ink-subtle">
          {t(guide.size)} · {t(guide.hint)}
        </span>
      </div>
      {/* Not focusable: the picker opens only when the Upload button is activated. */}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => input.current?.click()}
          aria-label={`${filled ? t("Replace") : t("Upload")}: ${teamName} ${slotName}`}
          className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-semibold text-canvas hover:opacity-90 disabled:opacity-50"
        >
          <Upload size={12} />
          {filled ? t("Replace") : t("Upload")}
        </button>
        {filled && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void remove()}
            aria-label={`${t("Remove")}: ${teamName} ${slotName}`}
            className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted hover:border-edge hover:text-ink disabled:opacity-50"
          >
            <Trash2 size={12} />
            {t("Remove")}
          </button>
        )}
      </div>
      {error && <p className="text-[11.5px] text-danger">{error}</p>}
    </div>
  );
}
