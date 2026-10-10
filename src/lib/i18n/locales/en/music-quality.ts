const musicQuality: Record<string, string> = {
  "music.quality.title": "Signal details",
  "music.quality.lossy": "Lossy",
  "music.quality.lossless": "Lossless",
  "music.quality.hiRes": "Hi-Res lossless",
  "music.quality.unverified": "Unverified",
  "music.quality.lossyHelp": "Compressed audio. Codec and bitrate describe the current stream.",
  "music.quality.losslessHelp":
    "A lossless codec is verified. This does not establish the quality of the original master.",
  "music.quality.hiResHelp":
    "Lossless, at least 24-bit and above 48 kHz. Higher resolution does not guarantee a better master.",
  "music.quality.unverifiedHelp": "Available metadata does not establish source fidelity.",
  "music.quality.source": "Source",
  "music.quality.codec": "Codec / format",
  "music.quality.sourceDepth": "Source bit depth",
  "music.quality.decodedRate": "Decoded sample rate",
  "music.quality.bitrate": "Bitrate",
  "music.quality.bits": "{depth}-bit",
  "music.quality.output": "Output",
  "music.quality.selectedOutput": "Selected output",
  "music.quality.outputRate": "Engine output rate",
  "music.quality.outputHelp":
    "The system or DAC may resample. Output settings do not change source fidelity.",
  "music.quality.on": "On",
  "music.quality.levels": "Signal levels",
  "music.quality.unavailable": "Unavailable",
  "music.quality.channel": "Channel {number}",
  "music.quality.inactive": "Inactive",
  "music.quality.meterHelp":
    "After processing, before player volume. Bars show RMS; ticks show sample peaks.",
};
export default musicQuality;
