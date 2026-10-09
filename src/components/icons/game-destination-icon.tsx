/** Games destinations share Harbor's 24-unit grid and restrained outline weight. */
export function GameDestinationIcon({ name, size = 21 }: { name: 'roms' | 'mods' | 'all'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{flexShrink:0}}>
    {name === 'roms' ? <>
      <path d="M6.5 3.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5l3-3Z"/>
      <path d="M7 3.5V11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3.5M7 20.5v-4h10v4M10 7.5h4"/>
    </> : name === 'mods' ? <>
      <path d="M4.5 7h5V5a2.5 2.5 0 0 1 5 0v2H19v5h2a2.5 2.5 0 0 1 0 5h-2v4H4.5v-5h2a2.5 2.5 0 0 0 0-5h-2V7Z" transform="translate(-.5 -.5) scale(.98)"/>
    </> : <>
      <rect x="3" y="3" width="7" height="8" rx="1.25"/>
      <rect x="14" y="3" width="7" height="8" rx="1.25"/>
      <rect x="3" y="15" width="7" height="6" rx="1.25"/>
      <rect x="14" y="15" width="7" height="6" rx="1.25"/>
    </>}
  </svg>;
}
