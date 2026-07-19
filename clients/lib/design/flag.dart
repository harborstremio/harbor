import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'tokens.dart';

/// The size presets for [Flag], ported from the web `FlagSize`.
enum FlagSize { sm, md, lg }

double _flagHeight(FlagSize s) => switch (s) {
  FlagSize.sm => 12,
  FlagSize.md => 16,
  FlagSize.lg => 22,
};

double _labelSize(FlagSize s) => switch (s) {
  FlagSize.sm => 11,
  FlagSize.md => 13,
  FlagSize.lg => 15,
};

/// Language display name → flag SVG asset, ported 1:1 from the web `FLAG` map.
/// Some names deliberately share a flag (Latin-American Spanish, Brazilian
/// Portuguese).
const Map<String, String> _flagAssets = {
  'English': 'assets/flags/flag-eng.svg',
  'Italian': 'assets/flags/flag-ita.svg',
  'Russian': 'assets/flags/flag-rus.svg',
  'Hindi': 'assets/flags/flag-hin.svg',
  'Spanish': 'assets/flags/flag-spa.svg',
  'Spanish (Latin America)': 'assets/flags/flag-spa.svg',
  'Korean': 'assets/flags/flag-kor.svg',
  'Japanese': 'assets/flags/flag-jpn.svg',
  'Chinese': 'assets/flags/flag-zho.svg',
  'Portuguese': 'assets/flags/flag-prt.svg',
  'Portuguese (Brazil)': 'assets/flags/flag-bra.svg',
  'German': 'assets/flags/flag-deu.svg',
  'French': 'assets/flags/flag-fra.svg',
  'Turkish': 'assets/flags/flag-tur.svg',
  'Arabic': 'assets/flags/flag-ara.svg',
  'Czech': 'assets/flags/flag-ces.svg',
  'Danish': 'assets/flags/flag-dan.svg',
  'Finnish': 'assets/flags/flag-fin.svg',
  'Hebrew': 'assets/flags/flag-heb.svg',
  'Hungarian': 'assets/flags/flag-hun.svg',
  'Dutch': 'assets/flags/flag-nld.svg',
  'Norwegian': 'assets/flags/flag-nor.svg',
  'Polish': 'assets/flags/flag-pol.svg',
  'Romanian': 'assets/flags/flag-ron.svg',
  'Swedish': 'assets/flags/flag-swe.svg',
  'Thai': 'assets/flags/flag-tha.svg',
  'Ukrainian': 'assets/flags/flag-ukr.svg',
  'Vietnamese': 'assets/flags/flag-vie.svg',
};

/// The flag SVG asset for [language]'s display name, or null when there is none.
/// Ports the web `flagSrc`.
String? flagAsset(String language) => _flagAssets[language];

/// Whether [language]'s display name has a flag. Ports the web `languageHasFlag`.
bool languageHasFlag(String language) => _flagAssets.containsKey(language);

/// A language flag: the country/language flag image plus an optional label.
/// "Multi" renders as an accent chip; a language without a flag falls back to
/// its uppercased name (or nothing when [showLabel] is false). Ports the web
/// `Flag`.
class Flag extends StatelessWidget {
  const Flag({
    super.key,
    required this.language,
    required this.tokens,
    this.size = FlagSize.md,
    this.showLabel = true,
  });

  final String language;
  final HarborTokens tokens;
  final FlagSize size;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (language == 'Multi') {
      return _MultiChip(tokens: t, height: _flagHeight(size) + 4);
    }
    final asset = _flagAssets[language];
    final h = _flagHeight(size);
    if (asset == null) {
      if (!showLabel) return const SizedBox.shrink();
      return Text(
        language.toUpperCase(),
        style: TextStyle(
          color: t.inkSubtle,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.6,
        ),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _FlagImage(asset: asset, height: h, tokens: t),
        if (showLabel) ...[
          const SizedBox(width: 6),
          Text(
            language,
            style: TextStyle(
              color: t.inkMuted,
              fontSize: _labelSize(size),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

/// A compact row of flags for a set of languages, capped at [max] with a
/// trailing "+N". Ports the web `FlagStack`.
class FlagStack extends StatelessWidget {
  const FlagStack({
    super.key,
    required this.languages,
    required this.tokens,
    this.max = 4,
    this.size = FlagSize.md,
  });

  final List<String> languages;
  final HarborTokens tokens;
  final int max;
  final FlagSize size;

  @override
  Widget build(BuildContext context) {
    if (languages.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    final shown = languages.take(max).toList();
    final extra = languages.length - shown.length;
    final h = _flagHeight(size);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final lang in shown) ...[
          _stackChild(t, lang, h),
          const SizedBox(width: 4),
        ],
        if (extra > 0)
          Text(
            '+$extra',
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  Widget _stackChild(HarborTokens t, String lang, double h) {
    if (lang == 'Multi') {
      return _MultiChip(tokens: t, height: h + 2, compact: true);
    }
    final asset = _flagAssets[lang];
    if (asset == null) {
      return Container(
        height: h + 2,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Text(
          lang.length >= 2
              ? lang.substring(0, 2).toUpperCase()
              : lang.toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
          ),
        ),
      );
    }
    return _FlagImage(asset: asset, height: h, tokens: t);
  }
}

class _FlagImage extends StatelessWidget {
  const _FlagImage({
    required this.asset,
    required this.height,
    required this.tokens,
  });

  final String asset;
  final double height;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(2),
    child: SvgPicture.asset(
      asset,
      height: height,
      width: height * 1.5,
      fit: BoxFit.cover,
    ),
  );
}

class _MultiChip extends StatelessWidget {
  const _MultiChip({
    required this.tokens,
    required this.height,
    this.compact = false,
  });

  final HarborTokens tokens;
  final double height;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      height: height,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: t.accentSoft,
        borderRadius: BorderRadius.circular(3),
        border: Border.all(color: t.accent.withValues(alpha: 0.35)),
      ),
      child: Text(
        compact ? 'M' : 'MULTI',
        style: TextStyle(
          color: t.accent,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.6,
        ),
      ),
    );
  }
}
