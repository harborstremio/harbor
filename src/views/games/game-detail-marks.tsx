/** Harbor's activity mark: two players gathered around one controller. */
export function PlayersActiveMark() {
  return <svg className="games-players-active-mark" width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="15" cy="10" r="4" fill="currentColor" opacity=".9"/><circle cx="28" cy="12" r="3" fill="currentColor" opacity=".45"/><path d="M5 24v-3c0-4 4-6 10-6 4 0 7 1 8 3M31 18c3 1 5 3 5 6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 22h12c2 0 3 1 3.5 3l1.5 7c.5 2-1.5 3-3 1.5L25 31h-10l-3 2.5C10.5 35 8.5 34 9 32l1.5-7c.5-2 1.5-3 3.5-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M15 25.5v5m-2.5-2.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="24" cy="26.5" r="1.1" fill="currentColor"/><circle cx="26.5" cy="29" r="1.1" fill="currentColor"/></svg>;
}

/** Official Steam header artwork, showing its circular mark at its original proportions. */
export function SteamMark() {
  return <img src="/games/brands/steam.svg" width={20} height={20} style={{ width: 20, height: 20, flex: "0 0 20px", objectFit: "contain" }} aria-hidden="true" alt="" />;
}

export function RatingSourceMark({ source }: { source: string }) {
  const brand = source.startsWith("igdb") ? "igdb" : source === "metacritic" ? "metacritic" : "steam";
  return <img className={`games-rating-brand games-rating-brand-${brand}`} src={`/games/brands/${brand}.svg`} width={34} height={34} alt="" aria-hidden="true"/>;
}
