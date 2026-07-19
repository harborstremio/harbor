import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// The system AirPlay route picker (`AVRoutePickerView`) embedded as a UIKit
/// platform view. Shown by the player chrome only where the active engine
/// supports AirPlay (`PlayerCapabilities.airplay` — the native AVPlayer engine
/// on an Apple OS), so the underlying AVPlayer hands off video on selection.
///
/// A no-op everywhere the platform view is unavailable (non-iOS), so the same
/// chrome code is safe on every platform.
class AirPlayButton extends StatelessWidget {
  const AirPlayButton({
    super.key,
    this.size = 44,
    this.tint = const Color(0xFFFFFFFF),
    this.activeTint,
  });

  final double size;
  final Color tint;
  final Color? activeTint;

  static const _viewType = 'harbor/airplay_route_picker';

  @override
  Widget build(BuildContext context) {
    if (defaultTargetPlatform != TargetPlatform.iOS) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      width: size,
      height: size,
      child: UiKitView(
        viewType: _viewType,
        creationParams: <String, dynamic>{
          'tint': _rgba(tint),
          if (activeTint != null) 'activeTint': _rgba(activeTint!),
        },
        creationParamsCodec: const StandardMessageCodec(),
      ),
    );
  }

  Map<String, double> _rgba(Color c) => {
    'r': c.r,
    'g': c.g,
    'b': c.b,
    'a': c.a,
  };
}
