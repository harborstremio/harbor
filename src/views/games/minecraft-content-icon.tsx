import type { MinecraftContent } from '@/lib/games/minecraft-catalog';

/** Small voxel silhouettes drawn on the same 24px grid as Harbor's game marks. */
export function MinecraftContentIcon({kind,size=20}:{kind:MinecraftContent;size?:number}) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {kind==='modpack'?<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z M4 7.5l8 4.5 8-4.5 M12 12v9 M8 5.3l8 4.5v4.5"/><path d="m8 14 1.5.8"/></>:kind==='mod'?<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z M4 7.5l8 4.5 8-4.5 M12 12v9"/><path d="M15 14.5h3 M16.5 13v3 M7 12v3"/></>:kind==='resourcepack'?<><path d="M5 3.5h10l4 4V21H5Z M15 3.5V8h4"/><path d="M8 11h3v3H8z M13 16h3v3h-3z" fill="currentColor" stroke="none"/><path d="M13 11h3v3h-3z M8 16h3v3H8z"/></>:<><path d="M3 15h18 M5 18h14 M8 21h8 M7 12a5 5 0 0 1 10 0 M12 2v2 M4.5 5.5 6 7 M19.5 5.5 18 7 M2 11h2 M20 11h2"/></>}
 </svg>;
}
