import '../addons/models.dart';

/// A hero-carousel slide: the full meta plus its trending rank, ported from the
/// `Slide` type in `src/components/hero-carousel.tsx`.
class HeroSlide {
  const HeroSlide({
    required this.meta,
    required this.rankLabel,
    required this.rankPosition,
  });

  final Meta meta;

  /// `TV` for series, `Movies` for movies.
  final String rankLabel;
  final int rankPosition;
}
