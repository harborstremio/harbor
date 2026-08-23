import type { TrackInfo } from "./bridge";

export type ExternalTrackMetadata = {
  url: string;
  release?: string;
  provider?: string;
  matchScore?: number;
  subId?: string;
};

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function parseMpvTrackList(
  list: Array<Record<string, unknown>>,
  secondarySid: string | null,
  externalByFilename: ReadonlyMap<string, ExternalTrackMetadata>,
): { audioTracks: TrackInfo[]; subtitleTracks: TrackInfo[] } {
  const audioTracks: TrackInfo[] = [];
  const subtitleTracks: TrackInfo[] = [];

  for (const track of list) {
    const type = String(track.type ?? "");
    if (type !== "audio" && type !== "sub") continue;
    const id = String(track.id ?? "");
    const lang = (track.lang ?? track.language) as string | undefined;
    const title = track.title as string | undefined;
    const codecDesc =
      (track["codec-desc"] as string | undefined) || (track.codec as string | undefined);
    const channels = track["demux-channels"] as string | undefined;
    const channelCount =
      typeof track["demux-channel-count"] === "number"
        ? (track["demux-channel-count"] as number)
        : undefined;
    const ffIndex = nonNegativeInteger(track["ff-index"]);
    const external = track.external === true;
    const externalFilename = track["external-filename"] as string | undefined;
    const forced = track.forced === true;
    const isDefault = track.default === true;
    const hearingImpaired = track["hearing-impaired"] === true;
    const mainSelection =
      typeof track["main-selection"] === "number" ? track["main-selection"] : null;
    const secondary =
      type === "sub" &&
      track.selected === true &&
      (mainSelection === 1 || (mainSelection == null && id === secondarySid));
    const selected = track.selected === true && !secondary;
    const codec = codecDesc ? codecDesc.toUpperCase() : undefined;
    const baseLabel = title || lang || `${type} ${id}`;
    const tags: string[] = [];
    if (codec) tags.push(codec);
    if (type === "audio" && channels) tags.push(channels);
    if (forced) tags.push("Forced");
    if (hearingImpaired) tags.push("SDH");
    if (external) tags.push("External");
    const label = tags.length > 0 ? `${baseLabel} · ${tags.join(" · ")}` : baseLabel;
    const externalMetadata =
      external && externalFilename ? externalByFilename.get(externalFilename) : undefined;
    const info: TrackInfo = {
      id,
      label,
      lang,
      kind: type === "audio" ? "audio" : "subtitle",
      selected,
      codec,
      channels,
      channelCount,
      ffIndex,
      title,
      external,
      externalFilename,
      forced,
      default: isDefault,
      hearingImpaired,
      secondary,
      url: external && externalFilename ? externalMetadata?.url : undefined,
      release: externalMetadata?.release,
      provider: externalMetadata?.provider,
      matchScore: externalMetadata?.matchScore,
      subId: externalMetadata?.subId,
    };
    if (type === "audio") audioTracks.push(info);
    else subtitleTracks.push(info);
  }

  return { audioTracks, subtitleTracks };
}
