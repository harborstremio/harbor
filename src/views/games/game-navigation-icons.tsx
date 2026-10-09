import { GameDestinationIcon } from '@/components/icons/game-destination-icon';
/** Original Games navigation marks, drawn together on a 24px grid. */
export function GameNavigationIcon({ name }: { name: "explore" | "roms" }) {
  return <span className="games-navigation-rom-icon" aria-hidden="true">
    {name === 'roms' ? <GameDestinationIcon name="roms"/> : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="m3 5 5.5-2 7 2L21 3v16l-5.5 2-7-2L3 21V5Z"/>
        <path d="M8.5 3v5m0 8v3m7-14v1.5m0 12V21"/>
        <path d="m18 8.5-4.1 8.2-1.5-3.1-3.1-1.3L18 8.5Z" fill="currentColor" strokeWidth="1"/>
    </svg>}
  </span>;
}
