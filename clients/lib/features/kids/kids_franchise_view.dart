import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/kids/kids_gradient.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/kids_catalog.dart' show dropUnreleased;
import '../../domain/catalog/kids_franchises.dart';
import '../../domain/nav/frame.dart';

/// The infinite-scroll page cap, ported from `PAGE_CAP` in the web grid.
const int _kPageCap = 40;

/// A franchise "world" grid — the destination of a Kids franchise tile. Ported
/// 1:1 from the web `GridView` with a `kidsHero`: a themed hero (a title's
/// backdrop or the franchise gradient, the character art, the name and the
/// count) over an infinitely-scrolling poster grid. The fetcher is rebuilt from
/// the franchise key (closures cannot cross the frame stack), and each page is
/// run through [dropUnreleased] so nothing unreleased reaches a child.
class KidsFranchiseView extends ConsumerStatefulWidget {
  const KidsFranchiseView({super.key, required this.franchiseKey});

  final String franchiseKey;

  @override
  ConsumerState<KidsFranchiseView> createState() => _KidsFranchiseViewState();
}

class _KidsFranchiseViewState extends ConsumerState<KidsFranchiseView> {
  final _scroll = ScrollController();
  final _metas = <MetaPreview>[];
  final _seen = <String>{};
  int _page = 0;
  bool _loading = false;
  bool _done = false;
  final int _epoch = 0;
  Franchise? _franchise;
  FranchiseFetcher? _fetch;

  @override
  void initState() {
    super.initState();
    for (final f in kKidsFranchises) {
      if (f.key == widget.franchiseKey) {
        _franchise = f;
        break;
      }
    }
    final franchise = _franchise;
    if (franchise != null) {
      _fetch = franchiseFetcher(ref.read(tmdbClientProvider), franchise);
    } else {
      _done = true;
    }
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMore());
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final p = _scroll.position;
    if (p.pixels >= p.maxScrollExtent - 1200) _loadMore();
  }

  Future<void> _loadMore() async {
    final fetch = _fetch;
    if (_done || _loading || fetch == null) return;
    setState(() => _loading = true);
    final epoch = _epoch;
    final next = _page + 1;
    List<MetaPreview> batch;
    try {
      batch = dropUnreleased(await fetch(next));
    } catch (_) {
      if (mounted && epoch == _epoch) {
        setState(() {
          _done = true;
          _loading = false;
        });
      }
      return;
    }
    if (!mounted || epoch != _epoch) return;
    setState(() {
      _page = next;
      _loading = false;
      if (batch.isEmpty || next >= _kPageCap) {
        _done = true;
        return;
      }
      final fresh = batch.where((m) => _seen.add(m.id)).toList();
      if (fresh.isEmpty) _done = true;
      _metas.addAll(fresh);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final settings = ref.watch(settingsProvider);
    final franchise = _franchise;
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    return Container(
      color: t.canvas,
      child: CustomScrollView(
        controller: _scroll,
        slivers: [
          if (franchise != null)
            SliverToBoxAdapter(child: _hero(franchise, t, idiom)),
          SliverPadding(
            padding: EdgeInsets.fromLTRB(g, 12, g, 24),
            sliver: SliverGrid(
              gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: scaledPosterCell(
                  180,
                  settings.getDouble('posterScale'),
                ),
                childAspectRatio: posterGridAspect(
                  2 / 3.4,
                  settings.getBool('hidePosterTitles'),
                ),
                crossAxisSpacing: 18,
                mainAxisSpacing: 26,
              ),
              delegate: SliverChildBuilderDelegate((context, i) {
                final m = _metas[i];
                return FocusablePoster(
                  item: m,
                  tokens: t,
                  autofocus: i == 0,
                  kids: true,
                  onPressed: () => ref
                      .read(navControllerProvider.notifier)
                      .push(
                        Frame(FrameKind.meta, {'type': m.type, 'id': m.id}),
                      ),
                );
              }, childCount: _metas.length),
            ),
          ),
          SliverToBoxAdapter(child: _footer(t)),
        ],
      ),
    );
  }

  Widget _footer(HarborTokens t) {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.all(32),
        child: Center(
          child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
        ),
      );
    }
    if (_done && _metas.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 80),
        child: Column(
          children: [
            Image.asset('assets/kids/doodles/lilpurpocto.png', height: 80),
            const SizedBox(height: 12),
            Text(
              'Nothing here yet!',
              style: TextStyle(
                color: t.ink,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox(height: 48);
  }

  Widget _hero(Franchise f, HarborTokens t, Idiom idiom) {
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    final heroH = phone ? 360.0 : 460.0;
    final grad = kidsGradient(f.grad);
    String? bgArt;
    for (final m in _metas) {
      final b = m.background;
      if (b != null) {
        bgArt = b.replaceFirst('/w780/', '/w1280/');
        break;
      }
    }
    return SizedBox(
      height: heroH,
      child: LayoutBuilder(
        builder: (context, c) {
          // On a phone the character art keeps a wider slice, so the title is
          // held clear of it (rather than wrapping underneath).
          final artW = c.maxWidth * (phone ? 0.4 : 0.34);
          return Stack(
            fit: StackFit.expand,
            children: [
              if (bgArt != null)
                CachedNetworkImage(imageUrl: bgArt, fit: BoxFit.cover)
              else if (grad != null)
                DecoratedBox(decoration: BoxDecoration(gradient: grad)),
              // Franchise-tinted overlay (approximates the web mix-blend tint).
              if (grad != null && bgArt != null)
                Opacity(
                  opacity: 0.25,
                  child: DecoratedBox(
                    decoration: BoxDecoration(gradient: grad),
                  ),
                ),
              // Left-to-right darkening for the title.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Color(0x73000000),
                      Color(0x1A000000),
                      Color(0x00000000),
                    ],
                  ),
                ),
              ),
              // Bottom fade into the page canvas.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      t.canvas,
                      t.canvas.withValues(alpha: 0.35),
                      t.canvas.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
              // The franchise character art, bottom-trailing.
              Positioned(
                right: 0,
                bottom: 0,
                child: Image.asset(
                  'assets/kids/cta/${f.key}.webp',
                  height: heroH * 0.56,
                  width: artW,
                  fit: BoxFit.contain,
                  alignment: Alignment.bottomRight,
                ),
              ),
              // The franchise name + title count.
              Positioned(
                left: g,
                right: phone ? artW + 12 : g,
                bottom: phone ? 24 : 36,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      f.name,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: phone ? 34 : 56,
                        height: 0.92,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        shadows: const [
                          Shadow(
                            color: Color(0xB3000000),
                            blurRadius: 18,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${_metas.length} ${_metas.length == 1 ? 'title' : 'titles'}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        shadows: [
                          Shadow(color: Color(0xA6000000), blurRadius: 10),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
