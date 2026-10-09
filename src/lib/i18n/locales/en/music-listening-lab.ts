const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Listening profiles",
  "music.lab.profilesHelp":
    "Save a correction for each pair of headphones or speakers. Loading edits the draft; output routing and volume ceiling stay as they are. Apply to listen.",
  "music.lab.profileName": "Profile name",
  "music.lab.saveProfile": "Save draft as profile",
  "music.lab.selectProfile": "Select a profile",
  "music.lab.loadProfile": "Load into draft",
  "music.lab.delete": "Delete",
  "music.lab.response": "Calculated equalizer response",
  "music.lab.curveHelp":
    "EQ response at {rate} kHz, before preamp. Solid: draft. Dashed: applied settings. This is a calculation, not a device measurement.",
  "music.lab.strength": "Correction strength",
  "music.lab.strengthHelp":
    "Scales peak and shelf gains. Pass and notch filters keep their shape; 0% bypasses all parametric filters.",
  "music.lab.filter": "Filter",
  "music.lab.enabled": "On",
  "music.lab.peak": "Peak",
  "music.lab.lowShelf": "Low shelf",
  "music.lab.highShelf": "High shelf",
  "music.lab.lowPass": "Low pass",
  "music.lab.highPass": "High pass",
  "music.lab.notch": "Notch",
  "music.lab.addFilter": "Add filter",
  "music.lab.headroomHelp":
    "Automatic headroom: {db} dB. Estimates combined filter peaks, with a 0.5 dB reserve. Positive manual preamp can use up that reserve.",
  "music.lab.importExport": "Import / export correction",
  "music.lab.importHelp":
    "Paste Equalizer APO / AutoEQ filter text. Supports PK, LSC, HSC, LP, HP and NO with Q. Import uses the file’s preamp and turns automatic headroom off to avoid double attenuation. Export writes the current strength and headroom into the text below.",
  "music.lab.correctionText": "Correction text",
  "music.lab.import": "Import into draft",
  "music.lab.export": "Write export text",
  "music.lab.importError":
    "Unsupported or invalid correction. Use 1–24 filters, 20–20,000 Hz, ±18 dB and Q 0.1–12. Other processing commands are not supported.",
  "music.lab.preamp": "Preamp · dB",
  "music.lab.crossfeed": "Headphone crossfeed",
  "music.lab.crossfeedHelp":
    "Blends a filtered part of each stereo channel into the other for a less separated headphone image. 0% is off.",
  "music.lab.bypass": "Bypass Harbor DSP",
  "music.lab.bypassHelp":
    "Bypasses EQ, preamp, crossfeed, balance and ReplayGain after Apply. Output settings and playback volume remain active. This does not verify bit-perfect playback.",
  "music.lab.exclusive": "Request exclusive output",
  "music.lab.exclusiveHelp":
    "Supported outputs can bypass the system mixer and may block other apps. Driver support varies; this switch is a request, not confirmation of exclusive access.",
  "music.lab.sampleRate": "Output sample rate",
  "music.lab.sourceRate": "Follow source",
  "music.lab.rateHelp":
    "Follow source avoids requesting a fixed rate. The output device may negotiate another rate. A fixed rate resamples when needed; it cannot restore detail lost in compression.",
  "music.lab.equalizer": "Equalizer",
  "music.lab.mode": "Equalizer mode",
  "music.lab.parametric": "Parametric · up to 24 filters",
};
export default musicListeningLab;
