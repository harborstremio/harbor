export type MangaUniverse = {
  id: string;
  name: string;
  query: string;
  accent: number;
  logo?: string;
  backdrop?: string;
  noLogo?: boolean;
};

const TV = "https://artworks.thetvdb.com/banners";
const ANI = "https://s4.anilist.co/file/anilistcdn/media/anime/banner";

export const MANGA_UNIVERSES: MangaUniverse[] = [
  {
    id: "one-piece",
    name: "One Piece",
    query: "One Piece",
    accent: 40,
    logo: `${TV}/v4/series/81797/clearlogo/611b6189d88b6.png`,
    backdrop: `${TV}/v4/series/81797/backgrounds/616009a8bd688.jpg`,
  },
  {
    id: "naruto",
    name: "Naruto",
    query: "Naruto",
    accent: 55,
    logo: `${TV}/v4/series/78857/clearlogo/611b6a908fa9d.png`,
    backdrop: `${TV}/fanart/original/78857-18.jpg`,
  },
  {
    id: "bleach",
    name: "Bleach",
    query: "Bleach",
    accent: 25,
    logo: `${TV}/v4/series/74796/clearlogo/611b6233b8698.png`,
    backdrop: `${TV}/fanart/original/74796-1.jpg`,
  },
  {
    id: "jujutsu-kaisen",
    name: "Jujutsu Kaisen",
    query: "Jujutsu Kaisen",
    accent: 285,
    logo: `${TV}/v4/series/377543/clearlogo/611c681d42ac0.png`,
    backdrop: `${TV}/v4/series/377543/backgrounds/609cba7794bab.jpg`,
  },
  {
    id: "my-hero-academia",
    name: "My Hero Academia",
    query: "My Hero Academia",
    accent: 150,
    logo: `${TV}/v4/series/305074/clearlogo/611bb82a72c21.png`,
    backdrop: `${TV}/fanart/original/305074-19.jpg`,
  },
  {
    id: "demon-slayer",
    name: "Demon Slayer",
    query: "Kimetsu no Yaiba",
    accent: 12,
    logo: `${TV}/v4/series/348545/clearlogo/611c7fa8222d6.png`,
    backdrop: `${TV}/fanart/original/5c93cbb2b60b6.jpg`,
  },
  {
    id: "attack-on-titan",
    name: "Attack on Titan",
    query: "Shingeki no Kyojin",
    accent: 95,
    logo: `${TV}/v4/series/267440/clearlogo/611b6d09b9442.png`,
    backdrop: `${TV}/series/267440/backgrounds/5f8611eaa79ff.jpg`,
  },
  {
    id: "chainsaw-man",
    name: "Chainsaw Man",
    query: "Chainsaw Man",
    accent: 8,
    logo: `${TV}/v4/series/397934/clearlogo/6346d92034848.png`,
    backdrop: `${TV}/v4/series/397934/backgrounds/62f7545a78181.jpg`,
  },
  {
    id: "hunter-x-hunter",
    name: "Hunter x Hunter",
    query: "Hunter x Hunter",
    accent: 135,
    logo: `${TV}/v4/series/79076/clearlogo/611bd1a41c0d3.png`,
    backdrop: `${TV}/fanart/original/79076-1.jpg`,
  },
  {
    id: "dragon-ball",
    name: "Dragon Ball",
    query: "Dragon Ball",
    accent: 65,
    logo: `${TV}/v4/series/76666/clearlogo/611b6f5db10ae.png`,
    backdrop: `${TV}/fanart/original/76666-2.jpg`,
  },
  {
    id: "berserk",
    name: "Berserk",
    query: "Berserk",
    accent: 350,
    logo: `${TV}/v4/series/73752/clearlogo/611b9d7ba58fb.png`,
    backdrop: `${TV}/fanart/original/73752-1.jpg`,
  },
  {
    id: "spy-x-family",
    name: "Spy x Family",
    query: "Spy x Family",
    accent: 330,
    logo: `${TV}/v4/series/405920/clearlogo/6a13086a2a311.png`,
    backdrop: `${TV}/v4/series/405920/backgrounds/6181af0258553.jpg`,
  },
  { id: "fullmetal-alchemist", name: "Fullmetal Alchemist", query: "Fullmetal Alchemist", accent: 45, backdrop: `${ANI}/5114-q0V5URebphSG.jpg`, logo: `${TV}/v4/series/85249/clearlogo/65d55fa6168c7.png` },
  { id: "death-note", name: "Death Note", query: "Death Note", accent: 0, backdrop: `${ANI}/1535.jpg`, logo: `${TV}/v4/series/79481/clearlogo/689f8d7181f1d.png` },
  { id: "tokyo-ghoul", name: "Tokyo Ghoul", query: "Tokyo Ghoul", accent: 275, backdrop: `${ANI}/20605-RCJ7M71zLmrh.jpg`, logo: `${TV}/v4/series/281249/clearlogo/611ba41336564.png` },
  { id: "one-punch-man", name: "One Punch Man", query: "One Punch-Man", accent: 50, backdrop: `${ANI}/21087-sHb9zUZFsHe1.jpg`, logo: `${TV}/v4/series/293088/clearlogo/611bb0fee38ac.png` },
  { id: "jojo", name: "JoJo's Bizarre Adventure", query: "JoJo's Bizarre Adventure", accent: 300, backdrop: `${ANI}/666-emK2J3PsdHb2.jpg`, logo: `${TV}/v4/series/262954/clearlogo/611bf2a856cb3.png` },
  { id: "vinland-saga", name: "Vinland Saga", query: "Vinland Saga", accent: 30, backdrop: `${ANI}/101348-pivKKffCAwAY.jpg`, logo: `${TV}/v4/series/359274/clearlogo/611d013a43e48.png` },
  { id: "dr-stone", name: "Dr. Stone", query: "Dr. Stone", accent: 160, backdrop: `${ANI}/105333-KWKGvBM8Hyga.jpg`, logo: `${TV}/v4/series/355774/clearlogo/611ca7d4b79d4.png` },
  { id: "fire-force", name: "Fire Force", query: "Fire Force", accent: 20, backdrop: `${ANI}/105310-ygGL9yweZM2Q.jpg`, logo: `${TV}/v4/series/355480/clearlogo/611ca33b347aa.png` },
  { id: "black-clover", name: "Black Clover", query: "Black Clover", accent: 340, backdrop: `${ANI}/97940-1URQdQ4U1a0b.jpg`, logo: `${TV}/v4/series/331753/clearlogo/611c1abd9aca1.png` },
  { id: "seven-deadly-sins", name: "The Seven Deadly Sins", query: "The Seven Deadly Sins", accent: 125, backdrop: `${ANI}/20789-qwG9GcxIrmVE.jpg`, logo: `${TV}/v4/series/284131/clearlogo/611be5b9138e5.png` },
  { id: "haikyu", name: "Haikyu!!", query: "Haikyu", accent: 200, backdrop: `${ANI}/20464-PpYjO9cPN1gs.jpg`, logo: `${TV}/v4/series/278157/clearlogo/611c2a032e6a6.png` },
  { id: "blue-lock", name: "Blue Lock", query: "Blue Lock", accent: 230, backdrop: `${ANI}/137822-oevspckMGLuY.jpg`, logo: `${TV}/v4/series/408629/clearlogo/6693f3da9b416.png` },
  { id: "solo-leveling", name: "Solo Leveling", query: "Solo Leveling", accent: 260, backdrop: `${ANI}/151807-37yfQA3ym8PA.jpg`, logo: `${TV}/v4/series/389597/clearlogo/6749c5054f0aa.png` },
  { id: "tokyo-revengers", name: "Tokyo Revengers", query: "Tokyo Revengers", accent: 190, backdrop: `${ANI}/120120-UDYgoHA69peT.jpg`, logo: `${TV}/v4/series/393478/clearlogo/611d007ea31b7.png` },
  { id: "mob-psycho", name: "Mob Psycho 100", query: "Mob Psycho 100", accent: 170, backdrop: `${ANI}/21507-Qx8bGsLXUgLo.jpg`, logo: `${TV}/v4/series/307375/clearlogo/611c29be3e878.png` },
  { id: "slime", name: "Reincarnated as a Slime", query: "That Time I Got Reincarnated as a Slime", accent: 210, backdrop: `${ANI}/101280-9t7J3774n955.jpg`, logo: `${TV}/v4/series/352408/clearlogo/611c83c1eba90.png` },
  { id: "frieren", name: "Frieren", query: "Frieren", accent: 115, backdrop: `${ANI}/154587-ivXNJ23SM1xB.jpg`, logo: `${TV}/v4/series/424536/clearlogo/65d798fbd2f61.png` },
  { id: "vagabond", name: "Vagabond", query: "Vagabond", accent: 35, backdrop: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/30656-XYzvRlsc3iK4.jpg", logo: "/universe-logos/vagabond.png" },
];
