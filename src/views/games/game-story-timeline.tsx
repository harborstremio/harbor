import { GamePlayOrder } from "./game-play-order";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Film, Gamepad2, Route, Tv } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { queryIgdb } from "@/lib/games/atlas";
import { ATLAS_SUMMARY_FIELDS, parseAtlasGame, type AtlasGame } from "@/lib/games/igdb-data";
import { residentEvilStoryAvailable, RESIDENT_EVIL_STORY, RESIDENT_EVIL_STORY_SOURCE, storyDate } from "@/lib/games/story-timelines";
import type { GameSummary } from "@/lib/games/types";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import { GameArt } from "./game-art";
import "./game-story-timeline.css";

export function GameStoryTimeline({ game, active, openGame, openMedia }: {
  game: AtlasGame; active: boolean; openGame: (game: GameSummary) => void; openMedia?: (target: GameMediaTarget) => void;
}) {
  const t = useT(), id = useId(), [expanded, setExpanded] = useState(false), [visited, setVisited] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!active) setExpanded(false); }, [active]);
  if (!residentEvilStoryAvailable(game)) return <GamePlayOrder game={game} active={active} openGame={openGame}/>;
  return <><button id={`${id}-trigger`} className="games-story-entry" ref={trigger} onClick={() => { setVisited(true); setExpanded(value => !value); }} aria-expanded={expanded} aria-controls={`${id}-panel`}><Route size={23}/><span><strong>{t("games.story.title")}</strong><small>{t("games.story.entryNote")}</small></span><ChevronDown className="games-story-chevron" size={22}/></button><section id={`${id}-panel`} className="games-story-panel" aria-labelledby={`${id}-trigger`} hidden={!expanded}>{visited && active && <StoryContent current={game.igdbId} openGame={target => { trigger.current?.focus({ preventScroll: true }); setExpanded(false); openGame(target); }} openMedia={openMedia ? target => { trigger.current?.focus({ preventScroll: true }); setExpanded(false); openMedia(target); } : undefined}/>}</section></>;
}
function StoryContent({ current, openGame, openMedia }: { current: number; openGame: (game: GameSummary) => void; openMedia?: (target: GameMediaTarget) => void }) {
  const t = useT(), language = useUiLanguage();
  const [kind, setKind] = useState("all"), [games, setGames] = useState<AtlasGame[]>([]), [pending, setPending] = useState(true), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController(), ids = RESIDENT_EVIL_STORY.flatMap(entry => [entry.gameId, entry.originalId].filter((id): id is number => !!id));
    setPending(true); setFailed(false);
    void queryIgdb(`fields ${ATLAS_SUMMARY_FIELDS},franchises.name; where id = (${ids.join(",")}); limit 40;`, request.signal).then(rows => {
      if (!request.signal.aborted) setGames(rows.map(parseAtlasGame).filter(game => ids.includes(game.igdbId) && residentEvilStoryAvailable(game)));
    }, () => { if (!request.signal.aborted) setFailed(true); }).finally(() => { if (!request.signal.aborted) setPending(false); });
    return () => request.abort();
  }, [attempt]);
  const lookup = (id: number, name: string): GameSummary => games.find(game => game.igdbId === id) ?? { id: `igdb:${id}`, igdbId: id, name, capsule: "", platforms: [] };
  return <><div className="games-story-panel-content"><p className="games-story-note">{t("games.story.note")}</p><div className="games-story-filters">{["all", "games", "screen"].map(value => <button key={value} aria-pressed={value === kind} onClick={() => setKind(value)}>{t(`games.story.filter.${value}`)}</button>)}</div>
      {failed && <div className="games-story-error" role="status">{t("games.story.error")} <button onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></div>}
      <ol className="games-story-list">{RESIDENT_EVIL_STORY.filter(entry => kind === "all" || (kind === "games" ? !!entry.gameId : !!entry.media)).map(entry => {
        const target = entry.gameId ? lookup(entry.gameId, entry.name) : null, media = entry.media, poster = target?.portrait ?? (media && "poster" in media ? media.poster : ""), Icon = media ? media.kind === "series" ? Tv : Film : Gamepad2;
        const go = () => { if (target) openGame(target); else if (media && openMedia) openMedia(media); else if (media) openUrl(`https://www.themoviedb.org/${media.kind === "series" ? "tv" : "movie"}/${media.id.split(":").at(-1)}`); };
        return <li key={entry.key} data-current={current === entry.gameId || current === entry.originalId}><time>{storyDate(entry, language)}</time><div className="games-story-item"><button className="games-story-open" onClick={go}><span className="games-story-art">{pending && target ? <i className="games-skeleton"/> : <><Icon size={20}/><GameArt src={poster ?? ""}/></>}</span><span><strong>{entry.name}</strong><small><Icon size={14}/>{t(media ? media.kind === "series" ? "games.story.series" : "games.story.movie" : "games.story.game")}{(current === entry.gameId || current === entry.originalId) && <b>{t("games.story.current")}</b>}</small>{entry.note && <em>{t(`games.story.${entry.note}`)}</em>}</span></button>{entry.originalId && <button className="games-story-original" onClick={() => openGame(lookup(entry.originalId!, entry.name))}>{t("games.story.original")}</button>}</div></li>;
      })}</ol>
      <p className="games-story-scope">{t("games.story.scope")}</p>
    </div><footer><a href={RESIDENT_EVIL_STORY_SOURCE} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(RESIDENT_EVIL_STORY_SOURCE); }}>{t("games.story.source")}</a></footer>
  </>;
}
