import vanguard from "@/assets/games/anti-cheat/vanguard.svg";
import easyAntiCheat from "@/assets/games/anti-cheat/easy-anti-cheat.svg";

type AntiCheatArt = { src: string; shape?: "wide"; lightBackdrop?: boolean };

const VAC = { src: "/games/anti-cheat/vac.jpg" };
const EAC = { src: easyAntiCheat, lightBackdrop: true };
const JAVELIN: AntiCheatArt = { src: "/games/anti-cheat/ea-javelin.png", shape: "wide", lightBackdrop: true };

// Artwork only: match the provider's reported system, never infer protection
// from a game title. Provenance is in public/games/anti-cheat/SOURCES.md.
const ART: Record<string, AntiCheatArt> = {
  vac: VAC,
  valveanticheat: VAC,
  valveanticheatvac: VAC,
  vacvalveanticheat: VAC,
  easyanticheat: EAC,
  easyanticheateac: EAC,
  easyanticheateos: EAC,
  eac: EAC,
  battleye: { src: "/games/anti-cheat/battleye.png" },
  battleyeanticheat: { src: "/games/anti-cheat/battleye.png" },
  riotvanguard: { src: vanguard },
  vanguard: { src: vanguard },
  eaanticheat: JAVELIN,
  eajavelin: JAVELIN,
  eajavelinanticheat: JAVELIN,
  ricochet: { src: "/games/anti-cheat/ricochet.jpg", shape: "wide" },
  ricochetanticheat: { src: "/games/anti-cheat/ricochet.jpg", shape: "wide" },
};

export function antiCheatArt(system: string): AntiCheatArt | undefined {
  const key = system.toLowerCase().replace(/[\s\-–—()[\]®™]/g, "");
  return Object.hasOwn(ART, key) ? ART[key] : undefined;
}
