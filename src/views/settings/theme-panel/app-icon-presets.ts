import liquidGlass from "@/assets/app-icons/liquid-glass.png";
import darkLumina from "@/assets/app-icons/dark-lumina.png";
import fluentBlue from "@/assets/app-icons/fluent-blue.png";
import flatTeal from "@/assets/app-icons/flat-teal.png";
import terminal from "@/assets/app-icons/terminal.png";
import monochrome from "@/assets/app-icons/monochrome.png";
import mahogany from "@/assets/app-icons/mahogany.png";
import origamiMint from "@/assets/app-icons/origami-mint.png";
import clayPeach from "@/assets/app-icons/clay-peach.png";
import pixelArcade from "@/assets/app-icons/pixel-arcade.png";
import chromeObsidian from "@/assets/app-icons/chrome-obsidian.png";
import blueprint from "@/assets/app-icons/blueprint.png";
import watercolor from "@/assets/app-icons/watercolor.png";
import animeInk from "@/assets/app-icons/anime-ink.png";
import animeInkBw from "@/assets/app-icons/anime-ink-bw.png";
import diamond from "@/assets/app-icons/stremio.png";
import boat from "@/assets/app-icons/boat.png";

export type AppIconPreset = { id: string; label: string; src: string };

export const APP_ICON_PRESETS: AppIconPreset[] = [
  { id: "diamond", label: "Stremio", src: diamond },
  { id: "liquid-glass", label: "Liquid Glass", src: liquidGlass },
  { id: "dark-lumina", label: "Dark Lumina", src: darkLumina },
  { id: "fluent-blue", label: "Fluent Blue", src: fluentBlue },
  { id: "flat-teal", label: "Flat Teal", src: flatTeal },
  { id: "chrome-obsidian", label: "Chrome", src: chromeObsidian },
  { id: "watercolor", label: "Watercolor", src: watercolor },
  { id: "mahogany", label: "Mahogany", src: mahogany },
  { id: "origami-mint", label: "Origami", src: origamiMint },
  { id: "clay-peach", label: "Clay", src: clayPeach },
  { id: "monochrome", label: "Monochrome", src: monochrome },
  { id: "boat", label: "White", src: boat },
  { id: "blueprint", label: "Blueprint", src: blueprint },
  { id: "terminal", label: "Terminal", src: terminal },
  { id: "pixel-arcade", label: "Pixel", src: pixelArcade },
  { id: "anime-ink", label: "Anime Ink", src: animeInk },
  { id: "anime-ink-bw", label: "Ink B&W", src: animeInkBw },
];
