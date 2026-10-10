import { Check, Gift, Unlock } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { achievementRewards, type AchievementReward } from "@/lib/games/achievement-rewards";
import { GameArt } from "./game-art";

export function AchievementRewardPreview({ reward }: { reward: AchievementReward }) {
  const t = useT();
  return <a className="gam-reward-preview" href={reward.source} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(reward.source); }} aria-label={`${t("games.achievementManager.rewardInfo")}: ${reward.name}`}><GameArt src={reward.image}/><span><strong>{reward.name}</strong><small>{t("games.achievementManager.rewardGame", { game: reward.receivingGame })}</small></span></a>;
}

export function AchievementRewardCatalog({ appId, query, unlock, unlocked }: { appId: number; query: string; unlock: (id: string) => void; unlocked?: ReadonlySet<string> }) {
  const t = useT(), items = achievementRewards(appId).filter(item => `${item.name} ${item.achievementName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="gam-reward-catalog"><p className="gam-reward-note"><Gift size={18}/>{t("games.achievementManager.rewardNote")}</p><div className="gam-reward-grid">{items.map(item => <article key={item.achievementId}><AchievementRewardPreview reward={item}/><p>{t("games.achievementManager.rewardVia", { achievement: item.achievementName })}</p>{unlocked?.has(item.achievementId) ? <span className="gam-reward-owned"><Check size={16}/>{t("games.achievementManager.rewardOwned")}</span> : <button onClick={() => unlock(item.achievementId)}><Unlock size={17}/>{t("games.achievementManager.rewardAction", { item: item.name })}</button>}</article>)}</div>{!items.length && <p className="gam-message">{t("games.details.achievementEmpty")}</p>}</section>;
}
