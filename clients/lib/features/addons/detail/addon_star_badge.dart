import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/theme_controller.dart';

enum AddonStarBadgeSize { xs, sm, md, lg }

enum AddonStarBadgeTone { auto, dark, light }

const _newWindow = Duration(days: 14);
const _amber300 = Color(0xFFFCD34D);
const _amber700 = Color(0xFFB45309);
const _emerald300 = Color(0xFF6EE7B7);
const _emerald500 = Color(0xFF10B981);

/// The community star count and "New" badge for an addon, ported 1:1 from
/// `AddonStarBadge`. Renders nothing until the community index resolves the
/// manifest id, or when the addon has no stars and is not recent.
class AddonStarBadge extends ConsumerWidget {
  const AddonStarBadge({
    super.key,
    required this.manifestId,
    this.size = AddonStarBadgeSize.md,
    this.tone = AddonStarBadgeTone.auto,
  });

  final String? manifestId;
  final AddonStarBadgeSize size;
  final AddonStarBadgeTone tone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = manifestId;
    if (id == null || id.isEmpty) return const SizedBox.shrink();
    final community = ref.watch(communityForProvider(id)).value;
    if (community == null) return const SizedBox.shrink();
    final isNew = _isRecent(community.createdAt);
    if (community.stars <= 0 && !isNew) return const SizedBox.shrink();

    final t = ref.watch(tokensProvider);
    final (height, fontSize, iconSize) = switch (size) {
      AddonStarBadgeSize.xs => (16.0, 9.5, 8.0),
      AddonStarBadgeSize.sm => (20.0, 10.5, 9.0),
      AddonStarBadgeSize.md => (24.0, 11.0, 10.0),
      AddonStarBadgeSize.lg => (28.0, 12.5, 12.0),
    };
    final (bg, fg, ring) = switch (tone) {
      AddonStarBadgeTone.auto => (
        t.canvas.withValues(alpha: 0.7),
        t.accent,
        t.accent.withValues(alpha: 0.3),
      ),
      AddonStarBadgeTone.dark => (
        Colors.black.withValues(alpha: 0.55),
        _amber300,
        _amber300.withValues(alpha: 0.3),
      ),
      AddonStarBadgeTone.light => (
        Colors.white.withValues(alpha: 0.85),
        _amber700,
        _amber700.withValues(alpha: 0.3),
      ),
    };

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (community.stars > 0)
          _pill(
            height: height,
            bg: bg,
            ring: ring,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.star, size: iconSize, color: fg),
                const SizedBox(width: 4),
                Text(
                  _thousands(community.stars),
                  style: TextStyle(
                    color: fg,
                    fontSize: fontSize,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        if (community.stars > 0 && isNew) const SizedBox(width: 4),
        if (isNew)
          _pill(
            height: height,
            bg: _emerald500.withValues(alpha: 0.15),
            ring: _emerald500.withValues(alpha: 0.3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome, size: iconSize, color: _emerald300),
                const SizedBox(width: 4),
                Text(
                  'NEW',
                  style: TextStyle(
                    color: _emerald300,
                    fontSize: fontSize,
                    fontWeight: FontWeight.w700,
                    letterSpacing: fontSize * 0.14,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _pill({
    required double height,
    required Color bg,
    required Color ring,
    required Widget child,
  }) => Container(
    height: height,
    padding: const EdgeInsets.symmetric(horizontal: 7),
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: ring),
    ),
    child: child,
  );
}

bool _isRecent(String createdAt) {
  final parsed = DateTime.tryParse(createdAt);
  if (parsed == null) return false;
  return DateTime.now().difference(parsed) < _newWindow;
}

/// Groups an integer count with thousands separators, matching `toLocaleString`.
String _thousands(num n) {
  final digits = n.toInt().abs().toString();
  final buffer = StringBuffer(n < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}
