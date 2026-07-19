import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../tokens.dart';

/// The poster image fade-in from the `posterEffect` setting: instant when "off"
/// (the default), else a 300ms fade — matching `<Poster>` in poster.tsx, where
/// only "off" pins the image opacity to 1 with no transition.
Duration posterFadeIn(String effect) =>
    effect == 'off' ? Duration.zero : const Duration(milliseconds: 300);

/// A movie/series poster routed through the RPDB rated-poster chain: the RPDB
/// URL (resolving the complementary imdb/tmdb id when the configured host needs
/// it) is tried first, then the raw poster on load error, then [fallback].
/// Ported from `usePosterChain` + `<Poster>`. Reused by every poster card.
class RpdbPosterImage extends ConsumerWidget {
  const RpdbPosterImage({
    super.key,
    required this.metaId,
    required this.rawPoster,
    required this.type,
    required this.tokens,
    required this.fallback,
  });

  final String metaId;
  final String? rawPoster;
  final String type; // movie | series
  final HarborTokens tokens;
  final Widget Function() fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // While the chain resolves, show the raw poster immediately (no flash).
    final candidates =
        ref
            .watch(
              rpdbPosterProvider((
                metaId: metaId,
                rawPoster: rawPoster,
                type: type,
              )),
            )
            .value ??
        (rawPoster != null ? [rawPoster!] : const <String>[]);
    if (candidates.isEmpty) return fallback();
    final effect = ref.watch(settingsProvider).getString('posterEffect');
    return _ChainImage(
      urls: candidates,
      tokens: tokens,
      fallback: fallback,
      fadeIn: posterFadeIn(effect),
    );
  }
}

/// Renders the first loadable url from an ordered candidate list, advancing to
/// the next on error and showing [fallback] once all fail. Ported from the
/// `usePosterChain` failed-set behaviour.
class _ChainImage extends StatefulWidget {
  const _ChainImage({
    required this.urls,
    required this.tokens,
    required this.fallback,
    required this.fadeIn,
  });

  final List<String> urls;
  final HarborTokens tokens;
  final Widget Function() fallback;
  final Duration fadeIn;

  @override
  State<_ChainImage> createState() => _ChainImageState();
}

class _ChainImageState extends State<_ChainImage> {
  int _index = 0;

  @override
  void didUpdateWidget(_ChainImage old) {
    super.didUpdateWidget(old);
    if (!listEquals(old.urls, widget.urls)) _index = 0;
  }

  @override
  Widget build(BuildContext context) {
    if (_index >= widget.urls.length) return widget.fallback();
    final url = widget.urls[_index];
    return CachedNetworkImage(
      key: ValueKey(url),
      imageUrl: url,
      fit: BoxFit.cover,
      fadeInDuration: widget.fadeIn,
      placeholder: (_, _) => ColoredBox(color: widget.tokens.surface),
      errorWidget: (_, _, _) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _index < widget.urls.length) {
            setState(() => _index++);
          }
        });
        return ColoredBox(color: widget.tokens.surface);
      },
    );
  }
}
