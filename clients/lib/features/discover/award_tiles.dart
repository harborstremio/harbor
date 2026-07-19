import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/awards/award_icons.dart';
import '../../design/color/oklch.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart' show scaledRowTitle;
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/awards/wikidata_awards.dart';
import '../../domain/nav/frame.dart';

typedef _Award = ({AwardType type, String name, String sub});

/// The award bodies shown, ported 1:1 from the web `AWARDS`.
const List<_Award> _kAwards = [
  (
    type: AwardType.oscar,
    name: 'Academy Awards',
    sub: 'Best Picture and beyond',
  ),
  (
    type: AwardType.goldenGlobe,
    name: 'Golden Globes',
    sub: 'Film and television',
  ),
  (type: AwardType.bafta, name: 'BAFTA', sub: 'The British Academy'),
  (type: AwardType.emmy, name: 'Emmys', sub: "Television's finest"),
  (type: AwardType.sag, name: 'SAG Awards', sub: 'Chosen by actors'),
  (
    type: AwardType.criticsChoice,
    name: "Critics' Choice",
    sub: "The critics' cut",
  ),
  (type: AwardType.cannes, name: 'Cannes', sub: "Palme d'Or"),
  (type: AwardType.venice, name: 'Venice', sub: 'Golden Lion'),
  (type: AwardType.berlin, name: 'Berlinale', sub: 'Golden Bear'),
];

const double _kTileWidth = 210;
const double _kTileHeight = 168; // 5:4

/// The "Browse by Award" tiles — a horizontal rail of laurel tiles opening each
/// award body's page. Ported 1:1 from the web `AwardTiles`.
class AwardTiles extends ConsumerWidget {
  const AwardTiles({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            tr.t('Browse by Award'),
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(
                20,
                ref.watch(settingsProvider).getDouble('rowTitleScale'),
              ),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: _kTileHeight,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: _kAwards.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _AwardTile(award: _kAwards[i], tokens: t),
            ),
          ),
        ),
      ],
    );
  }
}

class _AwardTile extends ConsumerWidget {
  const _AwardTile({required this.award, required this.tokens});

  final _Award award;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tr = ref.watch(translationsProvider);
    final tint = laurelColorFor(award.type);
    // The tile palette keeps the tint's hue while darkening it and easing the
    // chroma, the native form of the web's `oklch(from tint …)` gradients.
    final (_, c, h) = colorToOklch(tint);
    final from = oklchToColor(0.26, c * 0.45, h);
    final to = oklchToColor(0.11, c * 0.3, h);
    final glow = oklchToColor(0.5, c * 0.7, h, alpha: (0.22 * 255).round());

    return Focusable(
      tokens: tokens,
      borderRadius: 16,
      onPressed: () => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.award, {'type': award.type.id})),
      child: SizedBox(
        width: _kTileWidth,
        height: _kTileHeight,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tokens.edgeSoft),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                      colors: [from, to],
                    ),
                  ),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(0, -0.36),
                      radius: 0.85,
                      colors: [glow, glow.withValues(alpha: 0)],
                      stops: const [0.0, 0.72],
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: _kTileHeight * 0.62,
                  child: Center(
                    child: Laurel(
                      size: 96,
                      color: tint,
                      child: AwardLogo(type: award.type, size: 32),
                    ),
                  ),
                ),
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 14,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              tr.t(award.name),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 21,
                                height: 1.05,
                                fontWeight: FontWeight.w500,
                                letterSpacing: -0.3,
                                shadows: [
                                  Shadow(
                                    color: Color(0x80000000),
                                    blurRadius: 14,
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              tr.t(award.sub),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.65),
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.chevron_right,
                        color: Colors.white.withValues(alpha: 0.8),
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
