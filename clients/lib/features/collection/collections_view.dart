import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/collections_catalog.dart';
import '../../domain/catalog/collections_feed.dart';
import '../../domain/catalog/tmdb_collection.dart';
import '../home/collection_card.dart';
import '../../design/focus/tv_text_field.dart';

const String _feedQuery = 'collection';

/// The Collections browse screen, ported from `CollectionsView`: a curated grid
/// (category-filtered) plus a paginated "More {category}" feed, or a paginated
/// TMDB search across every collection. Backed by [tmdbSearchCollections] and
/// [categoryFeedPull].
class CollectionsView extends ConsumerStatefulWidget {
  const CollectionsView({super.key});

  @override
  ConsumerState<CollectionsView> createState() => _CollectionsViewState();
}

class _CollectionsViewState extends ConsumerState<CollectionsView> {
  final _searchController = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  String _query = '';
  String _category = 'All';

  // Remote search / default-collection feed.
  List<CollectionHit> _hits = [];
  int _searchPage = 0;
  bool _searchDone = false;
  bool _searchLoading = false;
  int _epoch = 0;

  // Category "More {category}" feed.
  List<CategoryHit> _catHits = [];
  int _catPage = 0;
  final Set<int> _catSeen = {};
  bool _catDone = false;
  bool _catLoading = false;

  late final Set<String> _curatedNames = {
    for (final c in kCollectionsCatalog) c.name.toLowerCase(),
  };

  bool get _searchActive => _query.trim().length >= 2;
  String get _remoteQuery =>
      _searchActive ? _query.trim() : (_category == 'All' ? _feedQuery : '');
  bool get _catActive => !_searchActive && _category != 'All';

  List<CatalogCollection> get _curated => _category == 'All'
      ? kCollectionsCatalog
      : kCollectionsCatalog.where((c) => c.cats.contains(_category)).toList();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _resetAndLoad());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final p = _scroll.position;
    if (p.pixels < p.maxScrollExtent - 1200) return;
    if (_remoteQuery.isNotEmpty) {
      _loadRemote();
    } else if (_catActive) {
      _loadCat();
    }
  }

  void _onQueryChanged(String v) {
    setState(() => _query = v);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _resetAndLoad);
  }

  void _selectCategory(String c) {
    if (c == _category) return;
    setState(() => _category = c);
    _resetAndLoad();
  }

  void _resetAndLoad() {
    setState(() {
      _epoch++;
      _hits = [];
      _searchPage = 0;
      _searchDone = _remoteQuery.isEmpty;
      _searchLoading = false;
      _catHits = [];
      _catPage = 0;
      _catSeen.clear();
      _catDone = !_catActive;
      _catLoading = false;
    });
    if (_remoteQuery.isNotEmpty) {
      _loadRemote();
    } else if (_catActive) {
      _loadCat();
    }
  }

  Future<void> _loadRemote() async {
    if (_searchDone || _searchLoading || _remoteQuery.isEmpty) return;
    setState(() => _searchLoading = true);
    final epoch = _epoch;
    final next = _searchPage + 1;
    final client = ref.read(tmdbClientProvider);
    CollectionFeed feed;
    try {
      feed = await tmdbSearchCollections(client, _remoteQuery, page: next);
    } catch (_) {
      feed = const CollectionFeed(hits: [], totalPages: 0);
    }
    if (!mounted || epoch != _epoch) return;
    final seen = _hits.map((h) => h.id).toSet();
    final fresh = feed.hits.where(
      (h) =>
          !seen.contains(h.id) &&
          !(_remoteQuery == _feedQuery &&
              _curatedNames.contains(
                stripCollectionSuffix(h.name).toLowerCase(),
              )),
    );
    setState(() {
      _searchPage = next;
      if (feed.hits.isEmpty || next >= feed.totalPages) _searchDone = true;
      _hits = [..._hits, ...fresh];
      _searchLoading = false;
    });
  }

  Future<void> _loadCat() async {
    if (_catDone || _catLoading) return;
    setState(() => _catLoading = true);
    final epoch = _epoch;
    final client = ref.read(tmdbClientProvider);
    final pull = await categoryFeedPull(
      client,
      category: _category,
      fromPage: _catPage,
      seen: _catSeen,
      excludeNames: _curatedNames,
    );
    if (!mounted || epoch != _epoch) return;
    setState(() {
      _catPage = pull.nextPage;
      _catHits = [..._catHits, ...pull.hits];
      if (pull.exhausted) _catDone = true;
      _catLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    return ColoredBox(
      color: t.canvas,
      child: SingleChildScrollView(
        controller: _scroll,
        padding: EdgeInsets.fromLTRB(g, 40, g, 64),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Collections',
              style: TextStyle(
                color: t.ink,
                fontSize: idiom.isPhone ? 32 : 44,
                fontWeight: FontWeight.w500,
                height: 1.02,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              "Every saga in one place. Search anything: if it exists, it's here.",
              style: TextStyle(color: t.inkMuted, fontSize: 13.5),
            ),
            const SizedBox(height: 28),
            _filterBar(t),
            const SizedBox(height: 28),
            if (!_searchActive) ...[
              _curatedSection(t),
              if (_catActive) ...[const SizedBox(height: 40), _catSection(t)],
            ],
            if (_remoteQuery.isNotEmpty) ...[
              const SizedBox(height: 40),
              _remoteSection(t),
            ],
          ],
        ),
      ),
    );
  }

  Widget _filterBar(HarborTokens t) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 460,
          child: TvTextField(
            controller: _searchController,
            onChanged: _onQueryChanged,
            style: TextStyle(color: t.ink, fontSize: 14),
            cursorColor: t.accent,
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Search every collection on TMDB…',
              hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
              prefixIcon: Icon(Icons.search, color: t.inkSubtle, size: 18),
              filled: true,
              fillColor: t.elevated,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(color: t.edge),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(color: t.edge),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide(color: t.accent, width: 2),
              ),
            ),
          ),
        ),
        if (!_searchActive) ...[
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in ['All', ...kCollectionCategories])
                _CategoryChip(
                  label: c,
                  selected: c == _category,
                  autofocus: c == 'All',
                  tokens: t,
                  onPressed: () => _selectCategory(c),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _sectionLabel(String text, HarborTokens t) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Text(text, style: TextStyle(color: t.inkSubtle, fontSize: 13)),
  );

  /// The collection card grid — a Wrap of 320px cards on wide panes, dropping to
  /// two columns on a phone-width pane so the cards never overrun the screen.
  Widget _grid(
    HarborTokens t,
    List<({int id, String name, String? backdrop, int? count})> items,
  ) => LayoutBuilder(
    builder: (context, c) {
      final cardW = c.maxWidth < 560 ? (c.maxWidth - 20) / 2 : 320.0;
      return Wrap(
        spacing: 20,
        runSpacing: 20,
        children: [
          for (final it in items)
            CollectionCard(
              id: it.id,
              name: it.name,
              knownBackdrop: it.backdrop,
              knownCount: it.count,
              width: cardW,
              tokens: t,
            ),
        ],
      );
    },
  );

  Widget _curatedSection(HarborTokens t) {
    final curated = _curated;
    final label = _category == 'All' ? 'Featured' : _category;
    final unit = curated.length == 1 ? 'collection' : 'collections';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('$label · ${curated.length} $unit', t),
        _grid(t, [
          for (final c in curated)
            (id: c.id, name: c.name, backdrop: null, count: null),
        ]),
      ],
    );
  }

  Widget _catSection(HarborTokens t) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('More $_category', t),
        if (_catHits.isNotEmpty)
          _grid(t, [
            for (final h in _catHits)
              (id: h.id, name: h.name, backdrop: h.backdrop, count: h.count),
          ]),
        _footer(
          loading: _catLoading,
          done: _catDone,
          doneText: _catHits.isNotEmpty
              ? "That's every $_category collection we could find."
              : 'No more found for this category.',
          tokens: t,
        ),
      ],
    );
  }

  Widget _remoteSection(HarborTokens t) {
    final label = _searchActive
        ? (_hits.isEmpty && _searchDone
              ? "Nothing matched. Try the franchise's first film name."
              : 'Results for "${_query.trim()}"')
        : 'Every collection';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel(label, t),
        _grid(t, [
          for (final h in _hits)
            (
              id: h.id,
              name: stripCollectionSuffix(h.name),
              backdrop: h.backdrop,
              count: null,
            ),
        ]),
        _footer(
          loading: _searchLoading,
          done: _searchDone && _hits.isNotEmpty,
          doneText: "That's every collection TMDB knows about.",
          tokens: t,
        ),
      ],
    );
  }

  Widget _footer({
    required bool loading,
    required bool done,
    required String doneText,
    required HarborTokens tokens,
  }) {
    if (loading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              color: tokens.accent,
              strokeWidth: 2,
            ),
          ),
        ),
      );
    }
    if (done) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Text(
            doneText,
            style: TextStyle(color: tokens.inkSubtle, fontSize: 12.5),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.autofocus,
    required this.tokens,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final bool autofocus;
  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      autofocus: autofocus,
      borderRadius: 20,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? t.ink : t.elevated,
          border: Border.all(color: selected ? t.ink : t.edgeSoft),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? t.canvas : t.inkMuted,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
