import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/history_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/stremio_auth.dart';
import '../../app/theme_controller.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/dates.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/history.dart';
import '../../domain/library/history_episode.dart';
import '../../domain/library/history_grouping.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

const _kViewKey = 'harbor.history.view';
const _kFlatKey = 'harbor.history.flat';

/// The Library "History" tab — everything the viewer has watched, merged from
/// the Stremio library and the connected Trakt account. Ported 1:1 from the web
/// `HistoryTab`: a type/search filter bar with view (posters/episodes), sort
/// (recent/A–Z/year) and grouping (grouped/one-list) controls over date-bucketed
/// rails of poster or episode cards.
class HistoryTab extends ConsumerStatefulWidget {
  const HistoryTab({super.key});

  @override
  ConsumerState<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends ConsumerState<HistoryTab> {
  String _type = 'all';
  String _query = '';
  final _searchController = TextEditingController();
  late String _view = _readView();
  late bool _flat = _readFlat();

  String _readView() =>
      ref.read(kvStoreProvider).getString(_kViewKey) == 'episodes'
      ? 'episodes'
      : 'posters';

  bool _readFlat() => ref.read(kvStoreProvider).getString(_kFlatKey) == '1';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _setView(String v) {
    setState(() => _view = v);
    ref.read(kvStoreProvider).setString(_kViewKey, v);
  }

  void _toggleFlat() {
    setState(() => _flat = !_flat);
    ref.read(kvStoreProvider).setString(_kFlatKey, _flat ? '1' : '0');
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final feed = ref.watch(historyFeedProvider);
    final sort = ref.watch(settingsProvider).getString('librarySort');
    final effectiveSort = sort.isEmpty ? 'recent' : sort;

    final signedIn =
        (ref.watch(stremioSessionProvider).asData?.value?.authKey ?? '')
            .isNotEmpty;
    final traktConnected = ref.watch(traktConnectedProvider);

    if (!signedIn && !traktConnected) {
      return _empty(
        t,
        Icons.history_rounded,
        tr.t('No history yet'),
        tr.t(
          'Sign in to Stremio or connect Trakt to see what you\'ve been '
          'watching here.',
        ),
      );
    }
    if (feed.loading && feed.entries.isEmpty) {
      return _message(t, tr.t('Loading your history…'));
    }

    final merged = feed.entries;
    final counts = countHistoryTypes(
      filterHistoryByType(merged, 'all', _query),
    );
    final visible = filterHistoryByType(merged, _type, _query);
    final groups = historyGroups(
      visible,
      sort: effectiveSort,
      flat: _flat,
      nowMs: DateTime.now().millisecondsSinceEpoch,
    );

    return ListView(
      padding: EdgeInsets.only(
        bottom: 32 + overscanInset(Idiom.of(context)).bottom,
      ),
      children: [
        if (merged.isNotEmpty)
          _FilterBar(
            tokens: t,
            tr: tr,
            type: _type,
            onType: (v) => setState(() => _type = v),
            controller: _searchController,
            onQuery: (v) => setState(() => _query = v),
            counts: counts,
            view: _view,
            onView: _setView,
            sort: effectiveSort,
            onSort: (v) =>
                ref.read(settingsProvider.notifier).setValue('librarySort', v),
            flat: _flat,
            onToggleFlat: _toggleFlat,
          ),
        const SizedBox(height: 12),
        Text(
          _countLabel(tr, merged.length, feed.traktSyncing && traktConnected),
          style: TextStyle(color: t.inkMuted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        if (merged.isEmpty)
          _inlineEmpty(
            t,
            tr.t('Nothing watched yet'),
            tr.t(
              'Press play on something. It\'ll show up here once you start '
              'watching.',
            ),
          )
        else if (visible.isEmpty)
          _inlineEmpty(t, tr.t('No matches for these filters.'), null)
        else
          for (var i = 0; i < groups.length; i++) ...[
            if (i > 0) const SizedBox(height: 28),
            _GroupSection(
              group: groups[i],
              tokens: t,
              tr: tr,
              episodes: _view == 'episodes',
              onOpen: _open,
              onRemove: (id) =>
                  ref.read(historyFeedProvider.notifier).remove(id),
            ),
          ],
      ],
    );
  }

  void _open(HistoryEntry e) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': e.meta.type, 'id': e.meta.id}));

  String _countLabel(Translations tr, int n, bool syncing) {
    final base = n == 1
        ? tr.t('{n} item', {'n': n})
        : tr.t('{n} items', {'n': n});
    return syncing ? '$base · ${tr.t('Syncing Trakt…')}' : base;
  }

  Widget _message(HarborTokens t, String text) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 13)),
  );

  Widget _inlineEmpty(HarborTokens t, String title, String? body) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: t.edgeSoft),
      color: t.canvas.withValues(alpha: 0.3),
    ),
    child: Column(
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: t.ink,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (body != null) ...[
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
            ),
          ),
        ],
      ],
    ),
  );

  Widget _empty(HarborTokens t, IconData icon, String title, String body) =>
      Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42, color: t.inkSubtle),
            const SizedBox(height: 16),
            Text(
              title,
              style: TextStyle(
                color: t.ink,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
              ),
            ),
          ],
        ),
      );
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.tokens,
    required this.tr,
    required this.type,
    required this.onType,
    required this.controller,
    required this.onQuery,
    required this.counts,
    required this.view,
    required this.onView,
    required this.sort,
    required this.onSort,
    required this.flat,
    required this.onToggleFlat,
  });

  final HarborTokens tokens;
  final Translations tr;
  final String type;
  final ValueChanged<String> onType;
  final TextEditingController controller;
  final ValueChanged<String> onQuery;
  final ({int all, int movie, int series}) counts;
  final String view;
  final ValueChanged<String> onView;
  final String sort;
  final ValueChanged<String> onSort;
  final bool flat;
  final VoidCallback onToggleFlat;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _pillGroup(t, [
          _pill(t, tr.t('All'), counts.all, type == 'all', () => onType('all')),
          _pill(
            t,
            tr.t('Movies'),
            counts.movie,
            type == 'movie',
            () => onType('movie'),
          ),
          _pill(
            t,
            tr.t('Shows'),
            counts.series,
            type == 'series',
            () => onType('series'),
          ),
        ]),
        SizedBox(
          width: 240,
          child: TvTextField(
            controller: controller,
            onChanged: onQuery,
            style: TextStyle(color: t.ink, fontSize: 13),
            cursorColor: t.accent,
            decoration: InputDecoration(
              isDense: true,
              hintText: tr.t('Search title…'),
              hintStyle: TextStyle(color: t.inkSubtle),
              prefixIcon: Icon(
                Icons.search_rounded,
                size: 18,
                color: t.inkSubtle,
              ),
              filled: true,
              fillColor: t.elevated.withValues(alpha: 0.4),
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: _border(t.edgeSoft),
              enabledBorder: _border(t.edgeSoft),
              focusedBorder: _border(t.accent, 2),
            ),
          ),
        ),
        _pillGroup(t, [
          _seg(t, tr.t('Posters'), view == 'posters', () => onView('posters')),
          _seg(
            t,
            tr.t('Episodes'),
            view == 'episodes',
            () => onView('episodes'),
          ),
        ]),
        _pillGroup(t, [
          _seg(t, tr.t('Recent'), sort == 'recent', () => onSort('recent')),
          _seg(t, tr.t('A-Z'), sort == 'title', () => onSort('title')),
          _seg(t, tr.t('Year'), sort == 'year', () => onSort('year')),
        ]),
        if (sort == 'recent')
          _pillGroup(t, [
            _seg(t, tr.t('Grouped'), !flat, () {
              if (flat) onToggleFlat();
            }),
            _seg(t, tr.t('One list'), flat, () {
              if (!flat) onToggleFlat();
            }),
          ]),
      ],
    );
  }

  OutlineInputBorder _border(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(999),
    borderSide: BorderSide(color: c, width: w),
  );

  Widget _pillGroup(HarborTokens t, List<Widget> children) => Container(
    padding: const EdgeInsets.all(3),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: children),
  );

  Widget _pill(
    HarborTokens t,
    String label,
    int count,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
      decoration: BoxDecoration(
        color: active ? t.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: active ? t.canvas : t.inkMuted,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            '$count',
            style: TextStyle(
              color: active ? t.canvas.withValues(alpha: 0.7) : t.inkSubtle,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _seg(HarborTokens t, String label, bool active, VoidCallback onTap) =>
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 999,
        onPressed: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: active ? t.ink : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? t.canvas : t.inkMuted,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
}

class _GroupSection extends StatelessWidget {
  const _GroupSection({
    required this.group,
    required this.tokens,
    required this.tr,
    required this.episodes,
    required this.onOpen,
    required this.onRemove,
  });

  final HistoryGroup group;
  final HarborTokens tokens;
  final Translations tr;
  final bool episodes;
  final void Function(HistoryEntry) onOpen;
  final void Function(String stremioId) onRemove;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              tr.t(group.label).toUpperCase(),
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.4,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${group.items.length}',
              style: TextStyle(color: t.inkSubtle, fontSize: 11),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 16,
          runSpacing: 20,
          children: [
            for (final e in group.items)
              SizedBox(
                width: episodes ? 260 : 158,
                child: episodes
                    ? _EpisodeCard(
                        entry: e,
                        tokens: t,
                        tr: tr,
                        onOpen: () => onOpen(e),
                        onRemove: e.stremioId == null
                            ? null
                            : () => onRemove(e.stremioId!),
                      )
                    : _PosterCard(
                        entry: e,
                        tokens: t,
                        onOpen: () => onOpen(e),
                        onRemove: e.stremioId == null
                            ? null
                            : () => onRemove(e.stremioId!),
                      ),
              ),
          ],
        ),
      ],
    );
  }
}

class _PosterCard extends StatelessWidget {
  const _PosterCard({
    required this.entry,
    required this.tokens,
    required this.onOpen,
    required this.onRemove,
  });

  final HistoryEntry entry;
  final HarborTokens tokens;
  final VoidCallback onOpen;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 2 / 3,
          child: Stack(
            children: [
              Positioned.fill(
                child: Focusable(
                  tokens: t,
                  borderRadius: 12,
                  onPressed: onOpen,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: RpdbPosterImage(
                      metaId: entry.meta.id,
                      rawPoster: entry.meta.poster,
                      type: entry.meta.type,
                      tokens: t,
                      fallback: () => ColoredBox(color: t.elevated),
                    ),
                  ),
                ),
              ),
              if (onRemove != null)
                PositionedDirectional(
                  top: 6,
                  end: 6,
                  child: _RemoveButton(tokens: t, onRemove: onRemove!),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          entry.meta.name.isEmpty ? entry.meta.id : entry.meta.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: t.ink,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _EpisodeCard extends ConsumerWidget {
  const _EpisodeCard({
    required this.entry,
    required this.tokens,
    required this.tr,
    required this.onOpen,
    required this.onRemove,
  });

  final HistoryEntry entry;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onOpen;
  final VoidCallback? onRemove;

  bool get _isEpisode =>
      entry.meta.type == 'series' &&
      entry.season != null &&
      entry.episode != null;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    // For episode rows, resolve the TMDB still + episode title (matching the web
    // card). Every episode of a season shares one fetch via the season key.
    final enriched = _isEpisode
        ? ref
              .watch(
                historySeasonEpisodesProvider((
                  imdbId: entry.meta.id,
                  season: entry.season!,
                )),
              )
              .maybeWhen(
                data: (eps) => historyEpisodeMeta(eps, entry.episode!),
                orElse: () => HistoryEpisodeMeta.empty,
              )
        : HistoryEpisodeMeta.empty;
    final epTitle = enriched.title;
    final image = enriched.still ?? entry.meta.background ?? entry.meta.poster;
    final remaining = entry.durationMs > 0 && !entry.watched
        ? _remaining(tr, entry.durationMs - entry.timeOffsetMs)
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Focusable(
          tokens: t,
          borderRadius: 12,
          onPressed: onOpen,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (image != null)
                    CachedNetworkImage(
                      imageUrl: image,
                      fit: BoxFit.cover,
                      // A broken still falls through to the base artwork, as the
                      // web card advances through its image candidates on error.
                      errorWidget: (context, url, error) {
                        final fallback =
                            entry.meta.background ?? entry.meta.poster;
                        return fallback != null && fallback != image
                            ? CachedNetworkImage(
                                imageUrl: fallback,
                                fit: BoxFit.cover,
                                errorWidget: (context, url, error) =>
                                    ColoredBox(color: t.surface),
                              )
                            : ColoredBox(color: t.surface);
                      },
                    )
                  else
                    ColoredBox(color: t.surface),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.center,
                        colors: [
                          t.canvas.withValues(alpha: 0.8),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                  if (entry.watched)
                    _badge(t, Icons.replay_rounded, tr.t('Watched'))
                  else if (remaining != null)
                    _badge(t, Icons.play_arrow_rounded, remaining),
                  if (onRemove != null)
                    PositionedDirectional(
                      top: 6,
                      end: 6,
                      child: _RemoveButton(tokens: t, onRemove: onRemove!),
                    ),
                  if (entry.progress > 0)
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Container(
                        height: 4,
                        color: t.canvas.withValues(alpha: 0.4),
                        child: FractionallySizedBox(
                          widthFactor: entry.progress.clamp(0.0, 1.0),
                          alignment: Alignment.centerLeft,
                          child: ColoredBox(color: t.accent),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (_isEpisode) ...[
          Text(
            (entry.meta.name.isEmpty ? entry.meta.id : entry.meta.name)
                .toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
            ),
          ),
          Text(
            'S${entry.season} E${entry.episode}'
            '${epTitle != null ? ' - $epTitle' : ''}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ] else
          Text(
            entry.meta.name.isEmpty ? entry.meta.id : entry.meta.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        if (entry.watchedAt != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              relativeTime(entry.watchedAt, DateTime.now()),
              style: TextStyle(color: t.inkSubtle, fontSize: 11),
            ),
          ),
      ],
    );
  }

  Widget _badge(HarborTokens t, IconData icon, String label) =>
      PositionedDirectional(
        bottom: 8,
        start: 8,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: t.ink),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );

  String _remaining(Translations tr, int ms) {
    final mins = (ms / 60000).round();
    if (mins <= 0) return tr.t('Almost done');
    return tr.t('{n}m left', {'n': mins});
  }
}

class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.tokens, required this.onRemove});
  final HarborTokens tokens;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      focusColor: t.danger,
      onPressed: onRemove,
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.85),
          shape: BoxShape.circle,
          border: Border.all(color: t.edgeSoft),
        ),
        child: Icon(Icons.delete_outline_rounded, size: 15, color: t.inkMuted),
      ),
    );
  }
}
