import 'package:flutter/widgets.dart';

/// One scattered decorative doodle. Positions are a percentage of the doodle
/// layer (matching the web's `top/left/right/bottom` percentages), [w] the width
/// in logical pixels, [rot] the rotation in degrees, [op] the opacity, and
/// [flip] a horizontal mirror.
class _Doodle {
  const _Doodle(
    this.src, {
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.w,
    this.rot = 0,
    required this.op,
    this.flip = false,
  });

  final String src;
  final double? top;
  final double? bottom;
  final double? left;
  final double? right;
  final double w;
  final double rot;
  final double op;
  final bool flip;
}

/// The doodle layout, ported 1:1 from `kids-doodles.tsx` `DOODLES`.
const List<_Doodle> _kDoodles = [
  _Doodle(
    'lilbluewhale',
    top: 49,
    right: 1,
    w: 66,
    rot: 6,
    op: 0.9,
    flip: true,
  ),
  _Doodle('lilwhale1', bottom: 2, left: 8, w: 62, rot: 4, op: 0.9),
  _Doodle('liloctored', top: 29, left: 1, w: 60, rot: -8, op: 0.9),
  _Doodle('lilpurpocto', top: 75, right: 0.8, w: 58, rot: 8, op: 0.9),
  _Doodle('lilwhitestar', top: 33, right: 2, w: 28, op: 0.8),
  _Doodle('lilpurplestar', top: 45, left: 2.5, w: 24, op: 0.8),
  _Doodle('lilorangestar2', top: 64, right: 3.5, w: 24, op: 0.8),
  _Doodle('lilwhitestar2', top: 79, left: 3.5, w: 22, op: 0.78),
  _Doodle('lilwhitestar', top: 95, right: 4, w: 26, op: 0.8),
  _Doodle('lilwhitestar2', top: 30, left: 48, w: 20, op: 0.72),
  _Doodle('lilorangestar2', top: 39, left: 61, w: 22, op: 0.72),
  _Doodle('lilpurplestar', top: 47, left: 36, w: 22, op: 0.7),
  _Doodle('lilwhitestar', top: 56, left: 53, w: 22, op: 0.72),
  _Doodle('lilwhitestar2', top: 63, left: 31, w: 20, op: 0.68),
  _Doodle('lilorangestar2', top: 71, left: 58, w: 22, op: 0.72),
  _Doodle('lilpurplestar', top: 80, left: 44, w: 22, op: 0.7),
  _Doodle('lilwhitestar', top: 87, left: 35, w: 22, op: 0.7),
  _Doodle('bubbles', top: 16, left: 3, w: 50, rot: -4, op: 0.9),
  _Doodle('stardots', top: 58, left: 3, w: 40, rot: -6, op: 0.88),
];

/// The Kids page's scattered doodle backdrop — a non-interactive decorative
/// layer that fills its parent. Ported 1:1 from `KidsDoodles`; percentages are
/// resolved against the laid-out size.
class KidsDoodles extends StatelessWidget {
  const KidsDoodles({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ClipRect(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final w = constraints.maxWidth;
            final h = constraints.maxHeight;
            return Stack(
              children: [
                for (final d in _kDoodles)
                  Positioned(
                    top: d.top != null ? d.top! / 100 * h : null,
                    bottom: d.bottom != null ? d.bottom! / 100 * h : null,
                    left: d.left != null ? d.left! / 100 * w : null,
                    right: d.right != null ? d.right! / 100 * w : null,
                    child: Opacity(
                      opacity: d.op,
                      child: Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..rotateZ(d.rot * 3.1415926535897932 / 180.0)
                          ..scaleByDouble(d.flip ? -1.0 : 1.0, 1.0, 1.0, 1.0),
                        child: Image.asset(
                          'assets/kids/doodles/${d.src}.png',
                          width: d.w,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
