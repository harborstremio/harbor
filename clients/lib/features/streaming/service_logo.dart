import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../domain/catalog/streaming.dart';

/// A streaming service's bundled SVG logo, forced to white, ported from
/// `src/components/service-logo.tsx`. Disney's taller intrinsic logo is scaled
/// up via its `logoHeight` (relative to the 32px baseline). Falls back to the
/// service name in its brand tint if the service id is unknown.
class ServiceLogo extends StatelessWidget {
  const ServiceLogo({super.key, required this.service, this.height = 28});

  final String service;
  final double height;

  @override
  Widget build(BuildContext context) {
    final meta = kServices[service];
    if (meta == null) return const SizedBox.shrink();
    final finalHeight = meta.logoHeight != null
        ? (height * (meta.logoHeight! / 32)).roundToDouble()
        : height;
    return SvgPicture.asset(
      meta.logoAsset,
      height: finalHeight,
      fit: BoxFit.contain,
      colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
      semanticsLabel: meta.name,
      placeholderBuilder: (_) => Text(
        meta.name,
        style: TextStyle(
          color: Color(meta.tint),
          fontSize: 14.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
