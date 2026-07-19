import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// The loader sizes, ported from the web `HarborLoader` `SIZE_CLASS`
/// (sm/md/lg/xl → 80/128/176/240 px).
enum HarborLoaderSize { sm, md, lg, xl }

double _px(HarborLoaderSize s) => switch (s) {
  HarborLoaderSize.sm => 80,
  HarborLoaderSize.md => 128,
  HarborLoaderSize.lg => 176,
  HarborLoaderSize.xl => 240,
};

/// The Harbor sailboat loading animation — a native port of the web
/// `HarborLoader`: the `harbor-loader.json` Lottie boat, with an optional
/// uppercase, letter-spaced caption underneath. Shown while a title loads (and
/// wherever the web shows the boat), replacing a bare spinner.
class HarborLoader extends StatelessWidget {
  const HarborLoader({
    super.key,
    this.size = HarborLoaderSize.md,
    this.caption,
    this.captionColor,
  });

  final HarborLoaderSize size;
  final String? caption;

  /// Caption colour; defaults to white-70, matching the web (the loader always
  /// sits over a dark surface — the player, a loading scrim).
  final Color? captionColor;

  @override
  Widget build(BuildContext context) {
    final px = _px(size);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: px,
          height: px,
          child: Lottie.asset(
            'assets/lottie/harbor-loader.json',
            repeat: true,
            fit: BoxFit.contain,
          ),
        ),
        if (caption != null && caption!.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            caption!.toUpperCase(),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: captionColor ?? Colors.white.withValues(alpha: 0.7),
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
              letterSpacing: 2.25,
            ),
          ),
        ],
      ],
    );
  }
}
