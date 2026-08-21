import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/stremio_addons_client.dart';
import 'community_row.dart';

/// The two API-sorted browse modes, ported from the web `mode: "top" | "new"`.
enum BrowseSortMode { top, newest }

const _newWindow = Duration(days: 14);

/// The infinite-scroll browse list for the top-rated and just-added modes,
/// ported 1:1 from `ApiSortedList`. Pages `listAddons` 50 at a time, de-duping
/// by uuid, resetting whenever the mode / category / search / adult filter
/// changes, and auto-loading as the user nears the bottom.
class ApiSortedList extends ConsumerStatefulWidget {
  const ApiSortedList({
    super.key,
    required this.mode,
    required this.category,
    required this.search,
    required this.allowAdult,
    required this.installedIds,
    required this.onOpen,
    this.onChange,
  });

  final BrowseSortMode mode;
  final String? category;
  final String? search;
  final bool allowAdult;
  final Set<String> installedIds;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  @override
  ConsumerState<ApiSortedList> createState() => _ApiSortedListState();
}

class _ApiSortedListState extends ConsumerState<ApiSortedList> {
  final _scroll = ScrollController();
  final _items = <SAAddon>[];
  final _seen = <String>{};
  bool _loading = false;
  int _page = 1;
  bool _exhausted = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMore());
  }

  @override
  void didUpdateWidget(ApiSortedList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mode != widget.mode ||
        oldWidget.category != widget.category ||
        oldWidget.search != widget.search ||
        oldWidget.allowAdult != widget.allowAdult) {
      _reset();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _reset() {
    setState(() {
      _items.clear();
      _seen.clear();
      _page = 1;
      _exhausted = false;
      _loading = false;
    });
    _loadMore();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 800) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _exhausted) return;
    setState(() => _loading = true);
    try {
      final res = await ref
          .read(stremioAddonsClientProvider)
          .listAddons(
            ListParams(
              page: _page,
              limit: 50,
              sortBy: widget.mode == BrowseSortMode.top ? 'stars' : 'createdAt',
              order: 'desc',
              nsfw: (widget.allowAdult || widget.category == 'nsfw')
                  ? null
                  : 'exclude',
              category: widget.category == null ? const [] : [widget.category!],
              search: widget.search,
            ),
          );
      final fresh = [
        for (final a in res.addons)
          if (_seen.add(a.uuid)) a,
      ];
      if (!mounted) return;
      setState(() {
        _items.addAll(fresh);
        if (!res.pagination.hasNextPage) {
          _exhausted = true;
        } else {
          _page++;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _exhausted = true);
    } finally {
      if (mounted) setState(() => _loading = false);
      // Auto-fill when the content is too short to scroll (the web's 800px
      // IntersectionObserver margin fires immediately on a short list).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _exhausted || _loading) return;
        if (_scroll.hasClients && _scroll.position.maxScrollExtent <= 800) {
          _loadMore();
        }
      });
    }
  }

  bool _isInstalled(SAAddon a) {
    final id = a.manifest?.id;
    return id != null && id.isNotEmpty && widget.installedIds.contains(id);
  }

  bool _isNewlyAdded(String createdAt) {
    final parsed = DateTime.tryParse(createdAt);
    return parsed != null && DateTime.now().difference(parsed) < _newWindow;
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    if (_items.isEmpty) {
      return _loading ? _skeletons(t) : const SizedBox.shrink();
    }
    final rising = ref.watch(risingProvider).value ?? const <SARisingAddon>[];

    return ListView.separated(
      controller: _scroll,
      // Clear the TV overscan crop so the footer isn't eaten by the bezel.
      padding: EdgeInsets.only(
        bottom: 24 + overscanInset(Idiom.of(context)).bottom,
      ),
      itemCount: _items.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        if (i == _items.length) return _footer(t);
        final a = _items[i];
        final entry = risingEntryFor(
          rising,
          uuid: a.uuid,
          slug: a.slug,
          manifestUrl: a.manifestUrl,
        );
        return CommunityRow(
          addon: a,
          installed: _isInstalled(a),
          showRising: entry != null,
          risingDelta: entry?.recentStars,
          risingWindow: 1,
          showNew:
              widget.mode == BrowseSortMode.newest &&
              _isNewlyAdded(a.createdAt),
          onOpen: widget.onOpen,
          onChange: widget.onChange,
        );
      },
    );
  }

  Widget _footer(HarborTokens t) {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: t.inkSubtle,
            ),
          ),
        ),
      );
    }
    if (_exhausted) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Text(
          "You've reached the end · ${_items.length} addons",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11.5, color: t.inkSubtle),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _skeletons(HarborTokens t) => ListView.separated(
    padding: const EdgeInsets.only(bottom: 24),
    itemCount: 6,
    separatorBuilder: (_, _) => const SizedBox(height: 8),
    itemBuilder: (_, _) => Container(
      height: 112,
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft),
      ),
    ),
  );
}
