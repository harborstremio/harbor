import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Addon logo resolution + the bundled-logo match table, ported 1:1 from
/// `components/addon-logo.tsx`, plus the [AddonLogo] widget that renders them.

const _assetBase = 'assets/addon_logos';

// Name matchers, precompiled. Ids are matched with plain string ops (already
// lowercased); names use these case-insensitive patterns.
final _rxTorrentio = RegExp('torrentio', caseSensitive: false);
final _rxTorbox = RegExp(r'\btorbox\b', caseSensitive: false);
final _rxRealDebrid = RegExp('real.?debrid', caseSensitive: false);
final _rxAllDebrid = RegExp('all.?debrid', caseSensitive: false);
final _rxPremiumize = RegExp('premiumize', caseSensitive: false);
final _rxDebridLink = RegExp('debrid.?link', caseSensitive: false);
final _rxKnaben = RegExp('knaben', caseSensitive: false);
final _rxPirateBay = RegExp('pirate.?bay', caseSensitive: false);
final _rx1337Name = RegExp('1337x', caseSensitive: false);
final _rxYts = RegExp('^yts', caseSensitive: false);
final _rxEztv = RegExp('^eztv', caseSensitive: false);
final _rxBitsearch = RegExp('bitsearch', caseSensitive: false);
final _rxRutor = RegExp('rutor', caseSensitive: false);
final _rxNyaa = RegExp('nyaa', caseSensitive: false);
final _rxComet = RegExp(r'^comet\b', caseSensitive: false);
final _rxMediafusion = RegExp('mediafusion', caseSensitive: false);
final _rxAioStreams = RegExp('aio.?streams', caseSensitive: false);
final _rxOpenSubs = RegExp('opensubtitles', caseSensitive: false);
final _rxAnimeKitsu = RegExp('anime.?kitsu', caseSensitive: false);
final _rxStreamingCatalogs = RegExp('streaming.catalog', caseSensitive: false);
final _rxEasynews = RegExp('easy.?news', caseSensitive: false);
final _rxLocalFilesName = RegExp('^local files', caseSensitive: false);

// Id-only patterns.
final _rxRealDebridId = RegExp('real.?debrid', caseSensitive: false);
final _rxAllDebridId = RegExp('alldebrid', caseSensitive: false);
final _rxPremiumizeId = RegExp('premiumize', caseSensitive: false);
final _rxDebridLinkId = RegExp('debrid.?link', caseSensitive: false);
final _rxTorboxId = RegExp('torbox', caseSensitive: false);
final _rx1337Id = RegExp('1337');
final _rxLocalFilesId = RegExp('local.?files', caseSensitive: false);

typedef _Matcher = ({bool Function(String id, String name) test, String asset});

final List<_Matcher> _bundled = [
  (
    test: (id, n) => id.contains('torrentio') || _rxTorrentio.hasMatch(n),
    asset: 'torrentio.png',
  ),
  (
    test: (id, n) =>
        id == 'tb-library' ||
        id.startsWith('tb-') ||
        _rxTorboxId.hasMatch(id) ||
        _rxTorbox.hasMatch(n),
    asset: 'torbox.png',
  ),
  (
    test: (id, n) =>
        id == 'rd-library' ||
        id.startsWith('rd-') ||
        _rxRealDebridId.hasMatch(id) ||
        _rxRealDebrid.hasMatch(n),
    asset: 'realdebrid.png',
  ),
  (
    test: (id, n) =>
        id == 'ad-library' ||
        id.startsWith('ad-') ||
        _rxAllDebridId.hasMatch(id) ||
        _rxAllDebrid.hasMatch(n),
    asset: 'alldebrid.webp',
  ),
  (
    test: (id, n) =>
        id == 'pm-library' ||
        id.startsWith('pm-') ||
        _rxPremiumizeId.hasMatch(id) ||
        _rxPremiumize.hasMatch(n),
    asset: 'premiumize.png',
  ),
  (
    test: (id, n) =>
        id == 'dl-library' ||
        id.startsWith('dl-') ||
        _rxDebridLinkId.hasMatch(id) ||
        _rxDebridLink.hasMatch(n),
    asset: 'debridlink.png',
  ),
  (
    test: (id, n) => id == 'knaben' || _rxKnaben.hasMatch(n),
    asset: 'knaben.png',
  ),
  (
    test: (id, n) =>
        id == 'tpb' || id.contains('piratebay') || _rxPirateBay.hasMatch(n),
    asset: 'thepiratebay.png',
  ),
  (
    test: (id, n) =>
        id == 'x1337' || _rx1337Id.hasMatch(id) || _rx1337Name.hasMatch(n),
    asset: 'x1337.jpg',
  ),
  (test: (id, n) => id == 'yts' || _rxYts.hasMatch(n), asset: 'yts.png'),
  (test: (id, n) => id == 'eztv' || _rxEztv.hasMatch(n), asset: 'eztv.png'),
  (
    test: (id, n) => id == 'bitsearch' || _rxBitsearch.hasMatch(n),
    asset: 'bitsearch.png',
  ),
  (test: (id, n) => id == 'rutor' || _rxRutor.hasMatch(n), asset: 'rutor.png'),
  (test: (id, n) => id == 'nyaa' || _rxNyaa.hasMatch(n), asset: 'nyaa.png'),
  (
    test: (id, n) => id.contains('comet') || _rxComet.hasMatch(n),
    asset: 'comet.png',
  ),
  (
    test: (id, n) => id.contains('mediafusion') || _rxMediafusion.hasMatch(n),
    asset: 'mediafusion.png',
  ),
  (
    test: (id, n) => id.contains('aiostreams') || _rxAioStreams.hasMatch(n),
    asset: 'aiostreams.png',
  ),
  (
    test: (id, n) => id.contains('opensubtitles') || _rxOpenSubs.hasMatch(n),
    asset: 'opensubtitles.png',
  ),
  (
    test: (id, n) => id.contains('anime-kitsu') || _rxAnimeKitsu.hasMatch(n),
    asset: 'anime-kitsu.png',
  ),
  (
    test: (id, n) =>
        id.contains('streaming-catalogs') || _rxStreamingCatalogs.hasMatch(n),
    asset: 'streaming-catalogs.png',
  ),
  (
    test: (id, n) => id.contains('easynews') || _rxEasynews.hasMatch(n),
    asset: 'easynews.png',
  ),
  (
    test: (id, n) =>
        id == 'org.stremio.local' ||
        _rxLocalFilesName.hasMatch(n) ||
        _rxLocalFilesId.hasMatch(id),
    asset: 'local-files.png',
  ),
];

/// The bundled logo asset path for an addon, or null when none matches. Ported
/// from `addonLogoSrc`.
String? addonLogoAsset(String addonId, String addonName) {
  final id = addonId.toLowerCase();
  for (final entry in _bundled) {
    if (entry.test(id, addonName)) return '$_assetBase/${entry.asset}';
  }
  return null;
}

/// Resolves a manifest logo into a usable URL, ported from `resolveAddonLogo`:
/// absolute (`http`/`data`/`blob`) URLs pass through; a relative logo resolves
/// against the transportUrl; anything unresolvable returns null.
String? resolveAddonLogo(String? logo, String? transportUrl) {
  if (logo == null) return null;
  final trimmed = logo.trim();
  if (trimmed.isEmpty) return null;
  if (RegExp(
    '^(https?:|data:|blob:)',
    caseSensitive: false,
  ).hasMatch(trimmed)) {
    return trimmed;
  }
  if (transportUrl == null || transportUrl.isEmpty) return null;
  try {
    return Uri.parse(transportUrl).resolve(trimmed).toString();
  } catch (_) {
    return null;
  }
}

/// The eight monogram gradient pairs, ported from `PALETTE`.
const List<(Color, Color)> addonLogoPalette = [
  (Color(0xFFF97373), Color(0xFFB53B3B)),
  (Color(0xFF7EB6FF), Color(0xFF3A6FB8)),
  (Color(0xFF9D7AF6), Color(0xFF5D3EC1)),
  (Color(0xFF5AD6A4), Color(0xFF2C8C66)),
  (Color(0xFFF4B85A), Color(0xFFA76F1F)),
  (Color(0xFFEC78C9), Color(0xFFA83A8A)),
  (Color(0xFF5AD0D6), Color(0xFF1F7A85)),
  (Color(0xFFC0C8D4), Color(0xFF5E6677)),
];

/// The gradient pair for a monogram fallback, ported from `paletteFor`.
(Color, Color) paletteFor(String seed) {
  var h = 0;
  for (final c in seed.codeUnits) {
    h = (h * 31 + c) & 0xFFFFFFFF;
  }
  return addonLogoPalette[h % addonLogoPalette.length];
}

/// The available logo sizes, ported from the `AddonLogoSize` union.
enum AddonLogoSize { xs, sm, md, lg, xl, tile, xxl, xxxl, xxxxl }

/// The pixel size for each [AddonLogoSize], ported from `SIZES`.
double addonLogoPx(AddonLogoSize size) => switch (size) {
  AddonLogoSize.xs => 14,
  AddonLogoSize.sm => 18,
  AddonLogoSize.md => 22,
  AddonLogoSize.lg => 28,
  AddonLogoSize.xl => 36,
  AddonLogoSize.tile => 56,
  AddonLogoSize.xxl => 96,
  AddonLogoSize.xxxl => 156,
  AddonLogoSize.xxxxl => 220,
};

/// The corner radius for a logo of [px] pixels, ported from `radiusFor`.
double addonLogoRadius(double px) {
  final r = (px * 0.22).round();
  return (r < 4 ? 4 : r).toDouble();
}

bool _preferBundled(String id, String name) =>
    '$id $name'.toLowerCase().contains('mediafusion');

/// An addon's logo: the bundled asset or manifest logo, falling back to a
/// hashed-gradient monogram of the addon's initial. Ported 1:1 from `AddonLogo`.
class AddonLogo extends StatelessWidget {
  const AddonLogo({
    super.key,
    required this.addonId,
    required this.addonName,
    this.manifestLogo,
    this.size = AddonLogoSize.sm,
  });

  final String addonId;
  final String addonName;

  /// A resolved manifest logo URL (see [resolveAddonLogo]), or null.
  final String? manifestLogo;
  final AddonLogoSize size;

  @override
  Widget build(BuildContext context) {
    final px = addonLogoPx(size);
    final radius = addonLogoRadius(px);
    final bundled = addonLogoAsset(addonId, addonName);
    final preferBundled = _preferBundled(addonId, addonName) && bundled != null;
    final logo = (manifestLogo != null && manifestLogo!.trim().isNotEmpty)
        ? manifestLogo
        : null;
    final primary = preferBundled ? bundled : (logo ?? bundled);
    final fallback = preferBundled
        ? null
        : (logo != null && bundled != null ? bundled : null);

    Widget frame(Widget child) => Container(
      width: px,
      height: px,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        color: const Color(0x0FFFFFFF),
        border: Border.all(color: const Color(0x14FFFFFF)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: child,
    );

    if (primary == null) return frame(_monogram(px));
    return frame(
      _image(
        primary,
        px,
        () => fallback != null
            ? _image(fallback, px, () => _monogram(px))
            : _monogram(px),
      ),
    );
  }

  Widget _image(String src, double px, Widget Function() onError) {
    if (src.startsWith('assets/')) {
      return Image.asset(
        src,
        width: px,
        height: px,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => onError(),
      );
    }
    return CachedNetworkImage(
      imageUrl: src,
      width: px,
      height: px,
      fit: BoxFit.cover,
      errorWidget: (_, _, _) => onError(),
      placeholder: (_, _) => const SizedBox.shrink(),
    );
  }

  Widget _monogram(double px) {
    final (from, to) = paletteFor(
      addonId.isNotEmpty ? addonId : (addonName.isNotEmpty ? addonName : '?'),
    );
    final trimmed = addonName.trim();
    final initial = trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
    return Container(
      width: px,
      height: px,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [from, to],
        ),
      ),
      child: Text(
        initial,
        style: TextStyle(
          color: const Color(0xF2FFFFFF),
          fontSize: px * 0.5,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}
