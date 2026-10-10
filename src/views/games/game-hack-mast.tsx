import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

export function GameHackMast({navigation,query,change}:{navigation:ReactNode;query:string;change:(query:string)=>void}) {
  const t=useT();
  return <header className="games-mast games-inset games-hack-mast"><div className="games-mast-title"><h1 tabIndex={-1}>{t('nav.games')}</h1></div>{navigation}<div className="games-search"><Search size={17}/><input aria-label={t('games.hub.search')} placeholder={t('games.hub.search')} value={query} onChange={event=>change(event.target.value)}/>{query&&<button className="games-icon-button" aria-label={t('games.clear')} onClick={()=>change('')}><X size={16}/></button>}</div></header>;
}
