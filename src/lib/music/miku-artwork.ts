import type { MikuModel } from "./miku-models";
import classicPortrait from "@/assets/music/miku-idle.webp";
import classicIdle from "@/assets/music/miku-idle-motion.webp";
import classicMotion from "@/assets/music/miku-motion.webp";
import classicEyes from "@/assets/music/miku-eyes-closed.webp";
import classicSway from "@/assets/music/miku-dance-sway.webp";
import classicReference from "@/assets/music/miku-dance-reference.webp";
import retroPortrait from "@/assets/music/miku-retro-idle.webp";
import retroIdle from "@/assets/music/miku-retro-idle-motion.webp";
import retroMotion from "@/assets/music/miku-retro-motion.webp";
import retroEyes from "@/assets/music/miku-retro-eyes-closed.webp";
import retroSway from "@/assets/music/miku-retro-dance-sway.webp";
import retroReference from "@/assets/music/miku-retro-dance-reference.webp";
import modernPortrait from "@/assets/music/miku-modern-idle.webp";
import modernIdle from "@/assets/music/miku-modern-idle-motion.webp";
import modernMotion from "@/assets/music/miku-modern-motion.webp";
import modernEyes from "@/assets/music/miku-modern-eyes-closed.webp";
import modernSway from "@/assets/music/miku-modern-dance-sway.webp";
import modernReference from "@/assets/music/miku-modern-dance-reference.webp";

export type MikuArtworkSet = { portrait: string; idle: string; motion: string; eyes: string; dances: readonly [string, string] };
export const MIKU_ARTWORK: Record<MikuModel, MikuArtworkSet> = {
  classic: { portrait: classicPortrait, idle: classicIdle, motion: classicMotion, eyes: classicEyes, dances: [classicSway, classicReference] },
  retro: { portrait: retroPortrait, idle: retroIdle, motion: retroMotion, eyes: retroEyes, dances: [retroSway, retroReference] },
  modern: { portrait: modernPortrait, idle: modernIdle, motion: modernMotion, eyes: modernEyes, dances: [modernSway, modernReference] },
};
