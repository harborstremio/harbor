import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/kids_providers.dart';
import '../../app/nav_controller.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/focusable.dart';

/// Downsizes a TMDB backdrop to the card-appropriate width, ported from
/// `upsizeCard` (`/w780/` → `/w500/`).
String? upsizeCard(String? url) => url?.replaceFirst('/w780/', '/w500/');

/// The Kids hero — the themed `kidbgsvg` backdrop, the "Just for kids" title,
/// and a row of up to five featured cards. Ported 1:1 from `KidsHero`; the
/// featured pool is shuffled once so the row varies between visits.
class KidsHero extends StatefulWidget {
  const KidsHero({super.key, required this.featured, required this.tokens});

  final List<MetaPreview> featured;
  final HarborTokens tokens;

  @override
  State<KidsHero> createState() => _KidsHeroState();
}

class _KidsHeroState extends State<KidsHero> {
  late List<MetaPreview> _cards = _pick();

  List<MetaPreview> _pick() {
    final usable =
        widget.featured
            .where((m) => m.background != null || m.poster != null)
            .toList()
          ..shuffle();
    return usable.take(5).toList();
  }

  @override
  void didUpdateWidget(KidsHero old) {
    super.didUpdateWidget(old);
    if (!identical(old.featured, widget.featured)) {
      setState(() => _cards = _pick());
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final height = math.max(620.0, MediaQuery.sizeOf(context).height * 0.72);
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: SvgPicture.asset(
              'assets/kids/kidbgsvg.svg',
              fit: BoxFit.cover,
              alignment: const Alignment(0, -0.85),
            ),
          ),
          // The bottom fade into the page canvas.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: height * 0.4,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    t.canvas,
                    t.canvas.withValues(alpha: 0.55),
                    t.canvas.withValues(alpha: 0),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(24, 24, 24, height * 0.17),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  'JUST FOR KIDS',
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'What should we watch?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 44,
                    height: 1.0,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (var i = 0; i < _cards.length; i++) ...[
                      if (i > 0) const SizedBox(width: 14),
                      Flexible(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 212),
                          child: _KidsHeroCard(
                            meta: _cards[i],
                            tokens: t,
                            // Land the remote on the first hero card so the Kids
                            // tab opens with a visible focus target on a TV.
                            autofocus: i == 0,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KidsHeroCard extends ConsumerWidget {
  const _KidsHeroCard({
    required this.meta,
    required this.tokens,
    this.autofocus = false,
  });

  final MetaPreview meta;
  final HarborTokens tokens;
  final bool autofocus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final art = upsizeCard(meta.background) ?? meta.poster;
    // Discover previews never carry a logo, so it is fetched lazily; the card
    // shows the title until it resolves (the web's name fallback).
    final logo = ref
        .watch(
          kidsLogoProvider((
            metaId: meta.id,
            originalLang: meta.originalLanguage,
          )),
        )
        .value;
    return Focusable(
      tokens: t,
      borderRadius: 22,
      autofocus: autofocus,
      onPressed: () => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.meta, {'type': meta.type, 'id': meta.id})),
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: const [
            BoxShadow(
              color: Color(0x40142838),
              blurRadius: 40,
              offset: Offset(0, 16),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (art != null)
              CachedNetworkImage(imageUrl: art, fit: BoxFit.cover),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Color(0xBF000000),
                    Color(0x1A000000),
                    Color(0x00000000),
                  ],
                  stops: [0.0, 0.5, 1.0],
                ),
              ),
            ),
            Positioned(
              left: 10,
              right: 10,
              bottom: 10,
              child: logo != null
                  ? CachedNetworkImage(
                      imageUrl: logo,
                      height: 44,
                      fit: BoxFit.contain,
                      alignment: Alignment.bottomCenter,
                    )
                  : Text(
                      meta.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                        shadows: [
                          Shadow(color: Color(0xB3000000), blurRadius: 8),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
