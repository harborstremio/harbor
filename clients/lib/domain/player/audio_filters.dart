/// The mpv `af` (audio filter) chains for the audio-shaping profiles, ported
/// verbatim from `player/mpv.ts` (`AUDIO_PROFILE_AF`). `off`/`flat` and any
/// unknown profile map to no filter.
const _profileAf = <String, String>{
  'bass': 'lavfi=[bass=g=7:f=110:w=0.6]',
  'voice': 'lavfi=[equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=5]',
  'bass-reduce': 'lavfi=[bass=g=-8:f=110:w=0.6]',
  'night':
      'lavfi=[acompressor=ratio=3:threshold=-20dB:attack=20:release=300:'
      'makeup=4dB]',
};

/// The audio-filter string for a shaping [profile], or null when the profile
/// applies no filter.
String? audioProfileAf(String profile) => _profileAf[profile];

/// The combined mpv `af` chain for the current normalizer + profile — a port of
/// mpv.ts `applyAudioFilters`: the loudness normalizer first, then the profile
/// filter, joined with commas. Empty when neither is active.
String compileAudioFilters({required bool normalize, required String profile}) {
  final parts = <String>[
    if (normalize) 'dynaudnorm=f=500:g=31:p=0.9:m=4',
    ?audioProfileAf(profile),
  ];
  return parts.join(',');
}
