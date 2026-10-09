// Original series marks. Source records: public/games/roms/COLLECTION-ARTWORK.md.
const marks: Record<string, { logo: string; originalColor?: boolean; hero?: string }> = {
  "diablo": { logo: "/games/roms/diablo.svg" },
  "spyro the dragon": { logo: "/games/roms/spyro.svg", originalColor: true },
  "castlevania": { logo: "/games/roms/castlevania.png", originalColor: true },
  "metal gear": { logo: "/games/roms/metal-gear.svg" },
  "silent hill": { logo: "/games/roms/silent-hill.png" },
  "crash bandicoot": { logo: "/games/roms/crash-bandicoot.png", originalColor: true },
  "tomb raider": { logo: "/games/roms/tomb-raider.svg" },
  "sonic the hedgehog": { logo: "/games/roms/sonic.svg", originalColor: true },
  "tetris": { logo: "/games/records/tetris.svg", originalColor: true, hero: "https://images.igdb.com/igdb/image/upload/t_1080p/scs8lz.jpg" },
};
export const romCollectionArtwork = (name: string) => marks[name.toLocaleLowerCase()];
