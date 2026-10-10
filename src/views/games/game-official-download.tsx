import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { OfficialGameDownload } from "@/lib/games/official-download";
import { GameArt } from "./game-art";
import "./game-official-download.css";

export function GameOfficialDownload({ source }: { source: OfficialGameDownload }) {
  const t = useT();
  return <a className="games-official-download" href={source.href} target="_blank" rel="noreferrer" onClick={e => { e.preventDefault(); void openUrl(source.href); }}><GameArt src={source.logo}/><span><strong>{source.launcher}</strong><small>{t("games.official.publisherSource")}</small></span><span className="games-official-action">{t("games.official.get", { launcher: source.launcher })}<ArrowUpRight size={18}/></span></a>;
}
