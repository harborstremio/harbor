import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/color/oklch.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart' show scaledRowTitle;
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/filter_rails.dart';
import '../../domain/nav/frame.dart';
import 'tile_collage.dart';

class _Lang {
  const _Lang(this.iso, this.name, this.endonym, this.hue);
  final String iso;
  final String name;
  final String endonym;
  final double hue;
}

/// The languages shown, ported 1:1 from the web `LANGS`.
const List<_Lang> _kLangs = [
  _Lang('ko', 'Korean', '한국어', 25),
  _Lang('ja', 'Japanese', '日本語', 350),
  _Lang('es', 'Spanish', 'Español', 60),
  _Lang('fr', 'French', 'Français', 260),
  _Lang('zh', 'Chinese', '中文', 10),
  _Lang('hi', 'Hindi', 'हिन्दी', 300),
  _Lang('de', 'German', 'Deutsch', 40),
  _Lang('it', 'Italian', 'Italiano', 145),
  _Lang('pt', 'Portuguese', 'Português', 130),
  _Lang('tr', 'Turkish', 'Türkçe', 200),
  _Lang('sv', 'Swedish', 'Svenska', 230),
  _Lang('da', 'Danish', 'Dansk', 0),
  _Lang('no', 'Norwegian', 'Norsk', 250),
  _Lang('ru', 'Russian', 'Русский', 340),
  _Lang('pl', 'Polish', 'Polski', 170),
  _Lang('th', 'Thai', 'ไทย', 320),
  _Lang('nl', 'Dutch', 'Nederlands', 80),
  _Lang('ar', 'Arabic', 'العربية', 165),
];

const double _kTileWidth = 210;
const double _kTileHeight = 168; // 5:4

/// Three popular backdrops for a language's collage (TV titles in that original
/// language). Empty without a key.
final _langSampleProvider = FutureProvider.family<List<MetaPreview>, String>((
  ref,
  iso,
) async {
  final client = ref.watch(tmdbClientProvider);
  if (!client.hasKey) return const [];
  try {
    final list = await client.discover('tv', {
      'with_original_language': iso,
      'sort_by': 'popularity.desc',
      'vote_count.gte': '150',
    });
    return [
      for (final m in list)
        if (m.background != null) m,
    ].take(3).toList();
  } catch (_) {
    return const [];
  }
});

/// The "Browse by Language" tiles — a horizontal rail of hue-tinted tiles that
/// open the language browse. Ported 1:1 from the web `LanguageTiles`.
class LanguageTiles extends ConsumerWidget {
  const LanguageTiles({super.key});

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
            tr.t('Browse by Language'),
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
              itemCount: _kLangs.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _LanguageTile(lang: _kLangs[i], tokens: t),
            ),
          ),
        ),
      ],
    );
  }
}

class _LanguageTile extends ConsumerWidget {
  const _LanguageTile({required this.lang, required this.tokens});

  final _Lang lang;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tr = ref.watch(translationsProvider);
    final from = oklchToColor(0.42, 0.13, lang.hue);
    final to = oklchToColor(0.17, 0.07, lang.hue);
    final ink = oklchToColor(0.96, 0.02, lang.hue);
    final backdrops =
        ref.watch(_langSampleProvider(lang.iso)).value ?? const [];

    return Focusable(
      tokens: tokens,
      borderRadius: 16,
      onPressed: () => ref
          .read(navControllerProvider.notifier)
          .push(
            Frame(
              FrameKind.filter,
              LanguageFilter('tv', lang.name, lang.iso).toArgs(),
            ),
          ),
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
                TileCollage(backdrops: backdrops, tileWidth: _kTileWidth),
                // The hue tint over the collage (approximates the web multiply).
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topRight,
                      end: Alignment.bottomLeft,
                      colors: [
                        oklchToColor(
                          0.42,
                          0.13,
                          lang.hue,
                          alpha: backdrops.isEmpty ? 255 : 140,
                        ),
                        oklchToColor(
                          0.17,
                          0.07,
                          lang.hue,
                          alpha: backdrops.isEmpty ? 255 : 230,
                        ),
                      ],
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: FractionallySizedBox(
                    heightFactor: 0.5,
                    widthFactor: 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [to.withValues(alpha: 0), to],
                        ),
                      ),
                    ),
                  ),
                ),
                // The endonym, large and faded, top-trailing.
                Positioned(
                  top: 10,
                  right: 14,
                  child: Text(
                    lang.endonym,
                    style: TextStyle(
                      color: ink.withValues(alpha: 0.25),
                      fontSize: 32,
                      height: 1,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Positioned(
                  left: 18,
                  right: 18,
                  bottom: 16,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          tr.t(lang.name),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: ink,
                            fontSize: 24,
                            height: 1.05,
                            fontWeight: FontWeight.w500,
                            letterSpacing: -0.3,
                            shadows: const [
                              Shadow(color: Color(0x66000000), blurRadius: 18),
                            ],
                          ),
                        ),
                      ),
                      Icon(Icons.chevron_right, color: ink, size: 20),
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
