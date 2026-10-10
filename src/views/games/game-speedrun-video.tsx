import { Play } from "@/components/icons/play-filled";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { speedrunTime, type SpeedrunRecord } from "@/lib/games/speedrun-data";
import { speedrunVideoEmbed } from "@/lib/games/speedrun-videos";

export function GameSpeedrunVideo({ game, category, record, close }: { game: string; category: string; record: SpeedrunRecord; close: () => void }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null), [selected, setSelected] = useState("0");
  const { closing, close: dismiss } = useModalExit(close), video = record.videos[Number(selected)] ?? record.videos[0];
  const embed = video ? speedrunVideoEmbed(video, window.location.hostname) : null;
  useSectionBack(dismiss, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, dialog = root.current;
    const first = dialog?.querySelector<HTMLButtonElement>("button");
    first?.focus({ preventScroll: true });
    for (const media of document.querySelectorAll<HTMLMediaElement>('.games-view audio,.games-view video')) if (!media.paused) media.pause();
    let current = true;
    void import("@/lib/music/player").then(({ getMusicState, toggleMusicPlayback }) => { if (current && getMusicState().phase === "playing") toggleMusicPlayback(); }).catch(() => {});
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || (event.target as Element)?.closest("[data-dropdown-menu]")) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], iframe')], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const retain = () => { if (dialog && !dialog.contains(document.activeElement) && !(document.activeElement as Element)?.closest("[data-dropdown-menu]")) first?.focus({ preventScroll: true }); };
    document.addEventListener("keydown", trap); document.addEventListener("focusin", retain);
    return () => { current = false; document.removeEventListener("keydown", trap); document.removeEventListener("focusin", retain); if (previous?.isConnected && !previous.closest("[hidden], [inert]")) previous.focus({ preventScroll: true }); };
  }, []);
  return <ModalShell closing={closing} onDismiss={dismiss} width={980} labelledBy={title} backdropClassName="games-speedrun-backdrop">
    <div className="games-speedrun-video" ref={root}>
      <header><div><h2 id={title}>{game} · {category}</h2><p>{record.runners.map(runner => runner.name).join(", ")} · {speedrunTime(record.seconds)}</p></div><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss}><X size={21}/></button></header>
      {record.videos.length > 1 && <div className="games-speedrun-video-parts"><Dropdown value={selected} onChange={setSelected} ariaLabel={t("games.details.runVideo")} size="sm" options={record.videos.map((item, index) => ({ value: String(index), label: t("games.details.videoPart", { source: item.source, number: index + 1 }) }))}/></div>}
      <div className="games-speedrun-player">{!closing && embed ? <iframe key={embed} src={embed} title={`${game} · ${category} · ${video.source}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : !closing && video ? <div className="games-speedrun-external"><Play size={32}/><p>{t("games.details.externalRunVideo", { source: video.source })}</p><a className="games-button" href={video.url} onClick={event => { event.preventDefault(); void openUrl(video.url); }}>{t("games.details.openRunVideo")}<ArrowUpRight size={16}/></a></div> : null}</div>
      <footer><a href={record.url} onClick={event => { event.preventDefault(); void openUrl(record.url); }}>{t("games.details.viewRun")}<ArrowUpRight size={15}/></a>{video && <a href={video.url} onClick={event => { event.preventDefault(); void openUrl(video.url); }}>{t("games.details.openRunVideo")}<span>{video.source}</span><ArrowUpRight size={15}/></a>}</footer>
    </div>
  </ModalShell>;
}
