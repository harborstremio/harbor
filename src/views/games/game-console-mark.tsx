import { useState } from 'react';

/** Original platform wordmarks, shared by the ROM shortcut menu and filters. */
export function GameConsoleMark({ platform }: { platform: { image?: string; short: string } }) {
  const [failed,setFailed]=useState('');
  return <span className="games-console-logo" aria-hidden="true">
    {platform.image && failed!==platform.image ? <img src={platform.image} alt="" loading="lazy" decoding="async" onError={()=>setFailed(platform.image!)}/> : <span>{platform.short}</span>}
  </span>;
}
