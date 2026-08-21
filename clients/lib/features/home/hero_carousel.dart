import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/cinemeta.dart' show cinemetaBase;
import '../../domain/catalog/hero_slide.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/catalog/tmdb_details.dart' show tmdbLogo;
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

/// The left-to-right hero scrim opacity from the `heroShadow` setting (a 0–100
/// slider), matching `opacity: settings.heroShadow / 100` in `hero.tsx`.
double heroShadowOpacity(int heroShadow) => (heroShadow / 100).clamp(0.0, 1.0);

/// The title clear-logo for a hero slide whose meta carries none — resolved from
/// TMDB (`tmdbLogo`, localized) for `tmdb:` ids or the Cinemeta meta for `tt`
/// ids. Ports the web hero `resolveLogo`, so a trending TMDB title shows its
/// stylized logo instead of plain text. Null (→ text) without a match or key.
final heroLogoProvider =
    FutureProvider.family<String?, ({String id, String type})>((ref, k) async {
      if (k.id.startsWith('tmdb:')) {
        return tmdbLogo(ref.watch(tmdbClientProvider), k.id);
      }
      if (k.id.startsWith('tt')) {
        final r = await ref
            .watch(addonClientProvider)
            .meta(cinemetaBase, k.type, k.id);
        final logo = r.valueOrNull?.logo;
        return (logo != null && logo.isNotEmpty) ? logo : null;
      }
      return null;
    });

/// The Home hero carousel, ported 1:1 from `src/components/hero-carousel.tsx` +
/// `hero.tsx`: up to 4 auto-advancing (13s) slides, each with backdrop, rank
/// pill, logo/title plate, overview, stat line, Play + Watchlist buttons, and a
/// focusable dot pager for remote slide selection.
class HeroCarousel extends ConsumerStatefulWidget {
  const HeroCarousel({
    super.key,
    this.source,
    this.overrideSlides,
    this.eyebrow,
  });

  /// The slides source. Defaults to the Home hero; the Movies/Shows catalogs
  /// pass their own catalog-hero provider.
  final FutureProvider<List<HeroSlide>>? source;

  /// Pre-built slides that win over [source]/the default provider — the Home
  /// uses this to feed the hero from a user-chosen "feature in hero" row
  /// (`homeRows.heroSource`).
  final List<HeroSlide>? overrideSlides;

  /// A section eyebrow shown in place of the rank pill — the Movies/Shows
  /// catalogs pass "Featured tonight" (web `<CinemaHero eyebrow=…>`); Home /
  /// Discover leave it null to keep the "#N Today" rank pill.
  final String? eyebrow;

  @override
  ConsumerState<HeroCarousel> createState() => _HeroCarouselState();
}

const _advance = Duration(seconds: 13);

class _HeroCarouselState extends ConsumerState<HeroCarousel>
    with WidgetsBindingObserver {
  int _active = 0;
  Timer? _timer;
  int _slideCount = 0;
  bool _focusHeld = false;
  bool _appActive = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Pause the auto-advance while the app is backgrounded/inactive (web pauses
    // on tab-hidden) — otherwise slides keep swapping unseen and burn cycles,
    // and the hero would be on a random slide when the viewer returns.
    final active = state == AppLifecycleState.resumed;
    if (active == _appActive) return;
    _appActive = active;
    if (active) {
      _restartTimer();
    } else {
      _timer?.cancel();
    }
  }

  void _restartTimer() {
    _timer?.cancel();
    // Don't auto-advance while the remote is parked on a hero control (incl. a
    // dot-pager tap that also calls this) — the slide would swap under the
    // viewer. _pauseForFocus resumes it once focus leaves the hero. Also held
    // while the app is backgrounded (didChangeAppLifecycleState).
    if (_slideCount < 2 || _focusHeld || !_appActive) return;
    _timer = Timer.periodic(_advance, (_) {
      if (mounted) setState(() => _active = (_active + 1) % _slideCount);
    });
  }

  void _go(int i) {
    setState(() => _active = i);
    _restartTimer();
  }

  // Pointer swipe (touch/mouse) to change slides — TV uses the D-pad + dots.
  double _dragDx = 0;

  void _onDragStart(DragStartDetails _) {
    _timer?.cancel();
    _dragDx = 0;
  }

  void _onDragUpdate(DragUpdateDetails d) => _dragDx += d.delta.dx;

  void _onDragEnd(DragEndDetails d) {
    if (_slideCount < 2) {
      _restartTimer();
      return;
    }
    // Commit on either a decisive distance or a flick velocity; otherwise snap
    // back and resume autoplay. Swipe left → next, right → previous.
    final v = d.velocity.pixelsPerSecond.dx;
    if (_dragDx <= -48 || v <= -320) {
      _go((_active + 1) % _slideCount);
    } else if (_dragDx >= 48 || v >= 320) {
      _go((_active - 1 + _slideCount) % _slideCount);
    } else {
      _restartTimer();
    }
  }

  /// Pauses the auto-advance while the remote is parked on a hero control (so
  /// the Play/Watchlist target doesn't swap out from under a lean-back viewer)
  /// and resumes it once focus leaves the hero.
  void _pauseForFocus(bool hasFocus) {
    _focusHeld = hasFocus;
    if (hasFocus) {
      _timer?.cancel();
    } else {
      _restartTimer();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final settings = ref.watch(settingsProvider);
    final full = settings.getBool('heroFull');
    final fullQuality = settings.getBool('heroFullQuality');
    final async = widget.overrideSlides != null
        ? AsyncValue<List<HeroSlide>>.data(widget.overrideSlides!)
        : ref.watch(widget.source ?? heroSlidesProvider);
    final height = full
        ? (MediaQuery.of(context).size.height * 0.82).clamp(560.0, 920.0)
        : 560.0;

    return async.when(
      loading: () => _skeleton(t, height, full),
      error: (_, _) => const SizedBox.shrink(),
      data: (slides) {
        if (slides.isEmpty) return const SizedBox.shrink();
        if (slides.length != _slideCount) {
          _slideCount = slides.length;
          if (_active >= _slideCount) _active = 0;
          WidgetsBinding.instance.addPostFrameCallback((_) => _restartTimer());
        }
        final slide = slides[_active];
        final card = SizedBox(
          height: height,
          child: _HeroSlideCard(
            slide: slide,
            tokens: t,
            full: full,
            fullQuality: fullQuality,
            slideCount: slides.length,
            activeIndex: _active,
            onSelectSlide: _go,
            eyebrow: widget.eyebrow,
          ),
        );
        // Swipe to change slides on touch/pointer idioms; a TV drives the hero
        // with the D-pad + dot pager, so it keeps the plain card (no drag).
        final body = Idiom.of(context).isTv
            ? card
            : GestureDetector(
                onHorizontalDragStart: _onDragStart,
                onHorizontalDragUpdate: _onDragUpdate,
                onHorizontalDragEnd: _onDragEnd,
                child: card,
              );
        return Focus(
          canRequestFocus: false,
          skipTraversal: true,
          onFocusChange: _pauseForFocus,
          child: Padding(
            padding: EdgeInsets.fromLTRB(full ? 0 : 20, 0, full ? 0 : 20, 8),
            child: body,
          ),
        );
      },
    );
  }

  Widget _skeleton(HarborTokens t, double height, bool full) => Padding(
    padding: EdgeInsets.fromLTRB(full ? 0 : 20, 0, full ? 0 : 20, 8),
    child: Container(
      height: height,
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.3),
        borderRadius: full ? null : BorderRadius.circular(28),
        border: Border.all(color: t.edgeSoft),
      ),
    ),
  );
}

class _HeroSlideCard extends ConsumerWidget {
  const _HeroSlideCard({
    required this.slide,
    required this.tokens,
    required this.full,
    required this.fullQuality,
    required this.slideCount,
    required this.activeIndex,
    required this.onSelectSlide,
    this.eyebrow,
  });

  final HeroSlide slide;
  final HarborTokens tokens;
  final bool full;
  final bool fullQuality;
  final int slideCount;
  final int activeIndex;
  final void Function(int) onSelectSlide;
  final String? eyebrow;

  void _openDetail(WidgetRef ref) => ref
      .read(navControllerProvider.notifier)
      .push(
        Frame(FrameKind.meta, {'type': slide.meta.type, 'id': slide.meta.id}),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = slide.meta;
    final phone = Idiom.of(context).isPhone;
    final inWatchlist = ref.watch(watchlistProvider).contains(meta.id);
    final heroShadow = ref.watch(settingsProvider).getInt('heroShadow');
    final radius = full ? BorderRadius.zero : BorderRadius.circular(28);
    // The hero always upsizes its w780 backdrop to w1280, or to `original` when
    // heroFullQuality is on (`upsizeTmdb`). A slide with no backdrop falls back to
    // its poster (web hero.tsx: `bg = bgUrl ? upsize(bgUrl) : poster`), so a
    // poster-only hero-source title still shows artwork instead of a blank.
    final backdrop =
        upsizeTmdb(meta.background, full: fullQuality) ?? meta.poster;
    return ClipRRect(
      borderRadius: radius,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (backdrop != null)
            Opacity(
              opacity: 0.9,
              child: CachedNetworkImage(imageUrl: backdrop, fit: BoxFit.cover),
            ),
          // Left-to-right scrim, faded by the heroShadow setting.
          Opacity(
            opacity: heroShadowOpacity(heroShadow),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    tokens.canvas,
                    tokens.canvas.withValues(alpha: 0.85),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.5, 1],
                ),
              ),
            ),
          ),
          // Bottom scrim.
          Align(
            alignment: Alignment.bottomCenter,
            child: FractionallySizedBox(
              heightFactor: 0.4,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      tokens.canvas,
                      tokens.canvas.withValues(alpha: 0.7),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.5, 1],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              phone ? 20 : 56,
              full ? 112 : 56,
              phone ? 20 : 56,
              56,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                // The web hero centers its content in a fixed-height card with
                // `overflow-hidden` (`hero.tsx`: `flex flex-col justify-center
                // h-full` inside an `overflow-hidden` card), so on a narrow
                // phone — where the buttons wrap and the overview runs three
                // lines — the tall column silently clips top and bottom rather
                // than reflowing. This OverflowBox reproduces that: it relaxes
                // the vertical constraint so the centered column keeps its
                // intrinsic height, and the surrounding ClipRRect does the clip.
                child: OverflowBox(
                  minHeight: 0,
                  maxHeight: double.infinity,
                  alignment: Alignment.centerLeft,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (eyebrow != null)
                        _eyebrowLabel(eyebrow!)
                      else
                        _rankPill(ref.watch(translationsProvider)),
                      const SizedBox(height: 20),
                      _titlePlate(ref, phone),
                      if (meta.description != null) ...[
                        const SizedBox(height: 20),
                        Text(
                          meta.description!,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: tokens.inkMuted,
                            fontSize: 16,
                            height: 1.5,
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      _statLine(
                        ref.watch(translationsProvider),
                        ref.watch(settingsProvider).getBool('showImdbBadge'),
                      ),
                      const SizedBox(height: 28),
                      _buttons(ref, inWatchlist, phone),
                      if (slideCount > 1) ...[
                        const SizedBox(height: 24),
                        _dots(),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// The section eyebrow shown in place of the rank pill (web CinemaHero).
  Widget _eyebrowLabel(String text) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: tokens.inkSubtle,
      fontSize: 12,
      letterSpacing: 3,
      fontWeight: FontWeight.w600,
    ),
  );

  Widget _rankPill(Translations tr) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: tokens.canvas.withValues(alpha: 0.85),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.trending_up, size: 14, color: tokens.accent),
        const SizedBox(width: 6),
        Text(
          // Web `t('#{position} in {label} Today', {position, label: t(rank.label)})`
          // — the whole phrase and the TV/Movies label are localized.
          tr.t('#{position} in {label} Today', {
            'position': slide.rankPosition,
            'label': tr.t(slide.rankLabel),
          }),
          style: TextStyle(
            color: tokens.ink,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );

  Widget _titlePlate(WidgetRef ref, bool phone) {
    var logo = slide.meta.logo;
    // TMDB / tt hero slides usually carry no clearlogo — resolve one (web hero
    // `resolveLogo`) so the hero shows the title's logo, not plain text. Falls
    // back to the text title while resolving or when there's no match.
    if (logo == null || logo.isEmpty) {
      logo = ref
          .watch(heroLogoProvider((id: slide.meta.id, type: slide.meta.type)))
          .value;
    }
    if (logo != null && logo.isNotEmpty) {
      return ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: phone ? 84 : 120,
          maxWidth: phone ? 300 : 460,
        ),
        child: CachedNetworkImage(
          imageUrl: logo,
          fit: BoxFit.contain,
          alignment: Alignment.centerLeft,
          errorWidget: (_, _, _) => _titleText(phone),
        ),
      );
    }
    return _titleText(phone);
  }

  Widget _titleText(bool phone) => Text(
    slide.meta.name,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      color: tokens.ink,
      fontSize: phone ? 38 : 60,
      height: 0.98,
      fontWeight: FontWeight.w500,
      letterSpacing: -1,
    ),
  );

  Widget _statLine(Translations tr, bool showImdbBadge) {
    final meta = slide.meta;
    final children = <Widget>[
      if (meta.releaseInfo != null) _stat(tr.t('Year'), meta.releaseInfo!),
      // Web gates the badge on `settings.showImdbBadge && imdbRating`.
      if (showImdbBadge && meta.imdbRating != null)
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: const Color(0xFFF5C518),
                borderRadius: BorderRadius.circular(3),
              ),
              child: const Text(
                'IMDb',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${meta.imdbRating}',
              style: TextStyle(color: tokens.ink, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      if (meta.runtime != null) _stat(tr.t('Runtime'), meta.runtime!),
    ];
    return Wrap(spacing: 32, runSpacing: 8, children: children);
  }

  Widget _stat(String label, String value) => RichText(
    text: TextSpan(
      children: [
        TextSpan(
          text: '$label: ',
          style: TextStyle(color: tokens.inkSubtle, fontSize: 14),
        ),
        TextSpan(
          text: value,
          style: TextStyle(color: tokens.ink, fontSize: 14),
        ),
      ],
    ),
  );

  Widget _buttons(WidgetRef ref, bool inWatchlist, bool phone) {
    final tr = ref.read(translationsProvider);
    // A phone shortens the watchlist label so the button (with its icon) never
    // exceeds the narrow content width; the + / ✓ icon carries the meaning.
    final watchlistLabel = phone
        ? (inWatchlist ? tr.t('Saved') : tr.t('Watchlist'))
        : (inWatchlist ? tr.t('In Watchlist') : tr.t('Add to Watchlist'));
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        Focusable(
          tokens: tokens,
          autofocus: true,
          borderRadius: 999,
          onPressed: () => _openDetail(ref),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 28),
            decoration: BoxDecoration(
              color: tokens.ink,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.play_arrow, size: 20, color: tokens.canvas),
                const SizedBox(width: 8),
                Text(
                  tr.t('Play'),
                  style: TextStyle(
                    color: tokens.canvas,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        Focusable(
          tokens: tokens,
          borderRadius: 999,
          onPressed: () => ref
              .read(watchlistProvider.notifier)
              .toggle(
                id: slide.meta.id,
                type: slide.meta.type,
                name: slide.meta.name,
                poster: slide.meta.poster,
              ),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 22),
            decoration: BoxDecoration(
              color: tokens.canvas.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: tokens.edge),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  inWatchlist ? Icons.check : Icons.add,
                  size: 20,
                  color: tokens.ink,
                ),
                const SizedBox(width: 8),
                Text(
                  watchlistLabel,
                  style: TextStyle(
                    color: tokens.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _dots() => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < slideCount; i++)
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Focusable(
            tokens: tokens,
            borderRadius: 999,
            onPressed: () => onSelectSlide(i),
            child: Container(
              width: i == activeIndex ? 24 : 10,
              height: 10,
              decoration: BoxDecoration(
                color: i == activeIndex ? tokens.accent : tokens.inkSubtle,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        ),
    ],
  );
}
