import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/custom_lists.dart';
import '../../domain/search/search_multi.dart';

/// The inline "add a title to this list" search, ported 1:1 from the web
/// `AddTitleSearch`: a debounced TMDB multi-search (movies + series) whose hits
/// each carry an add / already-in-list affordance. Adding respects the
/// [kMaxListItems] cap and confirms with a toast.
class AddTitleSearch extends ConsumerStatefulWidget {
  const AddTitleSearch({super.key, required this.list, required this.tokens});

  final CustomList list;
  final HarborTokens tokens;

  @override
  ConsumerState<AddTitleSearch> createState() => _AddTitleSearchState();
}

class _AddTitleSearchState extends ConsumerState<AddTitleSearch> {
  final _controller = TextEditingController();
  Timer? _debounce;
  // Guards against a stale async result overwriting a newer query's results.
  int _gen = 0;
  String _query = '';
  bool _loading = false;
  SearchResults? _results;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    final q = value.trim();
    if (q.isEmpty) {
      // Bump the generation so any in-flight request can't paint stale hits.
      _gen++;
      setState(() {
        _results = null;
        _loading = false;
      });
      return;
    }
    setState(() => _loading = true);
    final gen = ++_gen;
    // Match the web's 260ms debounce before hitting the network.
    _debounce = Timer(const Duration(milliseconds: 260), () async {
      final client = ref.read(tmdbClientProvider);
      try {
        final r = await searchTmdbMulti(client, q);
        if (!mounted || gen != _gen) return;
        setState(() {
          _results = r;
          _loading = false;
        });
      } catch (_) {
        if (!mounted || gen != _gen) return;
        setState(() => _loading = false);
      }
    });
  }

  void _clear() {
    _controller.clear();
    _onChanged('');
  }

  List<MetaPreview> get _hits {
    final r = _results;
    if (r == null) return const [];
    return [...r.movies, ...r.series].take(24).toList();
  }

  Future<void> _add(Translations tr, MetaPreview m) async {
    // Read the live count (the widget's list can be a frame stale) so a full
    // list reports "full" rather than silently no-op'ing under the cap.
    final live =
        ref
            .read(customListsProvider)
            .where((l) => l.id == widget.list.id)
            .firstOrNull ??
        widget.list;
    final atMax = live.items.length >= kMaxListItems;
    final messenger = ScaffoldMessenger.of(context);
    if (atMax) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            tr.t('This list is full ({max} items)', {'max': kMaxListItems}),
          ),
        ),
      );
      return;
    }
    await ref
        .read(customListsProvider.notifier)
        .addTo(
          widget.list.id,
          m.id,
          type: m.type,
          name: m.name,
          poster: m.poster,
        );
    if (!mounted) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(tr.t('Added to "{name}"', {'name': widget.list.name})),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    // Re-read the live list so membership + count reflect just-added titles.
    final live =
        ref
            .watch(customListsProvider)
            .where((l) => l.id == widget.list.id)
            .firstOrNull ??
        widget.list;
    final memberIds = live.items.map((it) => it.id).toSet();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _field(t, tr),
        if (_query.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          _panel(t, tr, memberIds),
        ],
      ],
    );
  }

  Widget _field(HarborTokens t, Translations tr) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(Icons.search_rounded, size: 18, color: t.inkSubtle),
          const SizedBox(width: 8),
          Expanded(
            child: TvTextField(
              controller: _controller,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              style: TextStyle(color: t.ink, fontSize: 14),
              cursorColor: t.accent,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: tr.t('Add a movie or show to this list...'),
                hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
              ),
            ),
          ),
          if (_query.isNotEmpty)
            Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 999,
              onPressed: _clear,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Icon(Icons.close_rounded, size: 16, color: t.inkSubtle),
              ),
            ),
          const SizedBox(width: 6),
        ],
      ),
    );
  }

  Widget _panel(HarborTokens t, Translations tr, Set<String> memberIds) {
    final hits = _hits;
    Widget body;
    if (_loading && hits.isEmpty) {
      body = _note(t, tr.t('Searching...'));
    } else if (hits.isEmpty) {
      body = _note(t, tr.t('No matches. Try another title.'));
    } else {
      body = ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 360),
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 6),
          shrinkWrap: true,
          itemCount: hits.length,
          itemBuilder: (_, i) =>
              _row(t, tr, hits[i], memberIds.contains(hits[i].id)),
        ),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
      child: ClipRRect(borderRadius: BorderRadius.circular(16), child: body),
    );
  }

  Widget _note(HarborTokens t, String text) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 13)),
  );

  Widget _row(HarborTokens t, Translations tr, MetaPreview m, bool inList) {
    final year = m.releaseInfo == null || m.releaseInfo!.isEmpty
        ? null
        : m.releaseInfo!.substring(0, math.min(4, m.releaseInfo!.length));
    final kind = m.type == 'movie' ? tr.t('Movie') : tr.t('Series');
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 10,
      onPressed: inList ? () {} : () => _add(tr, m),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          children: [
            SizedBox(
              width: 36,
              height: 54,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: RpdbPosterImage(
                  metaId: m.id,
                  rawPoster: m.poster,
                  type: m.type,
                  tokens: t,
                  fallback: () => ColoredBox(color: t.elevated),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    m.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    year == null ? kind : '$kind · $year',
                    style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: inList ? null : Border.all(color: t.edge),
              ),
              child: Icon(
                inList ? Icons.check_rounded : Icons.add_rounded,
                size: 16,
                color: inList ? t.accent : t.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
