import type { MinecraftProject } from "./minecraft-catalog";

import type { SimsMtsMetrics, SimsMtsProject } from "./sims";

import { launcherSceneArtwork } from "./launcher-title-art";



export const MOD_GAMES = [

  { id: "minecraft", name: "Minecraft", edition: "Java Edition", logo: "/games/minecraft/wordmark.svg", lightLogo: false, art: "/games/publisher/minecraft-java.jpg" },

  { id: "sims4", name: "The Sims 4", edition: "", logo: "/games/mods/sims4-official.png", lightLogo: false, art: launcherSceneArtwork(3212) ?? "" },

  { id: "sims3", name: "The Sims 3", edition: "", logo: "/games/mods/sims3-logo.png", lightLogo: false, art: launcherSceneArtwork(260)! },

  { id: "sims2", name: "The Sims 2", edition: "", logo: "/games/mods/sims2-official.svg", lightLogo: false, art: "https://drop-assets.ea.com/images/1iChlfJ35IOOiIPvGgP4tk/4257cc2a0ee823fde89290dd284d171d/TS2_Control_Their_World.png?im=Resize=(840)&q=80" },

] as const;

export type ModGameId = typeof MOD_GAMES[number]["id"];

export type ModsRoute = { game: null } | { game: "minecraft"; project?: MinecraftProject } | { game: "sims2" | "sims3" | "sims4"; project?: SimsMtsProject };

export type ModDiscoveryProject = { id: string; title: string; description: string; author: string; image: string; icon?: string; downloads?: number; metrics?: SimsMtsMetrics; category?: string; source: string; route: Exclude<ModsRoute, { game: null }> };

export const minecraftModCard = (project: MinecraftProject): ModDiscoveryProject => ({ id: `modrinth:${project.id}`, title: project.title, description: project.description, author: project.author, image: project.art || project.icon, icon: project.icon, downloads: project.downloads, category: project.type, metrics: { downloads: project.downloads }, source: "Modrinth", route: { game: "minecraft", project } });

export const simsModCard = (project: SimsMtsProject): ModDiscoveryProject => ({ id: `mts:${project.id}`, title: project.title, description: project.description, author: project.creator, image: project.image, metrics: project.metrics, category: modCategory(project.category), source: "Mod The Sims", route: { game: project.game === 2 ? "sims2" : project.game === 3 ? "sims3" : "sims4", project } });


export const modCategory = (value: string) => value.split(/&raquo;|[»›]/).at(-1)?.trim().replaceAll("&amp;", "&") ?? "";
