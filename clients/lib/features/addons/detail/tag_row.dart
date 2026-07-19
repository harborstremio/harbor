import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/curated.dart';
import '../../../domain/addons/resolved_addon.dart';

enum _Tone { neutral, warn, good }

/// The curated-tag chip row under the addon-detail header, ported 1:1 from
/// `TagRow`. Empty when the addon has no taggable attributes.
class TagRow extends ConsumerWidget {
  const TagRow({super.key, required this.resolved});

  final ResolvedAddon resolved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chips = <({String label, _Tone tone})>[];
    for (final tag in resolved.curated?.tags ?? const <AddonTag>[]) {
      switch (tag) {
        case AddonTag.official:
          chips.add((label: 'Official', tone: _Tone.good));
        case AddonTag.free:
          chips.add((label: 'Free', tone: _Tone.neutral));
        case AddonTag.premium:
          chips.add((label: 'Paid', tone: _Tone.warn));
        case AddonTag.debridRequired:
          chips.add((label: 'Debrid required', tone: _Tone.warn));
        case AddonTag.configurable:
          chips.add((label: 'Configurable', tone: _Tone.neutral));
        case AddonTag.usenet:
          chips.add((label: 'Usenet', tone: _Tone.neutral));
        case AddonTag.p2p || AddonTag.torrent || AddonTag.selfHost:
          break; // not surfaced as a chip
      }
    }
    if (resolved.manifest?.adult ?? false) {
      chips.add((label: 'Adult', tone: _Tone.warn));
    }
    if (chips.isEmpty) return const SizedBox.shrink();

    final t = ref.watch(tokensProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [for (final c in chips) _chip(c.label, c.tone, t)],
      ),
    );
  }

  Widget _chip(String label, _Tone tone, HarborTokens t) {
    final (bg, fg) = switch (tone) {
      _Tone.good => (t.accent.withValues(alpha: 0.15), t.accent),
      _Tone.warn => (t.edge, t.inkMuted),
      _Tone.neutral => (t.edge, t.inkSubtle),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: fg,
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.05,
        ),
      ),
    );
  }
}
