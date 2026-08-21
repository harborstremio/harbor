import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/i18n_providers.dart';
import '../app/theme_controller.dart';
import 'focus/focusable.dart';

/// A "back to top" affordance for a long scroll view, ported from the web
/// `BackToTop`: a small floating button that fades in once the view is scrolled
/// past [threshold] and smoothly returns to the top when pressed. Wrap the
/// scrollable so the button overlays its bottom-end corner (RTL-aware); the
/// [controller] must be the scrollable's own [ScrollController].
class BackToTopOverlay extends ConsumerStatefulWidget {
  const BackToTopOverlay({
    super.key,
    required this.controller,
    required this.child,
    this.threshold = 600,
  });

  final ScrollController controller;
  final Widget child;
  final double threshold;

  @override
  ConsumerState<BackToTopOverlay> createState() => _BackToTopOverlayState();
}

class _BackToTopOverlayState extends ConsumerState<BackToTopOverlay> {
  bool _show = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(BackToTopOverlay old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_onScroll);
      widget.controller.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    final c = widget.controller;
    final show = c.hasClients && c.offset > widget.threshold;
    if (show != _show && mounted) setState(() => _show = show);
  }

  void _toTop() => widget.controller.animateTo(
    0,
    duration: const Duration(milliseconds: 380),
    curve: Curves.easeOutCubic,
  );

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    return Stack(
      children: [
        widget.child,
        PositionedDirectional(
          end: 20,
          bottom: 20,
          child: AnimatedOpacity(
            opacity: _show ? 1 : 0,
            duration: const Duration(milliseconds: 250),
            child: IgnorePointer(
              ignoring: !_show,
              child: Focusable(
                tokens: t,
                borderRadius: 10,
                onPressed: _toTop,
                child: Tooltip(
                  message: tr.t('Back to top'),
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: t.canvas.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: t.edgeSoft.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Icon(
                      Icons.keyboard_arrow_up_rounded,
                      size: 22,
                      color: t.inkMuted,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
