import 'dart:async';

import 'package:flutter/material.dart';

import '../tokens.dart';

/// Example queries cycled behind the episode AI-finder field. Ported from
/// `ai-example-hint.tsx` `EPISODE_EXAMPLES`.
const List<String> kEpisodeExamples = [
  'The one where they go to the beach.',
  'The courtroom episode.',
  'When everyone gets snowed in.',
  'The one with the talent show.',
  'Where the new kid shows up.',
  'The musical episode.',
  'The one that ends on a cliffhanger.',
];

/// Example queries cycled behind the AI search field. Ported from
/// `ai-example-hint.tsx` `SEARCH_EXAMPLES`.
const List<String> kSearchExamples = [
  'the movie where a hitman spares a kid',
  'a show like Severance but funnier',
  'the south park episode with kanye west',
  'underrated 90s sci-fi thrillers',
  'feel-good anime for a rainy day',
  'movies with a twist you never see coming',
  'the one where they rob a casino',
  'slow-burn mysteries set in small towns',
];

/// A placeholder for an AI query field that cycles through example prompts every
/// six seconds, shown only while the field is empty. Ported from
/// `AiExampleHint`: the web sweeps a CSS text-shimmer across the example; here
/// the example carries a static ink gradient (a live-repeating animation would
/// stall every `pumpAndSettle` in the suite), and the rotation is the parity
/// behaviour.
class AiExampleHint extends StatefulWidget {
  const AiExampleHint({
    super.key,
    required this.hidden,
    required this.examples,
    required this.tokens,
    this.prefix = '',
    this.fontSize = 14.5,
  });

  /// Hidden once the field has text (the real value takes over).
  final bool hidden;
  final List<String> examples;
  final HarborTokens tokens;

  /// A lead-in shown before the rotating example (e.g. "Describe the episode.").
  final String prefix;
  final double fontSize;

  @override
  State<AiExampleHint> createState() => _AiExampleHintState();
}

class _AiExampleHintState extends State<AiExampleHint> {
  int _i = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (!widget.hidden) _start();
  }

  void _start() {
    _timer?.cancel();
    if (widget.examples.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      setState(() => _i = (_i + 1) % widget.examples.length);
    });
  }

  @override
  void didUpdateWidget(AiExampleHint old) {
    super.didUpdateWidget(old);
    if (widget.hidden != old.hidden) {
      if (widget.hidden) {
        _timer?.cancel();
        _timer = null;
      } else {
        _start();
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.hidden || widget.examples.isEmpty) {
      return const SizedBox.shrink();
    }
    final t = widget.tokens;
    final example = widget.examples[_i % widget.examples.length];
    final style = TextStyle(
      fontSize: widget.fontSize,
      fontWeight: FontWeight.w500,
    );
    return IgnorePointer(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.prefix.isNotEmpty)
            Text(
              '${widget.prefix} ',
              style: style.copyWith(color: t.inkSubtle),
            ),
          Flexible(
            child: ShaderMask(
              blendMode: BlendMode.srcIn,
              shaderCallback: (rect) => LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [t.inkMuted, t.ink, t.inkMuted],
                stops: const [0.15, 0.5, 0.85],
              ).createShader(rect),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 320),
                child: Text(
                  example,
                  key: ValueKey(example),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: style.copyWith(color: t.inkMuted),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
