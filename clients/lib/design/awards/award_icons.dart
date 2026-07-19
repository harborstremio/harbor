import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../domain/awards/wikidata_awards.dart';
import 'laurel_svg.dart';

const Color _baftaGold = Color(0xFFCA9200);

/// The laurel/logo tint per award body. Ported from `laurelColorFor` in
/// `icons/award-logo.tsx`.
Color laurelColorFor(AwardType type) => switch (type) {
  AwardType.oscar => const Color(0xFFD4AF37),
  AwardType.emmy => const Color(0xFFD4AF37),
  AwardType.goldenGlobe => const Color(0xFFD4AF37),
  AwardType.bafta => const Color(0xFFCA9200),
  AwardType.criticsChoice => const Color(0xFFCE8819),
  AwardType.sag => const Color(0xFFB08D57),
  AwardType.cannes => const Color(0xFFDAA520),
  AwardType.venice => const Color(0xFFDAA520),
  AwardType.berlin => const Color(0xFFBFBFBF),
  AwardType.other => const Color(0xFFD4AF37),
};

// The warm sepia cast the web applies to the Critics' Choice logo
// (`saturate(0.4) sepia(0.85) hue-rotate(-12deg) brightness(1.05)`), reproduced
// as the standard sepia color matrix.
const ColorFilter _criticsChoiceTint = ColorFilter.matrix(<double>[
  0.393, 0.769, 0.189, 0, 0, //
  0.349, 0.686, 0.168, 0, 0, //
  0.272, 0.534, 0.131, 0, 0, //
  0, 0, 0, 1, 0, //
]);

/// The per-body award logo. Ported from `AwardLogo`: bitmap logos scaled by body
/// (BAFTA rendered as a gold-masked silhouette, Critics' Choice warm-tinted).
class AwardLogo extends StatelessWidget {
  const AwardLogo({super.key, required this.type, this.size = 22});

  final AwardType type;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (type == AwardType.bafta) {
      return SizedBox(
        width: size * 0.85,
        height: size,
        child: ColorFiltered(
          colorFilter: const ColorFilter.mode(_baftaGold, BlendMode.srcIn),
          child: Image.asset('assets/awards/bafta.png', fit: BoxFit.contain),
        ),
      );
    }
    final (String asset, double scale) = switch (type) {
      AwardType.oscar => ('oscar', 1.15),
      AwardType.emmy => ('emmy', 1.1),
      AwardType.goldenGlobe => ('golden_globe', 1.15),
      AwardType.sag => ('sag', 1.15),
      AwardType.berlin => ('berlin', 1.2),
      AwardType.cannes => ('cannes', 1.2),
      AwardType.venice => ('venice', 1.2),
      AwardType.criticsChoice => ('critics_choice', 1.1),
      // `other` (and the early-returned `bafta`) fall back to the Oscar mark.
      _ => ('oscar', 1.15),
    };
    final image = Image.asset(
      'assets/awards/$asset.png',
      height: size * scale,
      fit: BoxFit.contain,
    );
    return type == AwardType.criticsChoice
        ? ColorFiltered(colorFilter: _criticsChoiceTint, child: image)
        : image;
  }
}

/// The laurel-wreath frame with an optional centered [child] (the award logo).
/// Ported from `icons/laurel.tsx`: the wreath SVG is recolored to [color] and
/// the child sits in the central opening.
class Laurel extends StatelessWidget {
  const Laurel({
    super.key,
    required this.size,
    required this.color,
    this.child,
  });

  final double size;
  final Color color;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size * (1682 / 2000),
      child: Padding(
        padding: EdgeInsets.only(bottom: size * 0.14),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: SvgPicture.string(
                kLaurelSvg,
                colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
                fit: BoxFit.contain,
              ),
            ),
            if (child != null)
              SizedBox(
                width: size * 0.46,
                height: size * 0.6,
                child: Center(child: child),
              ),
          ],
        ),
      ),
    );
  }
}
