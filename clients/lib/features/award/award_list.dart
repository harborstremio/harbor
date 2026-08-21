import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/awards_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/awards/award_page.dart';
import '../../domain/awards/awards_catalog.dart';
import '../../domain/awards/awards_history.dart';
import '../../domain/awards/wikidata_awards.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

/// The Award page "Full list" mode: the body's category winner history, with a
/// recipient/title search and decade filter. Ported from `award-list.tsx`.
class AwardList extends ConsumerStatefulWidget {
  const AwardList({
    super.key,
    required this.type,
    required this.tint,
    required this.tokens,
  });

  final AwardType type;
  final Color tint;
  final HarborTokens tokens;

  @override
  ConsumerState<AwardList> createState() => _AwardListState();
}

class _AwardListState extends ConsumerState<AwardList> {
  int? _decade;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final historyAsync = ref.watch(awardsHistoryProvider);
    final meta = kAwardCatalog[widget.type];
    if (meta == null) return const SizedBox.shrink();
    if (!historyAsync.hasValue) {
      return Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Center(
          child: CircularProgressIndicator(color: widget.tint, strokeWidth: 2),
        ),
      );
    }
    final history = historyAsync.value!.readAwardHistory(
      widget.type,
      meta.categories,
    );
    if (history.isEmpty) {
      return _prompt(t, 'No winners are catalogued for this award yet.');
    }

    final decades = <int>{
      for (final g in history)
        for (final e in g.entries) (e.year ~/ 10) * 10,
    }.toList()..sort((a, b) => b - a);

    final q = _controller.text.trim().toLowerCase();
    final filtered = [
      for (final group in history)
        (
          category: group.category,
          entries: [
            for (final e in group.entries)
              if (_matches(e, q)) e,
          ],
        ),
    ].where((g) => g.entries.isNotEmpty).toList();

    final isFiltered = _decade != null || q.isNotEmpty;
    final noResults = isFiltered && filtered.isEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterBar(t, decades),
        const SizedBox(height: 56),
        if (noResults)
          _prompt(t, 'No winners match these filters.')
        else
          for (final group in filtered) ...[
            _CategorySection(
              group: group,
              tint: widget.tint,
              tokens: t,
              onOpenWork: _openWork,
              onOpenPerson: _openPerson,
            ),
            const SizedBox(height: 56),
          ],
      ],
    );
  }

  bool _matches(CategoryWinner e, String q) {
    if (_decade != null && (e.year < _decade! || e.year >= _decade! + 10)) {
      return false;
    }
    if (q.isEmpty) return true;
    return e.workTitle.toLowerCase().contains(q) ||
        e.recipients.any((r) => r.toLowerCase().contains(q));
  }

  Future<void> _openWork(CategoryWinner e, bool preferTv) async {
    final client = ref.read(tmdbClientProvider);
    if (!client.hasKey) return;
    final hit = await resolveAwardWork(client, e.workTitle, e.year, preferTv);
    if (hit == null || !mounted) return;
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.meta, {
            'type': hit.type == 'movie' ? 'movie' : 'series',
            'id': 'tmdb:${hit.type}:${hit.id}',
          }),
        );
  }

  Future<void> _openPerson(String name) async {
    final client = ref.read(tmdbClientProvider);
    if (!client.hasKey) return;
    final id = await client.personIdByName(name);
    if (id == null || !mounted) return;
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.person, {'id': id}));
  }

  Widget _filterBar(HarborTokens t, List<int> decades) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Column(
      children: [
        Row(
          children: [
            Icon(Icons.search, size: 16, color: t.inkSubtle),
            const SizedBox(width: 12),
            Expanded(
              child: TvTextField(
                controller: _controller,
                onChanged: (_) => setState(() {}),
                style: TextStyle(color: t.ink, fontSize: 14.5),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  hintText: 'Search by recipient or title…',
                  hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14.5),
                ),
              ),
            ),
            if (_controller.text.isNotEmpty)
              Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 999,
                onPressed: () => setState(_controller.clear),
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Icon(Icons.close, size: 15, color: t.inkSubtle),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 32,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _decadePill(t, 'All years', _decade == null, () {
                  setState(() => _decade = null);
                }),
                for (final d in decades) ...[
                  const SizedBox(width: 6),
                  _decadePill(t, '${d}s', _decade == d, () {
                    setState(() => _decade = d);
                  }),
                ],
              ],
            ),
          ),
        ),
      ],
    ),
  );

  Widget _decadePill(
    HarborTokens t,
    String label,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: active ? widget.tint : Colors.transparent,
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

  Widget _prompt(HarborTokens t, String text) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 13.5)),
  );
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    required this.group,
    required this.tint,
    required this.tokens,
    required this.onOpenWork,
    required this.onOpenPerson,
  });

  final CategoryHistory group;
  final Color tint;
  final HarborTokens tokens;
  final Future<void> Function(CategoryWinner, bool) onOpenWork;
  final Future<void> Function(String) onOpenPerson;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final preferTv = isTvCategory(group.category.name);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                group.category.name,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 28,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.5,
                ),
              ),
            ),
            Text(
              group.entries.length == 1
                  ? '1 YEAR'
                  : '${group.entries.length} YEARS',
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 2.1,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        for (final e in group.entries)
          _WinnerRow(
            entry: e,
            tint: tint,
            tokens: t,
            preferTv: preferTv,
            onOpenWork: onOpenWork,
            onOpenPerson: onOpenPerson,
          ),
      ],
    );
  }
}

class _WinnerRow extends ConsumerWidget {
  const _WinnerRow({
    required this.entry,
    required this.tint,
    required this.tokens,
    required this.preferTv,
    required this.onOpenWork,
    required this.onOpenPerson,
  });

  final CategoryWinner entry;
  final Color tint;
  final HarborTokens tokens;
  final bool preferTv;
  final Future<void> Function(CategoryWinner, bool) onOpenWork;
  final Future<void> Function(String) onOpenPerson;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final hasKey = ref.watch(tmdbClientProvider).hasKey;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.55)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              '${entry.year}',
              style: TextStyle(
                color: tint,
                fontSize: 15,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                hasKey
                    ? Focusable(
                        tokens: t,
                        scale: 1.0,
                        borderRadius: 4,
                        onPressed: () => onOpenWork(entry, preferTv),
                        child: Text(
                          entry.workTitle,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            height: 1.2,
                          ),
                        ),
                      )
                    : Text(
                        entry.workTitle,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          height: 1.2,
                        ),
                      ),
                if (entry.recipients.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Wrap(
                    children: [
                      for (var i = 0; i < entry.recipients.length; i++) ...[
                        if (i > 0)
                          Text(
                            ', ',
                            style: TextStyle(color: t.inkSubtle, fontSize: 13),
                          ),
                        hasKey
                            ? Focusable(
                                tokens: t,
                                scale: 1.0,
                                borderRadius: 4,
                                onPressed: () =>
                                    onOpenPerson(entry.recipients[i]),
                                child: Text(
                                  entry.recipients[i],
                                  style: TextStyle(
                                    color: t.inkMuted,
                                    fontSize: 13,
                                  ),
                                ),
                              )
                            : Text(
                                entry.recipients[i],
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 13,
                                ),
                              ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (hasKey)
            Padding(
              padding: const EdgeInsets.only(top: 2, left: 8),
              child: Icon(Icons.north_east, size: 14, color: t.inkSubtle),
            ),
        ],
      ),
    );
  }
}
