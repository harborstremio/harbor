/// The closed enums describing a parsed stream's technical attributes, mirroring
/// the string unions in `src/lib/streams/types.ts`. Each carries its canonical
/// display [label].
library;

enum StreamResolution {
  uhd('4K'),
  p1080('1080p'),
  p720('720p'),
  p480('480p'),
  sd('SD');

  const StreamResolution(this.label);
  final String label;
}

enum HdrFormat {
  hdr10('HDR10'),
  hdr10Plus('HDR10+'),
  dv('DV'),
  dvHdr10('DV+HDR10'),
  hlg('HLG');

  const HdrFormat(this.label);
  final String label;
}

enum VideoCodec {
  hevc('HEVC'),
  avc('AVC'),
  av1('AV1'),
  vp9('VP9'),
  mpeg2('MPEG2'),
  other('Other');

  const VideoCodec(this.label);
  final String label;
}

enum AudioCodec {
  atmos('Atmos'),
  trueHd('TrueHD'),
  dtsHdMa('DTS-HD MA'),
  dts('DTS'),
  ddPlus('DD+'),
  ac3('AC3'),
  aac('AAC'),
  opus('Opus'),
  flac('FLAC'),
  other('Other');

  const AudioCodec(this.label);
  final String label;
}

enum StreamSource {
  bluRay('BluRay'),
  remux('REMUX'),
  webDl('WEB-DL'),
  webRip('WEBRip'),
  bdRip('BDRip'),
  hdRip('HDRip'),
  dvdRip('DVDRip'),
  hdtv('HDTV'),
  cam('CAM'),
  ts('TS'),
  hdts('HDTS'),
  tc('TC'),
  scr('SCR'),
  other('Other');

  const StreamSource(this.label);
  final String label;
}

enum StreamTier {
  uhdDv('4K_DV'),
  uhdHdr('4K_HDR'),
  uhd('4K'),
  hdrHdr('1080p_HDR'),
  p1080('1080p'),
  p720('720p'),
  sd('SD'),
  rough('ROUGH');

  const StreamTier(this.label);
  final String label;
}

/// A supported debrid provider: Real-Debrid, TorBox, AllDebrid, Premiumize,
/// Debrid-Link.
enum DebridSlug {
  rd('rd'),
  tb('tb'),
  ad('ad'),
  pm('pm'),
  dl('dl');

  const DebridSlug(this.label);
  final String label;
}

enum StreamContainer {
  mkv('mkv'),
  mp4('mp4'),
  m4v('m4v'),
  avi('avi'),
  webm('webm'),
  mov('mov'),
  ts('ts'),
  wmv('wmv');

  const StreamContainer(this.label);
  final String label;
}

/// Parsed audio-track info: codec, channel count, optional bit depth.
class AudioInfo {
  const AudioInfo({required this.codec, required this.channels, this.bitDepth});

  final AudioCodec codec;
  final int channels;
  final int? bitDepth;
}
