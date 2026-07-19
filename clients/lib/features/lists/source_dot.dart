import 'package:flutter/widgets.dart';

import '../../design/tokens.dart';
import '../../domain/lists/list_types.dart';

/// The accent-dot color for a list [source], resolved against the active
/// theme's tokens. Ports the web `SOURCE_DOT` map.
Color sourceDotColor(HarborTokens t, ListSource source) => switch (source) {
  ListSource.trakt => t.danger,
  ListSource.tmdb => t.accent,
  ListSource.mdblist => t.ink,
  ListSource.letterboxd => t.accent,
  ListSource.imdb => t.accent,
  ListSource.mal => t.ink,
};
