import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'tokens.dart';

/// The Rotten Tomatoes "fresh" tomato mark. Shared by the detail hero ratings
/// pill and the Discover critics-pick rating line.
const kRtFreshSvg =
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M16 27.5 C 8 27.5 4.5 22 4.5 17 C 4.5 12 7.5 8.5 11 7.5 C 13 6 14 5 14 4 C 14 2.5 15 2 16 2 C 17 2 18 2.5 18 4 C 18 5 19 6 21 7.5 C 24.5 8.5 27.5 12 27.5 17 C 27.5 22 24 27.5 16 27.5 Z" fill="#FA320A"/>'
    '<path d="M14.5 4.5 Q 17.5 3 20 5" stroke="#3F8217" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    '<ellipse cx="12.5" cy="13" rx="2.2" ry="2.8" fill="rgba(255,255,255,0.22)"/>'
    '</svg>';

/// The Rotten Tomatoes "rotten" splat mark.
const kRtRottenSvg =
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">'
    '<path d="M5 20 C 4 17 4.5 14 6 12 C 7 10.5 8.5 10 10 10.5 C 10.5 9 12 8 14 8.5 C 15 7 17 6.5 18.5 7.5 C 20 6.5 22 7 23 8.5 C 25 8 26.5 9.5 26.5 11.5 C 28 12.5 28.5 14.5 28 16.5 C 28.5 18 28 19.5 27 20.5 C 27.5 22 26.5 23.5 25 24 C 24.5 25.5 22.5 26 21 25 C 20 26 18 26.5 16.5 25.5 C 15 26.5 13 26 12 24.5 C 10 25 8 24 7.5 22 C 6 21.5 5 21 5 20 Z" fill="#5C7A3A"/>'
    '<path d="M9 25 L 8 29 M 14 26 L 13.5 30 M 19 26 L 19.5 30 M 24 24.5 L 25 28" stroke="#3F5526" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    '<ellipse cx="11" cy="14" rx="1.6" ry="2" fill="rgba(255,255,255,0.18)"/>'
    '</svg>';

/// The Metacritic band colour by score (green ≥61, amber ≥40, else red).
Color metacriticBand(int v) {
  if (v >= 61) return const Color(0xFF10B981);
  if (v >= 40) return const Color(0xFFF59E0B);
  return const Color(0xFFEF4444);
}

/// The Rotten Tomatoes critics score — the fresh/rotten tomato followed by the
/// percentage. `critics >= 60` shows the fresh mark, matching `<RtBadge>`.
class RtScore extends StatelessWidget {
  const RtScore({super.key, required this.critics, required this.tokens});

  final int critics;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.string(critics >= 60 ? kRtFreshSvg : kRtRottenSvg, height: 14),
        const SizedBox(width: 4),
        Text(
          '$critics%',
          style: TextStyle(
            color: tokens.ink.withValues(alpha: 0.85),
            fontSize: 12.5,
          ),
        ),
      ],
    );
  }
}

/// The Metacritic "M" score chip — a coloured band with the score.
class MetascoreChip extends StatelessWidget {
  const MetascoreChip({super.key, required this.score});

  final int score;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 18,
      constraints: const BoxConstraints(minWidth: 22),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: metacriticBand(score),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        '$score',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
