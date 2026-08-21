import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/sports/sports_espn.dart';
import '../guide_utils.dart';

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

final _positionScore = RegExp(r'^\d+(st|nd|rd|th)$');

bool _hasScore(String s) => s.isNotEmpty && s != '0';

/// A local time label for an upcoming game — the time if it's today, otherwise
/// the date and time. Ported from `startLabel`.
String startLabel(int ms) {
  if (ms == 0) return 'TBD';
  final d = DateTime.fromMillisecondsSinceEpoch(ms);
  final now = DateTime.now();
  final time = formatTimeLabel(ms);
  if (d.year == now.year && d.month == now.month && d.day == now.day) {
    return time;
  }
  return '${_months[d.month - 1]} ${d.day} $time';
}

/// One game on the live-TV sports rail — the two sides, their scores, and the
/// game's live/final/upcoming status. Ported 1:1 from `SportsCard`.
class SportsCard extends ConsumerWidget {
  const SportsCard({super.key, required this.game, required this.onSelect});

  final SportsGame game;
  final void Function(SportsGame) onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final isFinal = game.state == SportsState.post;
    final live = game.state == SportsState.live;
    final hasScores = _hasScore(game.home.score) || _hasScore(game.away.score);
    final showWin =
        isFinal && !hasScores && (game.home.winner || game.away.winner);

    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: () => onSelect(game),
      child: Container(
        width: 260,
        height: 96,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.elevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft.withValues(alpha: 0.55)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Flexible(child: _status(t)),
                const SizedBox(width: 8),
                Text(
                  game.league,
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
            Expanded(
              child: _SideRow(
                side: game.away,
                active: live || isFinal,
                dim: isFinal && !game.away.winner,
                showWinner: showWin,
                tokens: t,
              ),
            ),
            Expanded(
              child: _SideRow(
                side: game.home,
                active: live || isFinal,
                dim: isFinal && !game.home.winner,
                showWinner: showWin,
                tokens: t,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _status(HarborTokens t) {
    if (game.state == SportsState.live) {
      return _pill(
        color: t.danger,
        border: null,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _PulseDot(color: Colors.white),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                game.detail.isNotEmpty ? game.detail : 'Live',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ),
          ],
        ),
      );
    }
    if (game.state == SportsState.post) {
      return Text(
        game.detail.isNotEmpty ? game.detail : 'Final',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: t.inkMuted,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.6,
        ),
      );
    }
    final label = game.startMs != 0
        ? startLabel(game.startMs)
        : (game.detail.isNotEmpty ? game.detail : 'Upcoming');
    return _pill(
      color: Colors.transparent,
      border: t.edgeSoft.withValues(alpha: 0.6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: t.inkSubtle.withValues(alpha: 0.6),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill({
    required Color color,
    required Color? border,
    required Widget child,
  }) => Container(
    height: 18,
    padding: const EdgeInsets.symmetric(horizontal: 6),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(4),
      border: border != null ? Border.all(color: border) : null,
    ),
    child: Align(alignment: Alignment.centerLeft, child: child),
  );
}

class _SideRow extends StatelessWidget {
  const _SideRow({
    required this.side,
    required this.active,
    required this.dim,
    required this.showWinner,
    required this.tokens,
  });

  final SportsSide side;
  final bool active;
  final bool dim;
  final bool showWinner;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final hasScore = _hasScore(side.score);
    final isPosition = hasScore && _positionScore.hasMatch(side.score);
    return Row(
      children: [
        SizedBox(
          width: 20,
          height: 20,
          child: side.logo.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: side.logo,
                  fit: BoxFit.contain,
                  errorWidget: (_, _, _) => _logoFallback(t),
                )
              : _logoFallback(t),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            side.abbr.isNotEmpty ? side.abbr : side.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: dim ? t.inkSubtle : t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ),
        const SizedBox(width: 8),
        if (showWinner && side.winner && !hasScore)
          Container(
            height: 20,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.success.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'WIN',
              style: TextStyle(
                color: t.success,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
              ),
            ),
          )
        else
          SizedBox(
            width: isPosition ? null : 36,
            child: Text(
              side.score,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: active ? (dim ? t.inkMuted : t.ink) : t.inkSubtle,
                fontSize: isPosition ? 13 : 20,
                fontWeight: FontWeight.w700,
                letterSpacing: isPosition ? -0.3 : 0,
                fontFeatures: isPosition
                    ? null
                    : const [FontFeature.tabularFigures()],
              ),
            ),
          ),
      ],
    );
  }

  Widget _logoFallback(HarborTokens t) => Container(
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.6),
      shape: BoxShape.circle,
    ),
  );
}

/// A softly pulsing dot — the live indicator, mirroring the web `animate-pulse`.
class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.color});

  final Color color;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween<double>(begin: 0.4, end: 1).animate(_c),
    child: Container(
      width: 6,
      height: 6,
      decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
    ),
  );
}
