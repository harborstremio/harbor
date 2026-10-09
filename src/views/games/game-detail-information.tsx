import { useEffect, useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, Cpu, Gamepad2, HardDrive, MemoryStick, Monitor, RefreshCw, Trophy, LockKeyhole, Languages, Star, ShieldCheck, Captions, Volume2 } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { GameDetailExtras, GameLanguage } from "@/lib/games/detail-extras-data";
import { requirementRows } from "@/lib/games/detail-extras-data";
import { PlayersActiveMark, RatingSourceMark } from "./game-detail-marks";
import type { GameRating as ReviewRating } from "@/lib/games/rating-data";
import type { SteamLibraryState } from "@/hooks/use-steam-library";
import { gameSize, type SteamInstall } from "@/lib/games/installed";
import { loadCurrentPlayerCounts, PLAYER_COUNT_TTL, type GamePlayerCount } from "@/lib/games/player-counts";
import { XBOX_ART } from "../settings/controllers-panel/pad-art";
import { GameArt } from "./game-art";
import { Flag } from "@/components/flag";
import { DetailLoading } from "./game-detail-loading";
import { DetailDisclosure } from "./game-detail-disclosure";
import { GameAchievementManager } from "./game-achievement-manager";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { PublicAchievementsModal } from "./game-public-achievements";
import { useAchievementProgress } from "@/hooks/use-achievement-progress";
import { achievementPreviewRows } from "@/lib/games/achievement-progress";

export function GameInstalledStatus({ library, installed }: { library: SteamLibraryState; installed?: SteamInstall }) {
  const t = useT();
  const key = installed ? `games.details.${installed.state === "installed" ? "installed" : installed.state}` : library.loading ? "games.details.scanning" : library.error ? "games.details.scanError" : library.available ? "games.details.notInstalled" : "games.details.desktop";
  return <div className="games-detail-installed" data-installed={installed?.state === "installed"}>
    {installed?.state === "installed" ? <Check size={16} aria-hidden="true" /> : <Monitor size={16} aria-hidden="true" />}
    <span className="games-detail-installed-copy"><span>{t(key)}</span>{installed?.state === "installed" && installed.sizeBytes > 0 && <span className="games-detail-installed-size">{gameSize(installed.sizeBytes)}</span>}</span>
    {library.available && <HoverTooltip label={t("games.details.scan")}><button aria-label={t("games.details.scan")} disabled={library.loading} onClick={() => void library.refresh()}><RefreshCw size={15} /></button></HoverTooltip>}
  </div>;
}

export function DetailCompatibility({ platforms, controller, deck, appId }: { platforms: string[]; controller?: string; deck?: GameDetailExtras["deck"]; appId?: number }) {
  const t = useT();
  const platformArt: Record<string, string> = { Windows: "win", macOS: "mac" };
  return <DetailDisclosure title={t("games.details.support")} icon={<Gamepad2 size={22}/>} prominent className="games-detail-compatibility-disclosure"><section className="games-detail-compatibility">
    {platforms.length > 0 && <><h3>{t("games.details.playOn")}</h3><div className="games-detail-platforms">{platforms.map(platform => <span key={platform}>{platform === "Linux" ? <span className="games-platform-linux" aria-hidden="true"/> : platformArt[platform] ? <img width={17} height={17} src={`https://store.akamai.steamstatic.com/public/images/v6/icon_platform_${platformArt[platform]}.png`} alt="" /> : <Monitor size={15} />}{platform}</span>)}</div></>}
    <div className="games-detail-controller" data-support={controller || "unknown"}><div className="games-controller-art"><svg viewBox={XBOX_ART.box.join(" ")} aria-hidden="true">{XBOX_ART.parts.map((part, index) => <path key={index} d={part.d} fill={part.f} />)}</svg>{!controller && <span className="games-controller-unknown" aria-hidden="true">?</span>}</div><div><h3>{t("games.details.controllerPartial")}</h3><strong className="games-controller-state">{t(`games.details.controllerState.${controller === "full" || controller === "partial" || controller === "none" ? controller : "unknown"}`)}</strong><p>{t(controller === "full" ? "games.details.controllerFullNote" : controller === "partial" ? "games.details.controllerPartialNote" : controller === "none" ? "games.details.controllerNoneNote" : "games.details.controllerUnknown")}</p></div></div>
    {deck && appId && <HoverTooltip label={t("games.details.deckMore")}><button className="games-detail-deck" data-status={deck} onClick={() => openUrl(`https://store.steampowered.com/app/${appId}/`) }><Gamepad2 size={17} /><span>{t("games.details.deck")}</span><strong>{deck === "verified" && <Check size={13} />}{t(`games.details.deck.${deck}`)}</strong></button></HoverTooltip>}
  </section></DetailDisclosure>;
}

export function DetailPlayerActivity({ appId, active }: { appId: number; active: boolean }) {
  const t = useT(), [value, setValue] = useState<GamePlayerCount | null>(null), [revision, setRevision] = useState(0), [pending, setPending] = useState(true);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController();
    void loadCurrentPlayerCounts([appId], request.signal).then(items => { if (!request.signal.aborted) { setValue(items[0] ?? null); setPending(false); } }, () => { if (!request.signal.aborted) { setValue(null); setPending(false); } });
    const timer = window.setTimeout(() => setRevision(n => n + 1), PLAYER_COUNT_TTL);
    return () => { request.abort(); window.clearTimeout(timer); };
  }, [appId, active, revision]);
  if (!value) return pending ? <DetailLoading kind="activity"/> : null;
  return <div className="games-detail-player-count"><PlayersActiveMark /><div><HoverTooltip label={t("games.details.playersAt", { time: new Date(value.playersObservedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) })}><strong>{value.currentPlayers.toLocaleString()}</strong></HoverTooltip><span>{t("games.details.playingNow")}</span></div></div>;
}

export function DetailReviewRatings({ items }: { items: ReviewRating[] }) {
  const t = useT();
  if (!items.length) return null;
  return <DetailDisclosure title={t("games.details.ratings")} icon={<Star size={22}/>} prominent><section className="games-detail-review-ratings">{items.map(item => <a href={item.url} key={item.source} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(item.url); }}><RatingSourceMark source={item.source}/><span><b>{item.source === "metacritic" ? "Metacritic" : item.source === "steam" ? "Steam" : t(item.source === "igdb-critics" ? "games.details.igdbCritics" : "games.details.igdbPlayers")}</b><small>{item.count ? t("games.details.ratingCount", { count: item.count.toLocaleString() }) : t("games.details.critics")}</small></span><strong data-rating={item.score >= 75 ? "high" : "mixed"}>{Math.round(item.score)}<small>{item.kind === "positive-reviews" ? "%" : "/100"}</small></strong></a>)}</section></DetailDisclosure>;
}

export function DetailRating({ rating }: { rating: NonNullable<GameDetailExtras["rating"]> }) {
  const t = useT();
  return <DetailDisclosure title={t("games.details.rating", {agency:rating.agency})} icon={<ShieldCheck size={22}/>}><section className="games-detail-rating">
    {rating.image ? <GameArt src={rating.image} alt={`${rating.agency} ${rating.rating}`} /> : <strong className="games-detail-rating-value" aria-label={`${rating.agency} ${rating.rating}`}>{rating.rating}</strong>}
    <div><h3>{t("games.details.rating", { agency: rating.agency })}</h3>{rating.descriptors.length > 0 && <p>{rating.descriptors.join(" · ")}</p>}{rating.interactive && <small>{rating.interactive}</small>}{rating.source && <a className="games-detail-rating-source" href={rating.source.url} onClick={event => { event.preventDefault(); openUrl(rating.source!.url); }}>{t("games.details.ratingSource", { source: rating.source.name })}</a>}</div>
  </section></DetailDisclosure>;
}

export function DetailLanguages({ languages }: { languages: GameLanguage[] }) {
  const t = useT(), [expanded, setExpanded] = useState(false);
  const names = new Intl.DisplayNames(undefined, { type: "language" });
  const englishNames = new Intl.DisplayNames("en", { type: "language" });
  const flagLanguage = (code: string) => ({ "zh-Hans": "Chinese (Simplified)", "zh-Hant": "Chinese", "zh-CN": "Chinese (Simplified)", "zh-TW": "Chinese", "pt-BR": "Portuguese (Brazil)", "pt-PT": "Portuguese", "es-ES": "Spanish", "es-419": "Spanish (Latin America)", "nb": "Norwegian" }[code] ?? englishNames.of(code) ?? code);
  const capabilities = [{ key: "interface", Icon: Monitor }, { key: "audio", Icon: Volume2 }, { key: "subtitles", Icon: Captions }];
  const status = (supported: boolean) => <span aria-label={t(supported ? "games.details.supported" : "games.details.unsupported")}>{supported ? <Check size={15} aria-hidden="true" /> : <span aria-hidden="true">—</span>}</span>;
  return <DetailDisclosure className="games-detail-languages" icon={<Languages size={22}/>} title={t("games.languages")} note={t("games.details.languageCount", { count: languages.length })}><table><thead><tr><th scope="col">{t("games.languages")}</th>{capabilities.map(({key, Icon}) => <th scope="col" key={key} aria-label={t(`games.details.${key}`)}><HoverTooltip label={t(`games.details.${key}`)}><span className="games-language-capability" tabIndex={0}><Icon size={17} aria-hidden="true"/></span></HoverTooltip></th>)}</tr></thead><tbody>{languages.slice(0, expanded ? languages.length : 5).map(language => <tr key={language.code}><th scope="row"><span className="games-detail-language-name"><span aria-hidden="true"><Flag language={flagLanguage(language.code)} size="sm" showLabel={false}/></span><span>{names.of(language.code) ?? language.code}</span></span></th><td>{status(language.interface)}</td><td>{status(language.audio)}</td><td>{status(language.subtitles)}</td></tr>)}</tbody></table>{languages.length > 5 && <button className="games-detail-text-button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? "games.details.lessLanguages" : "games.details.moreLanguages", { count: languages.length })}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>}</DetailDisclosure>;
}

export function DetailRequirements({ minimum, recommended }: { minimum: string; recommended: string }) {
  const t = useT(), id = useId(), [selected, setSelected] = useState<"minimum" | "recommended">(minimum ? "minimum" : "recommended");
  const options = (["minimum", "recommended"] as const).filter(option => option === "minimum" ? minimum : recommended);
  const rows = requirementRows(selected === "minimum" ? minimum : recommended);
  return <DetailDisclosure title={t("games.requirements")} icon={<Cpu size={22}/>}><section className="games-requirements games-detail-requirements"><div role="tablist" aria-label={t("games.requirements")}>{options.map(option => <button key={option} id={`${id}-${option}`} role="tab" aria-selected={selected === option} aria-controls={`${id}-panel`} tabIndex={selected === option ? 0 : -1} onClick={() => setSelected(option)} onKeyDown={event => { if (options.length < 2 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? options[0]! : event.key === "End" ? options.at(-1)! : selected === "minimum" ? "recommended" : "minimum"; setSelected(next); document.getElementById(`${id}-${next}`)?.focus(); }}>{t(`games.details.${option}`)}</button>)}</div><div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${selected}`} tabIndex={0}><dl className="games-detail-specs">{rows.specs.map((spec, index) => { const Icon = /processor/i.test(spec.label) ? Cpu : /memory/i.test(spec.label) ? MemoryStick : /storage/i.test(spec.label) ? HardDrive : /graphics|OS/i.test(spec.label) ? Monitor : null; return <div key={`${spec.label}:${index}`}><dt>{Icon && <Icon size={15}/>}<span>{spec.label}</span></dt><dd>{spec.value}</dd></div>; })}</dl>{rows.notes.map((note,index) => <p className="games-detail-spec-note" key={index}>{note}</p>)}</div></section></DetailDisclosure>;
}

export function DetailAchievements({ appId, profile, account, gameName, total, items, active, onOpenChange }: { appId: number; profile: string; account?: SteamAccount; gameName: string; total: number; items: { name: string; icon: string }[]; active: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(), [view, setView] = useState<"list" | "manage" | "manage-from-list" | null>(null), [requested, setRequested] = useState<string>();
  const open = view !== null;
  const { personal, reading, notOwned } = useAchievementProgress(appId, profile, account, active && !open);
  const preview = achievementPreviewRows(items, personal, notOwned);
  const unlock = (id?: string) => { setRequested(id); setView("manage-from-list"); };
  useEffect(() => { if (!active) setView(null); }, [active]);
  useEffect(() => { onOpenChange(open); return () => onOpenChange(false); }, [open, onOpenChange]);
  return <DetailDisclosure title={t("games.details.publicAchievements")} icon={<Trophy size={22}/>} note={total} prominent><section className="games-detail-achievements"><button className="games-detail-achievement-strip" aria-busy={reading} onClick={() => setView("list")} aria-label={t("games.details.viewAchievements", { count: total })}>{preview.map(item => {
    const secret = item.hidden && !item.unlocked;
    const label = `${secret ? t("games.account.secretAchievement") : item.name} · ${t(reading ? "games.achievementManager.progressLoading" : item.unlocked === undefined ? "games.achievementManager.progressUnavailable" : item.unlocked ? "games.achievementManager.earned" : "games.achievementManager.locked")}`;
    return <span key={item.key} className={`games-detail-achievement-preview${reading ? " games-detail-skeleton" : ""}`} data-progress={reading || item.unlocked === undefined ? "unknown" : item.unlocked ? "earned" : "locked"} role="img" aria-label={label} title={label}>
      {!reading && <>{!secret && <GameArt src={item.icon} alt=""/>}{(secret || item.unlocked === false) && <span className="games-detail-achievement-lock" aria-hidden="true"><LockKeyhole size={12}/></span>}</>}
    </span>;
  })}{total > preview.length && <span>+{total - preview.length}</span>}</button><div className="games-achievement-actions"><button className="games-detail-text-button" onClick={() => setView("list")}>{t("games.details.viewAchievements", { count: total })}</button><button className="gam-unlock-entry" onClick={() => { setRequested(undefined); setView("manage"); }}>{t("games.achievementManager.open")}</button></div>{open && active && (view !== "list" ? <GameAchievementManager key={`${profile}:${appId}`} profile={profile} appId={appId} gameName={gameName} account={account} initialAchievementId={requested} onClose={() => setView(view === "manage-from-list" ? "list" : null)}/> : <PublicAchievementsModal key={`${profile}:${appId}:${account?.status.snapshot?.steamId ?? "local"}`} appId={appId} profile={profile} account={account} total={total} onManage={unlock} onClose={() => setView(null)} />)}</section></DetailDisclosure>;
}

