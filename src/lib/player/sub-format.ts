type SubtitleFormatTrack = {
  codec?: string;
  title?: string;
  label?: string;
};

export function isAssTrack(track: SubtitleFormatTrack | null | undefined): boolean {
  if (!track) return false;
  const codec = `${track.codec ?? ""} ${track.title ?? ""} ${track.label ?? ""}`.toUpperCase();
  if (
    codec.includes("ASS") ||
    codec.includes("SSA") ||
    codec.includes("SUBSTATION") ||
    codec.includes("SUB STATION")
  ) {
    return true;
  }
  return /\.(ass|ssa)\b/i.test(`${track.title ?? ""} ${track.label ?? ""}`);
}

export function isImageSubTrack(track: SubtitleFormatTrack | null | undefined): boolean {
  if (!track) return false;
  const codec = `${track.codec ?? ""} ${track.title ?? ""} ${track.label ?? ""}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return (
    codec.includes("PGS") ||
    codec.includes("HDMV") ||
    codec.includes("DVDSUB") ||
    codec.includes("DVDSUBTITLE") ||
    codec.includes("DVB") ||
    codec.includes("VOBSUB") ||
    codec.includes("XSUB")
  );
}
