import 'parsed_stream.dart';
import 'parser/stream_enums.dart';
import 'scoring/scored_stream.dart';
import 'source_confirmation.dart';

/// The quality/source/HDR/audio artwork badges a stream can carry, ported 1:1
/// from `BadgeKind` in `src/components/format-badge.tsx`. Each kind maps to a
/// real badge image bundled at `assets/badges/<asset>.webp`; [alt] is its
/// accessibility label, matching the web `ALT` table.
enum BadgeKind {
  res8k('8k', '8K'),
  uhd4k('4k_uhd', '4K UHD'),
  uhd('uhd', 'UHD'),
  qhd2k('2k_qhd', '2K QHD'),
  p1080('1080p', '1080p Full HD'),
  i1080('1080i', '1080i'),
  p720('720p', '720p HD'),
  p576('576p', '576p PAL'),
  p480('480p', '480p'),
  p360('360p', '360p / 240p'),
  hd('hd', 'HD'),
  sd('sd', 'Standard Definition'),
  dvd('dvd', 'DVD'),
  threeD('3d', '3D'),
  imax('imax', 'IMAX'),
  bluray('bluray', 'Blu-ray'),
  remux('remux', 'REMUX'),
  webdl('webdl', 'WEB-DL'),
  webrip('webrip', 'WEBRip'),
  hdtv('hdtv', 'HDTV'),
  dvb('dvb', 'DVB'),
  hevc('hevc', 'HEVC / x265'),
  av1('av1', 'AV1'),
  hdr('hdr', 'HDR'),
  hdr10('hdr10', 'HDR10'),
  hdr10Plus('hdr10_plus', 'HDR10+'),
  dv('dv', 'Dolby Vision'),
  hlg('hlg', 'HLG'),
  sdr('sdr', 'SDR'),
  atmos('atmos', 'Dolby Atmos'),
  atmos912('atmos_912', 'Dolby Atmos 9.1.2'),
  trueHd('truehd', 'Dolby TrueHD'),
  dtsHd('dts_hd', 'DTS-HD'),
  dtsHdMa('dts_hd_ma', 'DTS-HD MA'),
  dtsX('dts_x', 'DTS:X'),
  dts('dts', 'DTS'),
  dd('dd', 'Dolby Digital'),
  ddp('ddp', 'Dolby Digital Plus'),
  ac3('ac3', 'AC3'),
  eac3('eac3', 'EAC3'),
  aac('aac', 'AAC'),
  flac('flac', 'FLAC'),
  mp3('mp3', 'MP3'),
  opus('opus', 'Opus'),
  pcm('pcm', 'PCM'),
  lpcm('lpcm', 'LPCM'),
  stereo('stereo', 'Stereo'),
  mono('mono', 'Mono'),
  ch51('5_1', '5.1'),
  ch71('7_1', '7.1'),
  cam('cam', 'Cam'),
  hdcam('hdcam', 'HD Cam'),
  telesync('telesync', 'Telesync'),
  hdts('hdts', 'HD Telesync'),
  telecine('telecine', 'Telecine'),
  scr('scr', 'Screener'),
  wp('wp', 'Workprint'),
  extended('extended', 'Extended Cut'),
  remastered('remastered', 'Remastered'),
  repack('repack', 'Repack'),
  noLabel('no_label', 'No quality label'),
  unknown('unknown', 'Quality unverified');

  const BadgeKind(this.asset, this.alt);

  /// The bundled image basename: `assets/badges/<asset>.webp`.
  final String asset;

  /// Accessibility / tooltip label.
  final String alt;

  /// The explanatory note shown for low-confidence or theater-capture kinds,
  /// or null for a self-explanatory quality badge.
  BadgeNote? get note => _badgeNotes[this];
}

/// A warning/info note attached to a badge, mirroring the web `QUALITY_NOTES`
/// tooltips — shown so a viewer knows a "1080p" cam isn't what it claims.
class BadgeNote {
  const BadgeNote(this.title, this.body, this.tone);
  final String title;
  final String body;
  final BadgeNoteTone tone;
}

enum BadgeNoteTone { warn, info }

const Map<BadgeKind, BadgeNote> _badgeNotes = {
  BadgeKind.cam: BadgeNote(
    'Camcorder rip',
    "Filmed in a theater with a handheld camera. Picture is shaky, faces look "
        "soft, you'll hear the crowd. Watch only if you can't wait. Quality is "
        'rough.',
    BadgeNoteTone.warn,
  ),
  BadgeKind.telesync: BadgeNote(
    'Telesync rip',
    'Cam-quality picture with audio plugged into the projector or a separate '
        'recorder. Sound is clean, but the image is still a theater capture. '
        'Better than CAM, far below a real release.',
    BadgeNoteTone.warn,
  ),
  BadgeKind.telecine: BadgeNote(
    'Telecine',
    'Captured directly from a film reel via a telecine machine. Picture is '
        'solid but colors can drift, and these are rare. Treat it as a stand-in '
        'until the official release lands.',
    BadgeNoteTone.info,
  ),
  BadgeKind.noLabel: BadgeNote(
    'No quality label',
    "The addon didn't tell us anything about this file's resolution or source. "
        'It could be anything from 4K Blu-ray to a phone capture. Pick a labeled '
        'stream if one exists.',
    BadgeNoteTone.warn,
  ),
  BadgeKind.unknown: BadgeNote(
    'Quality unverified',
    'The label looks high (1080p / 4K) but doesn\'t match expected file size or '
        'release window. Often a CAM or TS rebadged. Try a Theater Capture '
        'stream or check the source list before committing.',
    BadgeNoteTone.warn,
  ),
};

/// The resolution badge for [p], or null when the resolution is unknown.
/// A 480p/SD DVDRip surfaces as the DVD badge (from `resolutionBadge`).
BadgeKind? resolutionBadge(ParsedStream p) {
  switch (p.resolution) {
    case StreamResolution.uhd:
      return BadgeKind.uhd4k;
    case StreamResolution.p1080:
      return BadgeKind.p1080;
    case StreamResolution.p720:
      return BadgeKind.p720;
    case StreamResolution.p480:
      return p.source == StreamSource.dvdRip ? BadgeKind.dvd : BadgeKind.p480;
    case StreamResolution.sd:
      return p.source == StreamSource.dvdRip ? BadgeKind.dvd : BadgeKind.sd;
  }
}

/// How much to trust the stream's own quality claims, from `qualityConfidence`.
enum QualityConfidence { labeled, unverified, unlabeled }

/// Ported 1:1 from `qualityConfidence`: an SD/Other/Other stream with no HDR or
/// audio detected is `unlabeled`; a fresh-fake / size-mismatch scoring flag, or
/// a high-res claim with no size and no direct URL, is `unverified`; otherwise
/// the label is trusted. [reasons] are the stream's scoring reasons (empty for
/// an unscored [ParsedStream]).
QualityConfidence qualityConfidence(
  ParsedStream s, {
  List<ScoreReason> reasons = const [],
}) {
  final nothingDetected =
      s.resolution == StreamResolution.sd &&
      s.source == StreamSource.other &&
      s.codec == VideoCodec.other &&
      s.hdrFormat == null &&
      s.audio.codec == AudioCodec.other;
  if (nothingDetected) return QualityConfidence.unlabeled;
  final flagged = reasons.any(
    (r) =>
        r.signal.startsWith('fresh-fake-') ||
        r.signal == 'fresh-soft-flag' ||
        r.signal == 'fresh-prerelease-soft' ||
        r.signal == 'fresh-prebluray-suspect' ||
        r.signal == 'size-mismatch' ||
        r.signal == 'title-says-hires-filename-says-cam',
  );
  if (flagged) return QualityConfidence.unverified;
  final claimsHighRes =
      s.resolution == StreamResolution.uhd ||
      s.resolution == StreamResolution.p1080;
  final directStream = s.url != null && s.infoHash == null;
  if (claimsHighRes &&
      s.size == null &&
      s.source == StreamSource.other &&
      !directStream) {
    return QualityConfidence.unverified;
  }
  return QualityConfidence.labeled;
}

/// The HDR badge for [p], or null (from `hdrBadge`).
BadgeKind? hdrBadge(ParsedStream p) {
  final f = p.hdrFormat;
  if (f == null) return null;
  switch (f) {
    case HdrFormat.dv:
    case HdrFormat.dvHdr10:
      return BadgeKind.dv;
    case HdrFormat.hdr10Plus:
      return BadgeKind.hdr10Plus;
    case HdrFormat.hdr10:
      return BadgeKind.hdr10;
    case HdrFormat.hlg:
      return BadgeKind.hlg;
  }
}

/// The audio badge for [p], or null (from `audioBadge`). A single-channel track
/// with no recognised codec surfaces as the Mono badge.
BadgeKind? audioBadge(ParsedStream p) {
  switch (p.audio.codec) {
    case AudioCodec.atmos:
      return BadgeKind.atmos;
    case AudioCodec.trueHd:
      return BadgeKind.trueHd;
    case AudioCodec.dtsHdMa:
      return BadgeKind.dtsHd;
    case AudioCodec.dts:
      return BadgeKind.dts;
    case AudioCodec.ddPlus:
      return BadgeKind.ddp;
    case AudioCodec.flac:
      return BadgeKind.flac;
    case AudioCodec.aac:
      return BadgeKind.aac;
    case AudioCodec.ac3:
    case AudioCodec.opus:
    case AudioCodec.other:
      return p.audio.channels == 1 ? BadgeKind.mono : null;
  }
}

/// The theater-capture source badge for [p], or null (from `sourceBadge`).
BadgeKind? sourceBadge(ParsedStream p) {
  switch (p.source) {
    case StreamSource.cam:
      return BadgeKind.cam;
    case StreamSource.ts:
    case StreamSource.hdts:
      return BadgeKind.telesync;
    case StreamSource.tc:
      return BadgeKind.telecine;
    default:
      return null;
  }
}

/// The release-source badge for [p], or null (from `releaseSourceBadge`).
BadgeKind? releaseSourceBadge(ParsedStream p) {
  if (p.remux) return BadgeKind.remux;
  switch (p.source) {
    case StreamSource.bluRay:
    case StreamSource.bdRip:
      return BadgeKind.bluray;
    case StreamSource.webDl:
    case StreamSource.webRip:
    case StreamSource.hdRip:
      return BadgeKind.webdl;
    case StreamSource.hdtv:
      return BadgeKind.hdtv;
    default:
      return null;
  }
}

/// The video-codec badge for [p], or null (from `codecBadge`).
BadgeKind? codecBadge(ParsedStream p) {
  if (p.codec == VideoCodec.hevc) return BadgeKind.hevc;
  if (p.codec == VideoCodec.av1) return BadgeKind.av1;
  return null;
}

/// The ordered set of artwork badges for a stream, ported 1:1 from
/// `streamBadges`: a theater-capture source (or a no-label / unverified
/// confidence marker) leads, else the resolution; then release source, codec,
/// HDR, and audio. [reasons] feed [qualityConfidence]; pass `stream.reasons`
/// for a scored stream, or omit for a bare [ParsedStream].
List<BadgeKind> streamBadges(
  ParsedStream s, {
  List<ScoreReason> reasons = const [],
}) {
  final out = <BadgeKind>[];
  final src = sourceBadge(s);
  final confidence = qualityConfidence(s, reasons: reasons);
  if (src != null) {
    out.add(src);
  } else if (confidence == QualityConfidence.unlabeled) {
    out.add(BadgeKind.noLabel);
  } else if (confidence == QualityConfidence.unverified) {
    out.add(BadgeKind.unknown);
  } else {
    final r = resolutionBadge(s);
    if (r != null) out.add(r);
  }
  final release = releaseSourceBadge(s);
  if (release != null && src == null) out.add(release);
  final c = codecBadge(s);
  if (c != null) out.add(c);
  final h = hdrBadge(s);
  if (h != null) out.add(h);
  final a = audioBadge(s);
  if (a != null) out.add(a);
  return out;
}

/// The friendly quality label shown on a tier button in the condensed
/// "Switch quality" strip — e.g. "Ultra HD · Dolby Vision", "Full HD",
/// "Theater Capture". A rough capture names its kind; a stream Harbor can't
/// trust reads "No Label" / "Unverified". Ported 1:1 from web `streamLeadLabel`.
String streamLeadLabel(ScoredStream s, StreamTier tier) {
  final p = s.parsed;
  if (isRoughSource(p.source)) {
    switch (p.source) {
      case StreamSource.cam:
        return 'Cam Recording';
      case StreamSource.ts:
      case StreamSource.hdts:
        return 'Telesync';
      case StreamSource.tc:
        return 'Telecine';
      case StreamSource.scr:
        return 'Screener';
      default:
        break;
    }
  }
  switch (qualityConfidence(p, reasons: s.reasons)) {
    case QualityConfidence.unlabeled:
      return 'No Label';
    case QualityConfidence.unverified:
      return 'Unverified';
    case QualityConfidence.labeled:
      break;
  }
  return tierDisplayName(tier);
}

/// The friendly, human-readable name of a quality [tier] on its own (no
/// stream-specific rough/confidence overrides) — for drawer group headers and
/// anywhere a tier is named. Ports the tier arm of web `streamLeadLabel`.
String tierDisplayName(StreamTier tier) {
  switch (tier) {
    case StreamTier.uhdDv:
      return 'Ultra HD · Dolby Vision';
    case StreamTier.uhdHdr:
      return 'Ultra HD · HDR';
    case StreamTier.uhd:
      return 'Ultra HD';
    case StreamTier.hdrHdr:
      return 'Full HD · HDR';
    case StreamTier.p1080:
      return 'Full HD';
    case StreamTier.p720:
      return 'HD';
    case StreamTier.sd:
      return 'Standard Def';
    case StreamTier.rough:
      return 'Theater Capture';
  }
}

/// The lead resolution/capture [FormatBadge] shown on a tier button in the
/// condensed "Switch quality" strip. Ported 1:1 from web `streamLeadBadge`.
BadgeKind streamLeadBadge(ScoredStream s, StreamTier tier) {
  final p = s.parsed;
  if (p.source == StreamSource.cam) return BadgeKind.cam;
  if (p.source == StreamSource.ts || p.source == StreamSource.hdts) {
    return BadgeKind.telesync;
  }
  if (p.source == StreamSource.tc) return BadgeKind.telecine;
  switch (qualityConfidence(p, reasons: s.reasons)) {
    case QualityConfidence.unlabeled:
      return BadgeKind.noLabel;
    case QualityConfidence.unverified:
      return BadgeKind.unknown;
    case QualityConfidence.labeled:
      break;
  }
  switch (tier) {
    case StreamTier.uhdDv:
    case StreamTier.uhdHdr:
    case StreamTier.uhd:
      return BadgeKind.uhd4k;
    case StreamTier.hdrHdr:
    case StreamTier.p1080:
      return BadgeKind.p1080;
    case StreamTier.p720:
      return BadgeKind.p720;
    case StreamTier.sd:
      return BadgeKind.sd;
    case StreamTier.rough:
      return BadgeKind.telesync;
  }
}
