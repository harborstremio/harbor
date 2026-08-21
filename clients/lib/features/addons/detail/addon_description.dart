import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';

/// The addon description with a 3-line clamp and a View more / Show less toggle
/// that appears only when the text overflows. Ported 1:1 from `AddonDescription`.
class AddonDescription extends ConsumerStatefulWidget {
  const AddonDescription({super.key, required this.text});

  final String text;

  @override
  ConsumerState<AddonDescription> createState() => _AddonDescriptionState();
}

class _AddonDescriptionState extends ConsumerState<AddonDescription> {
  bool _expanded = false;

  @override
  void didUpdateWidget(AddonDescription oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) _expanded = false;
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final style = TextStyle(fontSize: 14, height: 1.55, color: t.inkMuted);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 672),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final painter = TextPainter(
            text: TextSpan(text: widget.text, style: style),
            maxLines: 3,
            textDirection: Directionality.of(context),
          )..layout(maxWidth: constraints.maxWidth);
          final overflows = painter.didExceedMaxLines;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.text,
                style: style,
                maxLines: _expanded ? null : 3,
                overflow: _expanded ? TextOverflow.clip : TextOverflow.ellipsis,
              ),
              if (overflows)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 8,
                    onPressed: () => setState(() => _expanded = !_expanded),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _expanded ? 'Show less' : 'View more',
                          style: TextStyle(
                            color: t.accent,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2.07,
                          ),
                        ),
                        const SizedBox(width: 4),
                        AnimatedRotation(
                          turns: _expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: Icon(
                            Icons.keyboard_arrow_down,
                            size: 14,
                            color: t.accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
