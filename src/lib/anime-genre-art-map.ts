export const ANIME_GENRE_ART: Record<string, string> = {
  "Action": "https://assets.fanart.tv/fanart/attack-on-titan-551eb271053e8.jpg",
  "Adventure": "https://assets.fanart.tv/fanart/hunter-x-hunter-2011-61d34c13e5bc6.jpg",
  "Comedy": "https://assets.fanart.tv/fanart/spy-x-family-679872d27d81e.jpg",
  "Drama": "https://assets.fanart.tv/fanart/violet-evergarden-5a926cb105c69.jpg",
  "Fantasy": "https://assets.fanart.tv/fanart/frieren-beyond-journeys-end-651b2c7b0eecb.jpg",
  "Sci-Fi": "https://assets.fanart.tv/fanart/cowboy-bebop-51322407067f9.jpg",
  "Romance": "https://assets.fanart.tv/fanart/your-name-5845e4f97e1b1.jpg",
  "Slice of Life": "https://assets.fanart.tv/fanart/laid-back-camp-6528cfaede29d.jpg",
  "Supernatural": "https://assets.fanart.tv/fanart/bleach-thousand-year-blood-war-6212a47d81e0d.jpg",
  "Mystery": "https://assets.fanart.tv/fanart/monster-56af5105558dc.jpg",
  "Psychological": "https://assets.fanart.tv/fanart/death-note-52ef42c02c464.jpg",
  "Horror": "https://assets.fanart.tv/fanart/tokyo-ghoul-606328ac1e044.jpg",
  "Thriller": "https://assets.fanart.tv/fanart/psycho-pass-53db3233c7256.jpg",
  "Mecha": "https://assets.fanart.tv/fanart/neon-genesis-evangelion-5191ddf7b5d95.jpg",
  "Sports": "https://assets.fanart.tv/fanart/haikyuu-5fae8651d2f9f.jpg",
  "Music": "https://assets.fanart.tv/fanart/bocchi-the-rock-63b695bd6e991.jpg",
};

let warmed = false;

export function preloadAnimeGenreArt(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  for (const url of Object.values(ANIME_GENRE_ART)) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
