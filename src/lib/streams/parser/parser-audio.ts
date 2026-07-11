import type { DefaultParserResult } from "parse-torrent-title";

import type { AudioCodec, AudioInfo } from "../types";

const AUDIO_CODEC_RX: Array<[RegExp, AudioCodec]> = [
  [/\bAtmos\b/i, "Atmos"],
  [/\bTrueHD\b/i, "TrueHD"],
  [/\bDTS-HD\.?MA\b|\bDTS\.?HD\.?MA\b/i, "DTS-HD MA"],
  [/\bDTS\b/i, "DTS"],
  [/\bDDP?5?\.?1\+?\b|\bE-?AC3\b|\bDD\+\b/i, "DD+"],
  [/\bAC3\b/i, "AC3"],
  [/\bAAC\b/i, "AAC"],
  [/\bFLAC\b/i, "FLAC"],
  [/\bOpus\b/i, "Opus"],
];

const CHANNELS_RX = /\b(7\.1|5\.1|6\.1|2\.1|2\.0)\b/;
const BIT_DEPTH_RX = /\b(8|10|12)\s*bit\b/i;

export function parseAudio(text: string, ptt: DefaultParserResult): AudioInfo {
  let codec: AudioCodec = "Other";
  for (const [rx, label] of AUDIO_CODEC_RX) {
    if (rx.test(text)) {
      codec = label;
      break;
    }
  }
  const channelsMatch = text.match(CHANNELS_RX);
  const channels = channelsMatch ? mapChannels(channelsMatch[1]) : (ptt.channels ?? 2);
  const bitDepthMatch = text.match(BIT_DEPTH_RX);
  const bitDepth = bitDepthMatch ? Number(bitDepthMatch[1]) : ptt.bitdepth;
  return { codec, channels, bitDepth };
}

function mapChannels(label: string): number {
  if (label === "7.1") return 8;
  if (label === "6.1") return 7;
  if (label === "5.1") return 6;
  if (label === "2.1") return 3;
  return 2;
}
