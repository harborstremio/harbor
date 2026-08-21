import 'package:flutter/widgets.dart';

/// Paints a dashed, rounded-rectangle border around [child] — the native
/// equivalent of the web `border-dashed` used on the empty-state cards.
class DashedBorder extends StatelessWidget {
  const DashedBorder({
    super.key,
    required this.child,
    required this.color,
    this.radius = 16,
    this.dashLength = 6,
    this.gapLength = 5,
    this.strokeWidth = 1.5,
  });

  final Widget child;
  final Color color;
  final double radius;
  final double dashLength;
  final double gapLength;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _DashedBorderPainter(
      color: color,
      radius: radius,
      dashLength: dashLength,
      gapLength: gapLength,
      strokeWidth: strokeWidth,
    ),
    child: child,
  );
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({
    required this.color,
    required this.radius,
    required this.dashLength,
    required this.gapLength,
    required this.strokeWidth,
  });

  final Color color;
  final double radius;
  final double dashLength;
  final double gapLength;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(strokeWidth / 2),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + dashLength).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance += dashLength + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color ||
      old.radius != radius ||
      old.dashLength != dashLength ||
      old.gapLength != gapLength ||
      old.strokeWidth != strokeWidth;
}
