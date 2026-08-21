import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/trailer/trailer.dart';
import '../domain/trailer/youtube_explode_resolver.dart';
import 'providers.dart';

/// Whether the fullscreen trailer overlay is open — the hero autoplay trailer
/// pauses while it is, so two trailers never play at once.
class TrailerOverlayOpen extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final trailerOverlayOpenProvider = NotifierProvider<TrailerOverlayOpen, bool>(
  TrailerOverlayOpen.new,
);

/// The hero autoplay trailer's mute state, seeded from `detailTrailerAudio`
/// (default muted) and flipped by the hero's mute toggle.
class HeroTrailerMuted extends Notifier<bool> {
  @override
  bool build() => !ref.read(settingsProvider).getBool('detailTrailerAudio');

  void toggle() => state = !state;
}

final heroTrailerMutedProvider = NotifierProvider<HeroTrailerMuted, bool>(
  HeroTrailerMuted.new,
);

/// The production trailer extractor (youtube_explode). Closed with the scope.
final trailerResolverProvider = Provider<TrailerResolver>((ref) {
  final resolver = YoutubeExplodeTrailerResolver();
  ref.onDispose(resolver.close);
  return resolver;
});

/// Resolves a playable trailer stream for a (ytId, quality) pair — Riverpod
/// caches it per key, mirroring the web `fetchTrailer` memoization. A null value
/// means extraction failed and the caller should open [youtubeWatchUrl].
final trailerStreamProvider = FutureProvider.family
    .autoDispose<TrailerStream?, ({String ytId, TrailerQuality quality})>((
      ref,
      key,
    ) {
      // Keep a resolved stream around briefly (its URL expires) so reopening the
      // overlay after closing the hero doesn't re-extract immediately.
      ref.keepAlive();
      return ref.watch(trailerResolverProvider).resolve(key.ytId, key.quality);
    });
