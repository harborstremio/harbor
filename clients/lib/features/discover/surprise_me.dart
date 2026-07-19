import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/nav/frame.dart';

/// The "Surprise me" panel — a poster-collage button that opens a random title
/// from the Discover [pool]. Ported 1:1 from the web `SurpriseMe`.
class SurpriseMe extends ConsumerStatefulWidget {
  const SurpriseMe({super.key, required this.pool, required this.tokens});

  final List<MetaPreview> pool;
  final HarborTokens tokens;

  @override
  ConsumerState<SurpriseMe> createState() => _SurpriseMeState();
}

class _SurpriseMeState extends ConsumerState<SurpriseMe> {
  final _rng = Random();
  List<MetaPreview> _tiles = const [];
  String? _last;

  @override
  void initState() {
    super.initState();
    _reshuffle();
  }

  @override
  void didUpdateWidget(SurpriseMe old) {
    super.didUpdateWidget(old);
    if (_tiles.isEmpty && widget.pool.isNotEmpty) _reshuffle();
  }

  void _reshuffle() {
    if (widget.pool.isEmpty) return;
    final shuffled = [...widget.pool]..shuffle(_rng);
    setState(() => _tiles = shuffled.take(18).toList());
  }

  void _surprise() {
    if (widget.pool.isEmpty) return;
    var pick = widget.pool[_rng.nextInt(widget.pool.length)];
    if (widget.pool.length > 1) {
      while (pick.id == _last) {
        pick = widget.pool[_rng.nextInt(widget.pool.length)];
      }
    }
    _last = pick.id;
    _reshuffle();
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.meta, {'type': pick.type, 'id': pick.id}));
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          tr.t("Can't decide?"),
          style: TextStyle(
            color: t.ink,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 16,
          onPressed: _surprise,
          child: SizedBox(
            height: 72,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: t.edgeSoft),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Row(
                      children: [
                        for (final m in _tiles)
                          Expanded(
                            child: RpdbPosterImage(
                              metaId: m.id,
                              rawPoster: m.poster,
                              type: m.type == 'series' ? 'series' : 'movie',
                              tokens: t,
                              fallback: () => ColoredBox(color: t.surface),
                            ),
                          ),
                      ],
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            t.canvas,
                            t.canvas.withValues(alpha: 0.85),
                            t.canvas.withValues(alpha: 0.3),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: t.ink,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.casino,
                              color: t.canvas,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tr.t('Surprise me'),
                                style: TextStyle(
                                  color: t.ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                tr.t('Pick a random title'),
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
