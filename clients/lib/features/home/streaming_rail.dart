import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/tokens.dart';
import '../../domain/nav/frame.dart';
import '../streaming/service_logo.dart';
import '../../design/layout/idiom.dart';

/// The Home "Your Streaming" rail, ported from `src/components/streaming-rail.tsx`:
/// a focusable track of service tiles that open the per-service catalog view.
/// Hidden entirely when no services are enabled (or without a TMDB key).
class StreamingRail extends ConsumerWidget {
  const StreamingRail({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = pageGutter(Idiom.of(context));
    final t = ref.watch(tokensProvider);
    final services = ref.watch(enabledStreamingServicesProvider);
    if (services.isEmpty) return const SizedBox.shrink();
    final titleScale = ref.watch(settingsProvider).getDouble('rowTitleScale');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            ref.watch(translationsProvider).t('Your Streaming'),
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(20, titleScale),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 80,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: services.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => _ServiceTile(
                service: services[i],
                tokens: t,
                onOpen: () => ref
                    .read(navControllerProvider.notifier)
                    .push(Frame(FrameKind.service, {'service': services[i]})),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.service,
    required this.tokens,
    required this.onOpen,
  });

  final String service;
  final HarborTokens tokens;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 172,
      child: Focusable(
        tokens: tokens,
        borderRadius: 12,
        onPressed: onOpen,
        child: Container(
          decoration: BoxDecoration(
            color: tokens.raised,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: ServiceLogo(service: service, height: 26),
        ),
      ),
    );
  }
}
