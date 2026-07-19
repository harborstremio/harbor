import 'dart:async';
import 'dart:math';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/feed_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/feed/feed_locale.dart';
import '../../domain/feed/feed_pool.dart';
import '../../domain/feed/feed_rank.dart';
import '../../domain/feed/feed_skipped.dart';
import 'feed_hero.dart';

/// The active card's leave direction, driving the transition-out animation.
enum _LeaveAnim { skip, block, back }

/// The queue's last active id, kept across mounts so returning to the tab lands
/// on the same card. Mirrors the web module-level `savedActiveId`.
String? _savedActiveId;

/// Clears the remembered active id so each test starts on the first pick.
@visibleForTesting
void resetQueueActiveId() => _savedActiveId = null;

const _lowWaterMark = 6;

/// The Discovery Queue — a one-at-a-time, swipeable feed of taste-ranked picks.
/// Ported 1:1 from `views/queue.tsx`: the pool is filtered against the skip/
/// block memory and the feed votes, shuffled and affinity-ranked once on entry,
/// then extended as it runs low. Skipping snoozes a title, "not interested"
/// blocks it, and saving to the watchlist quietly retires it.
class QueueView extends ConsumerStatefulWidget {
  const QueueView({super.key, @visibleForTesting this.rng});

  /// The shuffle source, injectable so tests can pin the queue order. Null in
  /// production, where each visit reshuffles freshly.
  final Random? rng;

  @override
  ConsumerState<QueueView> createState() => _QueueViewState();
}

class _QueueViewState extends ConsumerState<QueueView> {
  List<FeedItem> _pool = [];
  bool _loading = true;
  String? _activeId;
  _LeaveAnim? _leaveAnim;
  int _extensionPage = 2;
  bool _extending = false;

  final ScrollController _strip = ScrollController();

  @override
  void initState() {
    super.initState();
    _activeId = _savedActiveId;
    _load();
  }

  @override
  void dispose() {
    _strip.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final pool = await ref.read(feedPoolProvider.future);
      if (!mounted) return;
      final prefs = ref.read(feedPreferencesStoreProvider);
      final blocked = {...prefs.downvotedIds(), ...prefs.upvotedIds()};
      final skipped = ref.read(feedSkippedStoreProvider);
      // Drop already-watched titles (by id or normalized name), matching the
      // web queue's `!isWatched` filter — the queue is titles still to decide.
      final watched = ref.read(recentlyPlayedProvider);
      final filtered = [
        for (final it in skipped.filterPool(pool))
          if (!blocked.contains(it.meta.id) &&
              !watched.contains(it.meta.id, it.meta.name))
            it,
      ];
      final ranked = rankByAffinity(
        shuffleQueuePool(filtered, rng: widget.rng),
        ref.read(affinityStoreProvider).affinity(),
        localeWeights(ref.read(settingsProvider)),
      );
      setState(() {
        _pool = ranked;
        _loading = false;
      });
      _maybeExtend();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pool = [];
        _loading = false;
      });
    }
  }

  int get _activeIndex {
    final id = _activeId;
    if (id != null) {
      final i = _pool.indexWhere((p) => p.meta.id == id);
      if (i >= 0) return i;
    }
    return 0;
  }

  FeedItem? get _item =>
      _activeIndex < _pool.length ? _pool[_activeIndex] : null;

  void _setActiveId(String? id) {
    _savedActiveId = id;
    if (mounted) setState(() => _activeId = id);
    _maybeExtend();
  }

  String? _nextIdAfterRemoval() {
    final i = _activeIndex;
    if (i + 1 < _pool.length) return _pool[i + 1].meta.id;
    if (i - 1 >= 0) return _pool[i - 1].meta.id;
    return null;
  }

  void _jump(int i, {_LeaveAnim? direction}) {
    if (i < 0 || i >= _pool.length || _leaveAnim != null) return;
    final next = _pool[i];
    if (direction != null) {
      setState(() => _leaveAnim = direction);
      Timer(const Duration(milliseconds: 200), () {
        if (!mounted) return;
        setState(() => _leaveAnim = null);
        _setActiveId(next.meta.id);
      });
    } else {
      _setActiveId(next.meta.id);
    }
  }

  void _removeAfter(String id, Duration delay, {_LeaveAnim? anim}) {
    final nextId = _nextIdAfterRemoval();
    if (anim != null) setState(() => _leaveAnim = anim);
    Timer(delay, () {
      if (!mounted) return;
      setState(() {
        _pool = [
          for (final it in _pool)
            if (it.meta.id != id) it,
        ];
        _leaveAnim = null;
      });
      _setActiveId(nextId);
    });
  }

  void _onSkip() {
    final item = _item;
    if (item == null || _leaveAnim != null) return;
    final id = item.meta.id;
    ref.read(feedSkippedStoreProvider).snooze(id);
    _removeAfter(id, const Duration(milliseconds: 200), anim: _LeaveAnim.skip);
  }

  void _onNotInterested() {
    final item = _item;
    if (item == null || _leaveAnim != null) return;
    final id = item.meta.id;
    ref.read(feedSkippedStoreProvider).block(id);
    _removeAfter(id, const Duration(milliseconds: 240), anim: _LeaveAnim.block);
  }

  void _onPrev() {
    if (_activeIndex > 0) _jump(_activeIndex - 1, direction: _LeaveAnim.back);
  }

  void _onNext() {
    if (_activeIndex < _pool.length - 1) {
      _jump(_activeIndex + 1, direction: _LeaveAnim.skip);
    }
  }

  /// Pulls the next feed page in when the runway drops below the low-water mark.
  void _maybeExtend() {
    if (_loading || _extending) return;
    if (!ref.read(tmdbClientProvider).hasKey) return;
    if (_pool.length - _activeIndex - 1 > _lowWaterMark) return;
    _extending = true;
    final page = _extensionPage;
    _extensionPage = page + 1;
    unawaited(() async {
      try {
        final more = await ref.read(feedPoolPageProvider(page).future);
        if (!mounted) return;
        final existing = _pool.map((p) => p.meta.id).toSet();
        final fresh = [
          for (final m in more)
            if (!existing.contains(m.meta.id)) m,
        ];
        final filtered = ref.read(feedSkippedStoreProvider).filterPool(fresh);
        if (filtered.isEmpty) return;
        setState(
          () => _pool = [
            ..._pool,
            ...shuffleQueuePool(filtered, rng: widget.rng),
          ],
        );
      } finally {
        _extending = false;
      }
    }());
  }

  void _scrollStripToActive() {
    if (!_strip.hasClients) return;
    const itemExtent = 212.0; // 200 wide + 12 gap
    final viewport = _strip.position.viewportDimension;
    final target = (_activeIndex * itemExtent) - viewport / 2 + itemExtent / 2;
    _strip.animateTo(
      target.clamp(0.0, _strip.position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final item = _item;

    // Saving the active title to the watchlist quietly retires it from the
    // queue, mirroring the web's `useInWatchlist` effect.
    ref.listen<Set<String>>(watchlistProvider, (prev, next) {
      final current = _item;
      if (current == null) return;
      final id = current.meta.id;
      final was = prev?.contains(id) ?? false;
      if (!was && next.contains(id)) {
        ref.read(feedSkippedStoreProvider).snooze(id);
        _removeAfter(id, const Duration(milliseconds: 120));
      }
    });

    final total = _pool.length;
    final statusLabel = _loading
        ? 'Loading…'
        : '${(_activeIndex + 1).clamp(1, total == 0 ? 1 : total).toString().padLeft(2, '0')}'
              ' / ${total.toString().padLeft(2, '0')}';

    final idiom = Idiom.of(context);
    final phone = idiom.isPhone;

    return Container(
      color: t.canvas,
      padding: EdgeInsets.only(top: phone ? 28 : 80, bottom: phone ? 24 : 48),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: pageGutter(idiom)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flexible(
                      child: Text(
                        'Discovery Queue',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 12,
                          letterSpacing: 2.4,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 600),
                    child: item != null
                        ? _heroStage(t, item)
                        : _QueueSkeleton(
                            loading: _loading,
                            hasKey: ref.watch(tmdbClientProvider).hasKey,
                            tokens: t,
                          ),
                  ),
                ),
                if (_pool.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _stripBar(t),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heroStage(HarborTokens t, FeedItem item) {
    final anim = _leaveAnim;
    final offset = switch (anim) {
      _LeaveAnim.skip => const Offset(0.06, 0),
      _LeaveAnim.back => const Offset(-0.06, 0),
      _ => Offset.zero,
    };
    final scale = anim == _LeaveAnim.block ? 0.98 : 1.0;
    final duration = Duration(
      milliseconds: anim == _LeaveAnim.block ? 240 : 200,
    );
    return Stack(
      children: [
        Positioned.fill(
          child: AnimatedSlide(
            offset: offset,
            duration: duration,
            curve: Curves.easeOut,
            child: AnimatedScale(
              scale: scale,
              duration: duration,
              curve: Curves.easeOut,
              child: AnimatedOpacity(
                opacity: anim != null ? 0.0 : 1.0,
                duration: duration,
                curve: Curves.easeOut,
                child: FeedHero(
                  item: item,
                  position: _activeIndex,
                  total: _pool.length,
                  onSkip: _onSkip,
                  onNotInterested: _onNotInterested,
                ),
              ),
            ),
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: _NavArrow(
            tokens: t,
            icon: Icons.chevron_left,
            disabled: _activeIndex == 0 || anim != null,
            onPressed: _onPrev,
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: _NavArrow(
            tokens: t,
            icon: Icons.chevron_right,
            disabled: _activeIndex >= _pool.length - 1 || anim != null,
            onPressed: _onNext,
          ),
        ),
      ],
    );
  }

  Widget _stripBar(HarborTokens t) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollStripToActive());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'QUEUE',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 2.6,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 112,
          child: ListView.separated(
            controller: _strip,
            scrollDirection: Axis.horizontal,
            itemCount: _pool.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _stripTile(t, i),
          ),
        ),
      ],
    );
  }

  Widget _stripTile(HarborTokens t, int i) {
    final it = _pool[i];
    final active = i == _activeIndex;
    final past = i < _activeIndex;
    final art = it.meta.background ?? it.meta.poster;
    return Opacity(
      opacity: past ? 0.5 : 1.0,
      child: Focusable(
        tokens: t,
        borderRadius: 10,
        onPressed: () => _jump(i),
        child: SizedBox(
          width: 200,
          height: 112,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: art != null
                    ? CachedNetworkImage(imageUrl: art, fit: BoxFit.cover)
                    : ColoredBox(color: t.elevated),
              ),
              if (active)
                DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: t.accent, width: 2),
                    color: t.accent.withValues(alpha: 0.22),
                  ),
                ),
              Positioned(
                left: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: t.canvas.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    it.tag.toUpperCase(),
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A circular previous/next control overlaid on the hero's left/right edge.
class _NavArrow extends StatelessWidget {
  const _NavArrow({
    required this.tokens,
    required this.icon,
    required this.disabled,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final IconData icon;
  final bool disabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    if (disabled) {
      return Opacity(opacity: 0.25, child: _circle(tokens, icon));
    }
    return Focusable(
      tokens: tokens,
      borderRadius: 999,
      onPressed: onPressed,
      child: _circle(tokens, icon),
    );
  }

  Widget _circle(HarborTokens t, IconData icon) => Container(
    height: 44,
    width: 44,
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.8),
      shape: BoxShape.circle,
      border: Border.all(color: t.ink.withValues(alpha: 0.12)),
    ),
    child: Icon(icon, size: 20, color: t.ink.withValues(alpha: 0.75)),
  );
}

/// The empty-state card: loading, no-key, or nothing-loaded.
class _QueueSkeleton extends StatelessWidget {
  const _QueueSkeleton({
    required this.loading,
    required this.hasKey,
    required this.tokens,
  });

  final bool loading;
  final bool hasKey;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final message = loading
        ? "Building tonight's queue…"
        : !hasKey
        ? 'Add a TMDB key in Settings to unlock the full discovery feed.'
        : 'No picks loaded. TMDB might be unreachable.';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.elevated.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 64),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: tokens.inkMuted, fontSize: 15, height: 1.5),
          ),
        ),
      ),
    );
  }
}
