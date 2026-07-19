import 'package:flutter/material.dart';
import 'package:flutter_chrome_cast/entities.dart';
import 'package:flutter_chrome_cast/enums.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import 'airplay_button.dart';
import 'airplay_state.dart';
import 'cast_controller.dart';

/// The single cast control for the player chrome — one entry point for every
/// target the platform supports. It opens one "Cast to a device" picker listing
/// the Chromecast devices and, on Apple, an AirPlay row that hands off through
/// the system route picker. Reflects either connection (a filled icon while
/// casting or AirPlaying). Shown wherever `chromecast` is available; an
/// AirPlay-only platform uses the native [AirPlayButton] as the control instead.
class CastControl extends ConsumerWidget {
  const CastControl({
    super.key,
    this.includeAirplay = false,
    this.color = Colors.white,
  });

  /// Whether to add the AirPlay row to the picker (the platform also hands off
  /// over AirPlay).
  final bool includeAirplay;
  final Color color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final casting =
        ref.watch(castSessionProvider).asData?.value?.connectionState ==
        GoogleCastConnectState.connected;
    final airplaying =
        includeAirplay &&
        (ref.watch(airPlayStateProvider).asData?.value.active ?? false);
    return IconButton(
      onPressed: () =>
          showCastPicker(context, ref, includeAirplay: includeAirplay),
      tooltip: ref.read(translationsProvider).t('Cast'),
      color: color,
      icon: Icon((casting || airplaying) ? Icons.cast_connected : Icons.cast),
    );
  }
}

/// The Chromecast-only button — kept for callers that want just the Cast sender
/// affordance. The player chrome uses [CastControl].
class CastButton extends ConsumerWidget {
  const CastButton({super.key, this.color = Colors.white});

  final Color color;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connected =
        ref.watch(castSessionProvider).asData?.value?.connectionState ==
        GoogleCastConnectState.connected;
    return IconButton(
      onPressed: () => showCastPicker(context, ref),
      tooltip: ref.read(translationsProvider).t('Cast'),
      color: color,
      icon: Icon(connected ? Icons.cast_connected : Icons.cast),
    );
  }
}

/// Starts discovery and opens the Cast device picker; stops discovery on close.
/// With [includeAirplay] the picker also offers the system AirPlay route picker.
Future<void> showCastPicker(
  BuildContext context,
  WidgetRef ref, {
  bool includeAirplay = false,
}) async {
  final cast = ref.read(castControllerProvider);
  await cast.startDiscovery();
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (_) =>
        _CastDevicePicker(cast: cast, includeAirplay: includeAirplay),
  );
  await cast.stopDiscovery();
}

class _CastDevicePicker extends ConsumerWidget {
  const _CastDevicePicker({required this.cast, this.includeAirplay = false});

  final CastController cast;
  final bool includeAirplay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final connected =
        ref.watch(castSessionProvider).asData?.value?.connectionState ==
        GoogleCastConnectState.connected;

    return Dialog(
      backgroundColor: t.raised,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360, maxHeight: 460),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  tr.t('Cast to a device'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (includeAirplay) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: _airPlayRow(t, tr),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                  child: Divider(height: 1, color: t.edgeSoft),
                ),
              ],
              Flexible(
                child: StreamBuilder<List<GoogleCastDevice>>(
                  stream: cast.devicesStream,
                  initialData: cast.devices,
                  builder: (context, snap) {
                    final devices = snap.data ?? const <GoogleCastDevice>[];
                    if (devices.isEmpty) {
                      return _searching(t, tr);
                    }
                    return ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      children: [
                        for (final d in devices) _deviceRow(context, t, tr, d),
                      ],
                    );
                  },
                ),
              ),
              if (connected) ...[
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 10,
                    onPressed: () {
                      cast.disconnect();
                      Navigator.of(context).pop();
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.cast_connected_rounded,
                            size: 18,
                            color: t.danger,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            tr.t('Stop casting'),
                            style: TextStyle(
                              color: t.danger,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// The AirPlay entry: the native route-picker glyph (the tap target that opens
  /// the system AirPlay sheet) with a label. iOS owns AirPlay discovery, so the
  /// affordance is the OS control rather than an enumerated device list.
  Widget _airPlayRow(HarborTokens t, Translations tr) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    child: Row(
      children: [
        SizedBox(
          width: 44,
          height: 44,
          child: AirPlayButton(tint: t.inkMuted, activeTint: t.accent),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr.t('AirPlay'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                tr.t('Apple TV, speakers & more'),
                style: TextStyle(color: t.inkSubtle, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _searching(HarborTokens t, Translations tr) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
    child: Row(
      children: [
        SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2, color: t.accent),
        ),
        const SizedBox(width: 14),
        Text(
          tr.t('Searching for devices…'),
          style: TextStyle(color: t.inkMuted, fontSize: 13),
        ),
      ],
    ),
  );

  Widget _deviceRow(
    BuildContext context,
    HarborTokens t,
    Translations tr,
    GoogleCastDevice device,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 10,
    onPressed: () {
      cast.connect(device);
      Navigator.of(context).pop();
    },
    child: Container(
      margin: const EdgeInsets.symmetric(vertical: 1),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.tv_rounded, size: 20, color: t.inkMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.friendlyName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (device.modelName != null && device.modelName!.isNotEmpty)
                  Text(
                    device.modelName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: t.inkSubtle, fontSize: 12),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
