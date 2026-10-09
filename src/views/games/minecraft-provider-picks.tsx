import { Row } from '@/components/row';
import { useT } from '@/lib/i18n';
import { CURSEFORGE_PACK_PICKS } from '@/lib/games/minecraft-provider-picks';
import type { MinecraftContent } from '@/lib/games/minecraft-catalog';
import { GameArt } from './game-art';
import { MinecraftProjectLink } from './minecraft-project-link';

export function MinecraftProviderPicks({type,query}:{type:MinecraftContent;query:string}) {
 const t=useT();
 const queryWords=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const picks=CURSEFORGE_PACK_PICKS.filter(pack=>queryWords.every(word=>(pack.title+' '+pack.slug).toLocaleLowerCase().includes(word)));
 if(type!=='modpack'||!picks.length)return null;
 return <section className="mc-provider-picks">
  <div className="mc-provider-heading"><h3>{t('games.minecraft.hub.curseforge')}</h3></div>
  <Row className="mc-provider-rail" alwaysActive min={210} shape="square" scrollKey={`minecraft:curseforge:${query}`}>
   {picks.map(pack=><div className="mc-provider-pack" key={pack.slug}><MinecraftProjectLink url={`https://www.curseforge.com/minecraft/modpacks/${pack.slug}`}><GameArt src={pack.icon}/><span>{pack.title}</span></MinecraftProjectLink></div>)}
  </Row>
 </section>;
}
