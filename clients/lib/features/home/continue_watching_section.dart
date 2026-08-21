import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/cw_advance_provider.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/stremio_auth.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/library_watched.dart';
import '../../domain/library/local_cw.dart';
import '../../domain/nav/frame.dart';
import '../../design/layout/idiom.dart';

/// The "{m}m left" / "{h}h {m}m left" resume label from the remaining runtime,
/// ported 1:1 from the web `formatRemaining` (continue-card.tsx). Returns null
/// when the runtime is unknown (no pill), matching web (which only shows it for
/// items with a known duration).
String? cwRemainingLabel(Translations tr, int positionMs, int durationMs) {
  if (durationMs <= 0) return null;
  final remaining = durationMs - positionMs;
  if (remaining <= 0) return null;
  final minutes = (remaining / 60000).round();
  if (minutes < 60) return tr.t('{m}m left', {'m': minutes});
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0
      ? tr.t('{h}h left', {'h': h})
      : tr.t('{h}h {m}m left', {'h': h, 'm': m});
}

/// The single-index episode number for an anime Continue-Watching entry (the web
/// CW card `animeEp`) — a 3-segment anime videoId (`kitsu:9:5`) carries it in the
/// last segment, else the entry's episode number. Null for non-anime entries, so
/// the card keeps the "S{s} · E{e}" label there.
int? cwAnimeEpisode(LocalCwEntry entry) {
  if (!isAnimeCwEntry(entry)) return null;
  final segs = entry.videoId?.split(':');
  if (segs != null && segs.length == 3) {
    final n = int.tryParse(segs[2]);
    if (n != null) return n;
  }
  return entry.episode;
}

/// Pushes the source picker to resume-play a Continue-Watching entry in one tap,
/// mirroring the web CW card's center Play (`playLocalAware` → `openPicker(...,
/// resume: true)`); the player restores the saved position by id/episode. Anime
/// entries carry the flag the picker's stream filter conditions on.
void pushCwResume(WidgetRef ref, LocalCwEntry entry) {
  ref
      .read(navControllerProvider.notifier)
      .push(
        Frame(FrameKind.picker, {
          'type': entry.type,
          'id': entry.id,
          'season': ?entry.season,
          'episode': ?entry.episode,
          'title': entry.name,
          'poster': ?entry.poster,
          'isAnime': isAnimeCwEntry(entry),
          'autoPlay': ref.read(settingsProvider).getBool('instantPlay'),
        }),
      );
}

/// The Home Continue-Watching shelf, ported from `src/views/home/cw-section.tsx`
/// + `continue-card.tsx`: a landscape rail of in-progress titles with a resume
/// progress bar and a per-item dismiss. Local CW is the source; Stremio + Simkl
/// CW merge in with those tracker providers.
/// Which slice of Continue-Watching a shelf shows. `animeOnlyInAnimeRoom` keeps
/// anime out of the Home shelf ([general]) and gives the anime room its own
/// ([anime]) shelf.
enum CwAudience { all, general, anime }

class ContinueWatchingSection extends ConsumerWidget {
  const ContinueWatchingSection({
    super.key,
    this.audience = CwAudience.all,
    this.autofocusFirst = false,
  });

  final CwAudience audience;

  /// Autofocus the first card on a TV when this rail is the page's fallback
  /// focus target (classic Home / empty hero) — it sits at the top of the list
  /// so it is actually built at mount. First mount only; a no-op off-TV.
  final bool autofocusFirst;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = pageGutter(Idiom.of(context));
    final t = ref.watch(tokensProvider);
    // The advance engine rolls finished-episode cards to their next episode and
    // drops finished series. While it loads (or if disabled) fall back to the raw
    // aggregate so the shelf never blanks.
    final rows =
        ref.watch(cwAdvancedProvider).value ??
        [for (final e in ref.watch(continueWatchingProvider)) CwRow(e)];
    final items = switch (audience) {
      CwAudience.all => rows,
      CwAudience.general =>
        rows.where((r) => !isAnimeCwEntry(r.entry)).toList(),
      CwAudience.anime => rows.where((r) => isAnimeCwEntry(r.entry)).toList(),
    };
    if (items.isEmpty) {
      // The anime room keeps its shelf hidden when empty; the main Home shows a
      // "nothing yet" / sign-in panel like web CWSection (always rendered).
      if (audience == CwAudience.anime) return const SizedBox.shrink();
      return _emptyState(context, ref, t, g);
    }
    final titleScale = ref.watch(settingsProvider).getDouble('rowTitleScale');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Text(
            ref.watch(translationsProvider).t('Continue Watching'),
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(22, titleScale),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 210,
          // Contain D-pad left/right to this row in reading order, like every
          // other home rail (top_rank_card / streaming_rail / tv_row).
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, i) => _ContinueCard(
                entry: items[i].entry,
                upNext: items[i].upNext,
                tokens: t,
                autofocus: autofocusFirst && i == 0,
                onOpen: () => ref
                    .read(navControllerProvider.notifier)
                    .push(
                      Frame(FrameKind.meta, {
                        'type': items[i].entry.type,
                        'id': items[i].entry.id,
                      }),
                    ),
                onPlay: () => pushCwResume(ref, items[i].entry),
                onDismiss: () => ref
                    .read(continueWatchingProvider.notifier)
                    .dismiss(items[i].entry.id),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// The empty Continue-Watching state (web `CWSection` empty branch): the title
  /// plus a panel — "Nothing in progress yet" when signed into Stremio, or a
  /// sign-in prompt (opens Settings, where the Stremio login lives) otherwise.
  Widget _emptyState(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    double g,
  ) {
    final tr = ref.watch(translationsProvider);
    final signedIn = ref.watch(stremioSessionProvider).asData?.value != null;
    final titleScale = ref.watch(settingsProvider).getDouble('rowTitleScale');
    final message = signedIn
        ? tr.t('Nothing in progress yet. Press Play on something.')
        : '${tr.t('Sign in to')} Stremio ${tr.t('to bring in your library.')}';
    final panel = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edge),
      ),
      alignment: Alignment.center,
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.4),
      ),
    );
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 0, g, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              tr.t('Continue Watching'),
              style: TextStyle(
                color: t.ink,
                fontSize: scaledRowTitle(22, titleScale),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          // Signed-out panel is a focusable that opens Settings to sign in.
          if (signedIn)
            panel
          else
            Focusable(
              tokens: t,
              borderRadius: 16,
              scale: 1.0,
              onPressed: () => ref
                  .read(navControllerProvider.notifier)
                  .setView(FrameKind.settings),
              child: panel,
            ),
        ],
      ),
    );
  }
}

class _ContinueCard extends ConsumerWidget {
  const _ContinueCard({
    required this.entry,
    required this.tokens,
    required this.onOpen,
    required this.onPlay,
    required this.onDismiss,
    this.upNext = false,
    this.autofocus = false,
  });

  final LocalCwEntry entry;
  final HarborTokens tokens;
  final VoidCallback onOpen;
  final VoidCallback onPlay;
  final VoidCallback onDismiss;

  /// The advance engine rolled this card to a fresh next episode — show an
  /// "Up Next" label and suppress the (meaningless) time-left pill.
  final bool upNext;
  final bool autofocus;

  /// The card's long-press / context-key menu, mirroring the web CW card menu.
  Future<void> _openMenu(BuildContext context, WidgetRef ref) async {
    final tr = ref.read(translationsProvider);
    final inWatchlist = ref.read(watchlistProvider).contains(entry.id);
    final inFavorites = ref.read(mediaFavoritesProvider).contains(entry.id);
    final isMovie = entry.type == 'movie';
    final watched = ref.read(movieWatchedProvider).contains(entry.id);
    final result = await showContextMenu<String>(
      context: context,
      tokens: tokens,
      actions: [
        ContextMenuAction(
          value: 'play',
          label: tr.t('Resume'),
          icon: Icons.play_arrow_rounded,
        ),
        ContextMenuAction(
          value: 'details',
          label: tr.t('View details'),
          icon: Icons.info_outline,
        ),
        ContextMenuAction(
          value: 'watchlist',
          label: inWatchlist ? tr.t('In watchlist') : tr.t('Add to watchlist'),
          icon: inWatchlist ? Icons.bookmark : Icons.bookmark_add_outlined,
        ),
        ContextMenuAction(
          value: 'favorite',
          label: inFavorites ? tr.t('In favorites') : tr.t('Add to favorites'),
          icon: inFavorites ? Icons.star : Icons.star_border,
        ),
        if (isMovie && !watched)
          ContextMenuAction(
            value: 'watched',
            label: tr.t('Mark as watched'),
            icon: Icons.check,
          ),
        ContextMenuAction(
          value: 'remove',
          label: tr.t('Remove from Continue Watching'),
          icon: Icons.close,
          danger: true,
        ),
      ],
    );
    switch (result) {
      case 'play':
        onPlay();
      case 'details':
        onOpen();
      case 'watchlist':
        ref
            .read(watchlistProvider.notifier)
            .toggle(
              id: entry.id,
              type: entry.type,
              name: entry.name,
              poster: entry.poster,
            );
      case 'favorite':
        ref
            .read(mediaFavoritesProvider.notifier)
            .toggle(
              id: entry.id,
              type: entry.type,
              name: entry.name,
              poster: entry.poster,
            );
      case 'watched':
        ref.read(movieWatchedProvider.notifier).mark(entry.id);
      case 'remove':
        onDismiss();
    }
  }

  /// Only a valid absolute http(s) URL is safe for the network image. A
  /// continue-watching entry merged from the Stremio library can carry an empty
  /// or relative poster/background, which throws "No host specified in URI".
  static String? _cwImageUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasAuthority) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;
    return url;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    var image = _cwImageUrl(entry.background) ?? _cwImageUrl(entry.poster);
    // A continue-watching entry merged from the Stremio library often carries no
    // artwork of its own (the library stores only id/name/type/state), so resolve
    // its meta to fill in the poster/background — matching the web, which renders
    // CW cards from resolved metas, not the bare library rows.
    if (image == null) {
      final meta = ref
          .watch(metaProvider((type: entry.type, id: entry.id)))
          .value;
      image = _cwImageUrl(meta?.background) ?? _cwImageUrl(meta?.poster);
    }
    final tr = ref.watch(translationsProvider);
    // The episode name beside S/E (web CW card), resolved from the cached
    // episode catalog — null (just S/E shown) for non-TMDB series or unknowns.
    final epTitle =
        (entry.type == 'series' &&
            entry.season != null &&
            entry.episode != null)
        ? ref
              .watch(
                cwEpisodeTitleProvider((
                  id: entry.id,
                  season: entry.season!,
                  episode: entry.episode!,
                )),
              )
              .value
        : null;
    // Anime cards read "Ep {n}" (single-index), not "S1 · E5" — web CW card
    // `animeEp`.
    final animeEp = cwAnimeEpisode(entry);
    final epBase = (animeEp != null && animeEp > 0)
        ? tr.t('Ep {n}', {'n': animeEp})
        : (entry.season != null && entry.episode != null)
        ? 'S${entry.season} · E${entry.episode}'
        : null;
    final ep = epBase != null
        ? '$epBase${epTitle != null ? ' · $epTitle' : ''}'
        : null;
    // Green "Watched on Trakt" check when Trakt marks this entry's current
    // position watched (web CW card `isLibraryItemWatched`). Empty set (Trakt
    // off / not loaded) → no badge.
    final watchedTrakt = isCwEntryWatched(
      entry,
      ref.watch(traktWatchedKeySetProvider).value ?? const <String>{},
    );
    // "+N new episodes since you last watched" — recently-aired episodes for a
    // tt series CW entry (web `useHasNewEpisode`). 0 for non-tt/non-series.
    final newEps = (entry.type == 'series' && entry.id.startsWith('tt'))
        ? (ref
                  .watch(
                    cwNewEpisodeCountProvider((
                      id: entry.id,
                      type: entry.type,
                      lastWatchedMs: entry.t,
                    )),
                  )
                  .value ??
              0)
        : 0;
    // An advanced (up-next) card is a fresh episode with no resume position, and
    // an external (Simkl) card's progress lives on that service — in both cases
    // the device-local time-left pill would be meaningless, so suppress it. An
    // external card shows a "Paused on {service}" tag in its place (web CW card).
    final remaining = (upNext || entry.external != null)
        ? null
        : cwRemainingLabel(tr, entry.positionMs, entry.durationMs);
    final externalLabel = (entry.external == 'simkl' && !upNext)
        ? tr.t('Paused on Simkl')
        : null;
    return SizedBox(
      width: 300,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The artwork fills the space left after the title/episode lines, so
          // the card never overflows its fixed rail height at a larger text
          // scale (an AspectRatio here overflowed by a few px on iPad).
          Expanded(
            child: Focusable(
              tokens: tokens,
              borderRadius: 12,
              autofocus: autofocus,
              onPressed: onOpen,
              onLongPress: () => _openMenu(context, ref),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (image != null)
                      CachedNetworkImage(
                        imageUrl: image,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) =>
                            ColoredBox(color: tokens.surface),
                      )
                    else
                      ColoredBox(color: tokens.surface),
                    // Green "Watched on Trakt" check, top-left (web CW card).
                    if (watchedTrakt)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Semantics(
                          label: tr.t('Watched on Trakt'),
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF34D399,
                              ).withValues(alpha: 0.22),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(
                                  0xFF34D399,
                                ).withValues(alpha: 0.4),
                              ),
                            ),
                            child: const Icon(
                              Icons.check_rounded,
                              size: 13,
                              color: Color(0xFFA7F3D0),
                            ),
                          ),
                        ),
                      ),
                    // "+N new episodes since you last watched" accent pill,
                    // top-left over the artwork (web CW card `useHasNewEpisode`).
                    // Shifted right of the watched check when both are present.
                    if (newEps > 0)
                      Positioned(
                        top: 6,
                        left: watchedTrakt ? 38 : 8,
                        child: Semantics(
                          label: newEps == 1
                              ? tr.t('1 new episode since you last watched')
                              : tr.t(
                                  '{n} new episodes since you last watched',
                                  {'n': '$newEps'},
                                ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: tokens.accent.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '+$newEps',
                              style: TextStyle(
                                color: tokens.canvas,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ),
                      ),
                    // Dismiss button.
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Focusable(
                        tokens: tokens,
                        borderRadius: 999,
                        focusColor: tokens.danger,
                        onPressed: onDismiss,
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: tokens.canvas.withValues(alpha: 0.7),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.close, size: 16, color: tokens.ink),
                        ),
                      ),
                    ),
                    // One-click resume Play (web CW card center Play). A nested
                    // focus target — the D-pad reaches it after the card, like
                    // the dismiss button.
                    Align(
                      child: Focusable(
                        tokens: tokens,
                        borderRadius: 999,
                        onPressed: onPlay,
                        child: Container(
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: tokens.canvas.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: tokens.ink.withValues(alpha: 0.7),
                            ),
                          ),
                          child: Icon(
                            Icons.play_arrow_rounded,
                            size: 26,
                            color: tokens.ink,
                          ),
                        ),
                      ),
                    ),
                    // Time-left pill (web `formatRemaining`), bottom-left over
                    // the artwork — or the "Paused on Simkl" tag for an external
                    // card, which has no device-local time-left.
                    if (remaining != null || externalLabel != null)
                      Positioned(
                        left: 8,
                        bottom: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: tokens.canvas.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (externalLabel != null) ...[
                                Icon(
                                  Icons.sync_rounded,
                                  size: 11,
                                  color: tokens.inkSubtle,
                                ),
                                const SizedBox(width: 4),
                              ],
                              Text(
                                remaining ?? externalLabel!,
                                style: TextStyle(
                                  color: tokens.ink,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Resume progress bar.
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Container(
                        height: 4,
                        color: tokens.canvas.withValues(alpha: 0.4),
                        child: FractionallySizedBox(
                          widthFactor: entry.progress,
                          alignment: Alignment.centerLeft,
                          child: ColoredBox(color: tokens.accent),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            entry.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tokens.ink,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (upNext)
            Text(
              ep != null ? '${tr.t('Up Next')} · $ep' : tr.t('Up Next'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: tokens.accent,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            )
          else if (ep != null)
            Text(ep, style: TextStyle(color: tokens.inkSubtle, fontSize: 12)),
        ],
      ),
    );
  }
}
