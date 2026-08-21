import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_collection_provider.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/anilist/anilist_lists.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

/// A grouping of AniList statuses into a titled rail. Ported from the web
/// `RAIL_ORDER` in `use-anilist-anime-rails.ts`.
const _railOrder = <({String key, String title, List<String> statuses})>[
  (key: 'watching', title: 'Watching', statuses: ['CURRENT', 'REPEATING']),
  (key: 'planning', title: 'Plan to Watch', statuses: ['PLANNING']),
  (key: 'completed', title: 'Completed', statuses: ['COMPLETED']),
  (key: 'paused', title: 'On Hold', statuses: ['PAUSED']),
  (key: 'dropped', title: 'Dropped', statuses: ['DROPPED']),
];

/// The AniList status → label map and the picker order. Ported from
/// `STATUS_LABELS`/`STATUS_ORDER` in the web `anilist-entry-card.tsx`.
const _statusLabels = <String, String>{
  'CURRENT': 'Watching',
  'PLANNING': 'Plan to Watch',
  'COMPLETED': 'Completed',
  'REPEATING': 'Rewatching',
  'PAUSED': 'On Hold',
  'DROPPED': 'Dropped',
};

const _statusOrder = <String>[
  'CURRENT',
  'PLANNING',
  'COMPLETED',
  'REPEATING',
  'PAUSED',
  'DROPPED',
];

/// The three type filters. Ported from the web `TypeKey`.
enum _TypeKey { all, movie, series }

String _entryName(AnilistMediaEntry e) =>
    e.media.title.isNotEmpty ? e.media.title : '';

_TypeKey _entryType(AnilistMediaEntry e) =>
    e.media.format == 'MOVIE' ? _TypeKey.movie : _TypeKey.series;

/// The Library "AniList" tab — the signed-in user's anime lists, ported 1:1 from
/// the web `AnilistTab`: a type/search filter bar over status rails of entry
/// cards, each card editing status, progress, or removal against AniList.
class AnilistTab extends ConsumerStatefulWidget {
  const AnilistTab({super.key});

  @override
  ConsumerState<AnilistTab> createState() => _AnilistTabState();
}

class _AnilistTabState extends ConsumerState<AnilistTab> {
  _TypeKey _type = _TypeKey.all;
  String _query = '';
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<AnilistMediaEntry> _visible(List<AnilistMediaEntry> entries) {
    final q = _query.trim().toLowerCase();
    return [
      for (final e in entries)
        if ((_type == _TypeKey.all || _entryType(e) == _type) &&
            (q.isEmpty || _entryName(e).toLowerCase().contains(q)))
          e,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final state = ref.watch(anilistCollectionProvider);

    if (state.phase == AnilistCollectionPhase.loading) {
      return _Message(text: tr.t('Loading your AniList…'), tokens: t);
    }
    if (state.phase == AnilistCollectionPhase.error) {
      return _Message(
        text: tr.t("Couldn't reach AniList. Try refreshing."),
        tokens: t,
        danger: true,
      );
    }
    if (state.entries.isEmpty) {
      return _EmptyAnilist(tokens: t, tr: tr);
    }

    final visible = _visible(state.entries);
    final counts = (
      all: visible.length,
      movie: visible.where((e) => _entryType(e) == _TypeKey.movie).length,
      series: visible.where((e) => _entryType(e) == _TypeKey.series).length,
    );

    final sections = <Widget>[];
    for (final rail in _railOrder) {
      final items = [
        for (final e in visible)
          if (rail.statuses.contains(e.status)) e,
      ];
      if (items.isEmpty) continue;
      sections.add(
        _RailSection(title: tr.t(rail.title), items: items, tokens: t, tr: tr),
      );
    }

    return ListView(
      padding: EdgeInsets.only(
        bottom: 32 + overscanInset(Idiom.of(context)).bottom,
      ),
      children: [
        _FilterBar(
          type: _type,
          onType: (v) => setState(() => _type = v),
          query: _query,
          controller: _searchController,
          onQuery: (v) => setState(() => _query = v),
          counts: counts,
          tokens: t,
          tr: tr,
        ),
        const SizedBox(height: 28),
        if (sections.isEmpty)
          _Message(text: tr.t('No titles match your filters.'), tokens: t)
        else
          for (var i = 0; i < sections.length; i++) ...[
            if (i > 0) const SizedBox(height: 32),
            sections[i],
          ],
      ],
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.type,
    required this.onType,
    required this.query,
    required this.controller,
    required this.onQuery,
    required this.counts,
    required this.tokens,
    required this.tr,
  });

  final _TypeKey type;
  final ValueChanged<_TypeKey> onType;
  final String query;
  final TextEditingController controller;
  final ValueChanged<String> onQuery;
  final ({int all, int movie, int series}) counts;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _pill(
                t,
                tr.t('All'),
                counts.all,
                type == _TypeKey.all,
                () => onType(_TypeKey.all),
              ),
              _pill(
                t,
                tr.t('Movies'),
                counts.movie,
                type == _TypeKey.movie,
                () => onType(_TypeKey.movie),
              ),
              _pill(
                t,
                tr.t('Shows'),
                counts.series,
                type == _TypeKey.series,
                () => onType(_TypeKey.series),
              ),
            ],
          ),
        ),
        SizedBox(
          width: 280,
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
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide(color: t.edgeSoft),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide(color: t.edgeSoft),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide(color: t.accent, width: 2),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _pill(
    HarborTokens t,
    String label,
    int count,
    bool active,
    VoidCallback onTap,
  ) {
    return Focusable(
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
  }
}

class _RailSection extends StatelessWidget {
  const _RailSection({
    required this.title,
    required this.items,
    required this.tokens,
    required this.tr,
  });

  final String title;
  final List<AnilistMediaEntry> items;
  final HarborTokens tokens;
  final Translations tr;

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
              title,
              style: TextStyle(
                color: t.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '${items.length}',
              style: TextStyle(color: t.inkMuted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 16,
          runSpacing: 20,
          children: [
            for (final e in items)
              SizedBox(
                width: 158,
                child: _EntryCard(entry: e, tokens: t, tr: tr),
              ),
          ],
        ),
      ],
    );
  }
}

class _EntryCard extends ConsumerWidget {
  const _EntryCard({
    required this.entry,
    required this.tokens,
    required this.tr,
  });

  final AnilistMediaEntry entry;
  final HarborTokens tokens;
  final Translations tr;

  String get _metaId => entry.media.idMal != null
      ? 'mal:${entry.media.idMal}'
      : 'anilist:${entry.media.id}';

  String get _metaType => entry.media.format == 'MOVIE' ? 'movie' : 'series';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final busy = ref.watch(
      anilistCollectionProvider.select((s) => s.busy.contains(entry.entryId)),
    );
    final controller = ref.read(anilistCollectionProvider.notifier);
    final total = entry.media.episodes;
    final name = _entryName(entry);
    final atCeiling = total != null && entry.progress >= total;

    void openMeta() => ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.meta, {'type': _metaType, 'id': _metaId}));

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
                  onPressed: openMeta,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: RpdbPosterImage(
                      metaId: _metaId,
                      rawPoster: entry.media.coverImage,
                      type: _metaType,
                      tokens: t,
                      fallback: () => ColoredBox(color: t.elevated),
                    ),
                  ),
                ),
              ),
              PositionedDirectional(
                top: 6,
                end: 6,
                child: Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 999,
                  onPressed: busy
                      ? () {}
                      : () => controller.commitRemove(entry),
                  child: Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: t.canvas.withValues(alpha: 0.85),
                      shape: BoxShape.circle,
                      border: Border.all(color: t.edgeSoft),
                    ),
                    child: Icon(
                      Icons.delete_outline_rounded,
                      size: 15,
                      color: busy ? t.inkSubtle : t.inkMuted,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 6,
          onPressed: openMeta,
          child: Text(
            name.isEmpty ? tr.t('Untitled') : name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 8),
        _StatusButton(
          status: entry.status,
          disabled: busy,
          tokens: t,
          tr: tr,
          onPick: (s) => controller.commitStatus(entry, s),
        ),
        const SizedBox(height: 8),
        _ProgressStepper(
          progress: entry.progress,
          total: total,
          disabled: busy,
          atCeiling: atCeiling,
          tokens: t,
          tr: tr,
          onDelta: (d) => controller.commitProgress(entry, entry.progress + d),
        ),
      ],
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    required this.status,
    required this.disabled,
    required this.tokens,
    required this.tr,
    required this.onPick,
  });

  final String? status;
  final bool disabled;
  final HarborTokens tokens;
  final Translations tr;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final label = _statusLabels[status] ?? 'Watching';
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 10,
      onPressed: disabled
          ? () {}
          : () async {
              final picked = await _showStatusPicker(context, t, tr, status);
              if (picked != null && picked != status) onPick(picked);
            },
      child: Opacity(
        opacity: disabled ? 0.6 : 1,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  tr.t(label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.expand_more_rounded, size: 16, color: t.inkSubtle),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressStepper extends StatelessWidget {
  const _ProgressStepper({
    required this.progress,
    required this.total,
    required this.disabled,
    required this.atCeiling,
    required this.tokens,
    required this.tr,
    required this.onDelta,
  });

  final int progress;
  final int? total;
  final bool disabled;
  final bool atCeiling;
  final HarborTokens tokens;
  final Translations tr;
  final ValueChanged<int> onDelta;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          _step(
            t,
            Icons.remove_rounded,
            enabled: !disabled && progress > 0,
            onTap: () => onDelta(-1),
            leading: true,
          ),
          Expanded(
            child: Text(
              total != null ? '$progress / $total' : '$progress',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.ink, fontSize: 12.5),
            ),
          ),
          _step(
            t,
            Icons.add_rounded,
            enabled: !disabled && !atCeiling,
            onTap: () => onDelta(1),
            leading: false,
          ),
        ],
      ),
    );
  }

  Widget _step(
    HarborTokens t,
    IconData icon, {
    required bool enabled,
    required VoidCallback onTap,
    required bool leading,
  }) {
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 10,
      onPressed: enabled ? onTap : () {},
      child: Opacity(
        opacity: enabled ? 1 : 0.4,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 16, color: t.inkMuted),
        ),
      ),
    );
  }
}

class _EmptyAnilist extends StatelessWidget {
  const _EmptyAnilist({required this.tokens, required this.tr});
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.movie_filter_outlined, size: 42, color: t.inkSubtle),
          const SizedBox(height: 16),
          Text(
            tr.t('Your AniList is empty'),
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Text(
              tr.t(
                'Add anime to your AniList and they show up here, grouped by '
                'status and ready to edit.',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.text,
    required this.tokens,
    this.danger = false,
  });
  final String text;
  final HarborTokens tokens;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (danger) {
      return Align(
        alignment: Alignment.topLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: t.danger.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: t.danger.withValues(alpha: 0.3)),
          ),
          child: Text(text, style: TextStyle(color: t.danger, fontSize: 12.5)),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 13)),
    );
  }
}

/// A centered dialog listing the six AniList statuses — the remote-operable
/// replacement for the web's anchored dropdown. Returns the chosen status.
Future<String?> _showStatusPicker(
  BuildContext context,
  HarborTokens t,
  Translations tr,
  String? current,
) {
  return showDialog<String>(
    context: context,
    builder: (_) => Dialog(
      backgroundColor: t.raised,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < _statusOrder.length; i++)
                Builder(
                  builder: (context) {
                    final s = _statusOrder[i];
                    final selected = s == current;
                    return Focusable(
                      tokens: t,
                      scale: 1.0,
                      borderRadius: 10,
                      // Land the remote on the current status (or the first when
                      // none is set), like the season / playlist pickers.
                      autofocus: current != null ? selected : i == 0,
                      onPressed: () => Navigator.of(context).pop(s),
                      child: Container(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 1,
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? t.elevated.withValues(alpha: 0.6)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                tr.t(_statusLabels[s]!),
                                style: TextStyle(
                                  color: selected ? t.ink : t.inkMuted,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            if (selected)
                              Icon(Icons.check_rounded, size: 16, color: t.ink),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
