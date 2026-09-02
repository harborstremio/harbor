type LiveSrc = {
  meta: { id?: string; type?: string };
  isLive?: boolean;
};

export function isLivePlaybackSrc(src: LiveSrc): boolean {
  if (src.isLive === true) return true;
  if (src.meta.id?.startsWith("iptv:") === true) return true;
  const type = src.meta.type ? String(src.meta.type).toLowerCase() : "";
  return type === "tv" || type === "channel";
}
