/** Original Harbor game cards: a small collection with a controller on the front. */
export function DiscoveryPickerIcon({size=26}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="m9 6 14-2a3 3 0 0 1 3.4 2.5l2 14a3 3 0 0 1-2.5 3.4l-1.9.3V10a4 4 0 0 0-4-4Z" fill="currentColor" opacity=".32"/>
    <rect x="4" y="8" width="19" height="20" rx="4" fill="currentColor" opacity=".1"/>
    <rect x="4" y="8" width="19" height="20" rx="4" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M9 15.5v5m-2.5-2.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="18.5" cy="16.5" r="1.25" fill="currentColor"/>
    <circle cx="15.5" cy="19.5" r="1.25" fill="currentColor"/>
  </svg>;
}

/** Small, deliberately drawn genre silhouettes share the entry mark's line weight. */
export function DiscoveryStyleIcon({kind}:{kind:string}) {
  const paths:Record<string,string>={
    extraction:"M5 18V6h9v4M4 20h12M11 14h10m-4-4 4 4-4 4",
    mmorpg:"m5 4 14 16M19 4 5 20M4 16l4 4M16 20l4-4M4 4l2 6 4-4-6-2Zm16 0-6 2 4 4 2-6Z",
    shooter:"M12 3v4m0 10v4M3 12h4m10 0h4M7 7h10v10H7Z",
    survival:"m3 20 9-16 9 16H3Zm5 0 4-7 4 7M12 4V2",
    openWorld:"M3 7 9 4l6 3 6-3v16l-6 3-6-3-6 3V7Zm6-3v16m6-13v16",
    storyRich:"M12 6C9 3 4 4 3 5v15c3-2 6-2 9 1m0-15c3-3 8-2 9-1v15c-3-2-6-2-9 1V6Z",
    soulslike:"M12 3v14m-4-5h8m-4 5-3 4h6l-3-4ZM5 21h14",
    roguelite:"m15 3 5 4-5 4m5-4H8l-4 5m5 9-5-4 5-4m-5 4h12l4-5",
    horror:"M5 11a7 7 0 0 1 14 0v9l-3-2-4 3-4-3-3 2v-9Zm3 1h1m6 0h1m-7 4h6",
    relaxing:"M5 19c10 0 15-6 15-15C9 4 4 10 5 19Zm0 0 9-9M3 21l2-2",
    building:"M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7",
    crafting:"m5 3 5 5-3 3-5-5m8 2 10 10-3 3L7 11m7-7 6 6m-8-4 5-4 5 5-4 5",
    rpg:"m12 3 8 4v6c0 5-8 9-8 9S4 18 4 13V7l8-4Zm0 5v9m-3-6h6",
    strategy:"M6 3v4h3V3h6v4h3V3h3v7l-3 2v6l2 3H4l2-3v-6l-3-2V3h3Z",
    simulation:"M3 7h18v12H3V7Zm4-4h10M7 11h4m-4 4h4m5-4v4",
    puzzle:"M4 4h6V2h4v2h6v6h2v4h-2v6h-6v2h-4v-2H4v-6H2v-4h2V4Z",
    racing:"m5 8 2-5h10l2 5M3 8h18v10H3V8Zm2 10v3m14-3v3M6 12h3m6 0h3",
    automation:"M4 6h6v6H4V6Zm10 6h6v6h-6v-6ZM10 9h7v3M7 12v5h7M6 3v3m12 12v3",
    colony:"M3 20h18M4 20V10h6v10m3 0V4h6v16M6 13h2m7-6h2m-2 5h2m-2 5h2",
    deckbuilder:"m5 3 13 2-2 17-13-2L5 3Zm5 5 3 5-4 3-2-5 3-3Zm10-1 2 14",
  };
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]??paths.openWorld}/></svg>;
}
