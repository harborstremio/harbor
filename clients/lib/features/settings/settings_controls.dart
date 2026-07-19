import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/focus/focusable.dart';
import '../../design/focus/text_field_escape.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../design/focus/tv_text_field.dart';
import '../../domain/companion/companion_link.dart';
import '../companion/companion_sheet.dart';

/// A titled group of settings controls — the native port of the web settings
/// `Section` (title + subtitle over a stack of rows).
class SettingsSection extends StatelessWidget {
  const SettingsSection({
    super.key,
    required this.title,
    required this.tokens,
    this.subtitle,
    required this.children,
  });

  final String title;
  final String? subtitle;
  final HarborTokens tokens;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: TextStyle(
            color: t.ink,
            fontSize: 19,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(
            subtitle!,
            style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
          ),
        ],
        const SizedBox(height: 14),
        for (final (i, child) in children.indexed) ...[
          if (i > 0) const SizedBox(height: 10),
          child,
        ],
      ],
    );
  }
}

/// A label + description row with a trailing switch — the native `ToggleRow`.
/// The whole row is focusable and toggles on Select/tap.
class SettingToggleRow extends StatelessWidget {
  const SettingToggleRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.tokens,
    this.sub,
  });

  final String label;
  final String? sub;
  final bool value;
  final ValueChanged<bool> onChanged;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 14,
      onPressed: () => onChanged(!value),
      child: Container(
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: t.edgeSoft),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (sub != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      sub!,
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 16),
            _Switch(on: value, tokens: t),
          ],
        ),
      ),
    );
  }
}

/// The switch pill drawn for [SettingToggleRow] — presentation only; the row
/// owns the tap.
class _Switch extends StatelessWidget {
  const _Switch({required this.on, required this.tokens});

  final bool on;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOut,
      width: 44,
      height: 26,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: on ? t.accent : t.raised,
        borderRadius: BorderRadius.circular(999),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOut,
        alignment: on ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

/// A masked API-key / token input — the native port of the web settings
/// `KeyField`. The value is obscured with a reveal toggle, and a Save control
/// appears once the draft differs from the stored value; saving commits the
/// trimmed text. Secrets are persisted to the keychain by the settings repo, so
/// nothing here writes a secret to plaintext prefs.
class SettingKeyField extends StatefulWidget {
  const SettingKeyField({
    super.key,
    required this.tokens,
    required this.label,
    required this.placeholder,
    required this.value,
    required this.onSave,
    this.trailing,
  });

  final HarborTokens tokens;
  final String label;
  final String placeholder;
  final String value;
  final ValueChanged<String> onSave;

  /// An optional widget shown at the end of the label row (e.g. a health chip).
  final Widget? trailing;

  @override
  State<SettingKeyField> createState() => _SettingKeyFieldState();
}

class _SettingKeyFieldState extends State<SettingKeyField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );
  bool _reveal = false;

  @override
  void didUpdateWidget(SettingKeyField old) {
    super.didUpdateWidget(old);
    // Reflect an external change (e.g. secrets merged in after the async load)
    // only when the user has not started editing.
    if (old.value != widget.value && _controller.text == old.value) {
      _controller.text = widget.value;
    }
  }

  /// A D-pad can always leave the field vertically — without this a TV remote
  /// enters the editor and never gets back out.
  final FocusNode _focus = escapableTextFieldNode(
    debugLabel: 'SettingKeyField',
  );

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  bool get _dirty => _controller.text.trim() != widget.value.trim();

  void _save() {
    widget.onSave(_controller.text.trim());
    FocusScope.of(context).unfocus();
    setState(() {});
  }

  Future<void> _enterOnPhone(WidgetRef ref) async {
    final value = await enterOnPhone(
      context,
      ref,
      label: widget.label,
      kind: CompanionKind.key,
    );
    if (value != null && value.isNotEmpty && mounted) {
      _controller.text = value;
      widget.onSave(value);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Container(
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: t.edgeSoft),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.label.toUpperCase(),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.4,
                  ),
                ),
              ),
              if (widget.trailing != null) ...[
                const SizedBox(width: 8),
                widget.trailing!,
              ],
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TvTextField(
                  controller: _controller,
                  focusNode: _focus,
                  obscureText: !_reveal,
                  autocorrect: false,
                  enableSuggestions: false,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _save(),
                  style: TextStyle(color: t.ink, fontSize: 15),
                  cursorColor: t.accent,
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: widget.placeholder,
                    hintStyle: TextStyle(color: t.inkSubtle),
                  ),
                ),
              ),
              // On a TV, keys are painful to type on the remote — offer to
              // enter this one from a phone (scan the QR). Hidden off-TV.
              if (Idiom.of(context).isTv) ...[
                Consumer(
                  builder: (context, ref, _) => _KeyFieldButton(
                    tokens: t,
                    icon: Icons.smartphone,
                    onPressed: () => _enterOnPhone(ref),
                  ),
                ),
                const SizedBox(width: 6),
              ],
              _KeyFieldButton(
                tokens: t,
                icon: _reveal ? Icons.visibility_off : Icons.visibility,
                onPressed: () => setState(() => _reveal = !_reveal),
              ),
              if (_dirty) ...[
                const SizedBox(width: 6),
                _KeyFieldButton(
                  tokens: t,
                  icon: Icons.check,
                  filled: true,
                  onPressed: _save,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _KeyFieldButton extends StatelessWidget {
  const _KeyFieldButton({
    required this.tokens,
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final HarborTokens tokens;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 10,
      onPressed: onPressed,
      child: Container(
        width: 38,
        height: 34,
        decoration: BoxDecoration(
          color: filled ? t.accent : t.raised,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: filled ? t.canvas : t.inkMuted),
      ),
    );
  }
}

/// One option in a [SettingRadioGroup]: a value, a title, and an explanatory
/// line.
class SettingRadioOption<T> {
  const SettingRadioOption({
    required this.value,
    required this.label,
    this.sub,
  });
  final T value;
  final String label;
  final String? sub;
}

/// A vertical radio group where each option carries a description — the native
/// port of the web settings pickers (e.g. the stream-safety filter). Each row is
/// focusable and selects on Select/tap.
class SettingRadioGroup<T> extends StatelessWidget {
  const SettingRadioGroup({
    super.key,
    required this.tokens,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.options,
  });

  final HarborTokens tokens;
  final String label;
  final T value;
  final ValueChanged<T> onChanged;
  final List<SettingRadioOption<T>> options;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 10),
        for (final (i, opt) in options.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          _card(t, opt),
        ],
      ],
    );
  }

  Widget _card(HarborTokens t, SettingRadioOption<T> opt) {
    final selected = opt.value == value;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 16,
      onPressed: () => onChanged(opt.value),
      child: Container(
        decoration: BoxDecoration(
          color: selected ? t.elevated : t.canvas.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? t.ink : t.edgeSoft,
            width: selected ? 1.5 : 1,
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 1),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected ? t.ink : t.edge, width: 2),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: t.ink,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    opt.label,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (opt.sub != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      opt.sub!,
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A search-and-toggle language multi-select — the native port of the web
/// `LanguagesPicker`. Selected languages show as removable chips (kept in
/// selection order, which drives ranking priority); a search box filters the
/// available list, capped when no query is entered.
class SettingLanguagePicker extends StatefulWidget {
  const SettingLanguagePicker({
    super.key,
    required this.tokens,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.options,
    this.subtitle,
  });

  final HarborTokens tokens;
  final String label;
  final String? subtitle;
  final List<String> value;
  final ValueChanged<List<String>> onChanged;
  final List<String> options;

  @override
  State<SettingLanguagePicker> createState() => _SettingLanguagePickerState();
}

class _SettingLanguagePickerState extends State<SettingLanguagePicker> {
  static const int _cap = 24;
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle(String lang) {
    final next = [...widget.value];
    if (next.contains(lang)) {
      next.remove(lang);
    } else {
      next.add(lang);
    }
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final selected = widget.value.toSet();
    final q = _query.trim().toLowerCase();
    final available = widget.options.where((l) => !selected.contains(l));
    final matches = q.isEmpty
        ? available.toList()
        : available.where((l) => l.toLowerCase().contains(q)).toList();
    final shown = q.isEmpty ? matches.take(_cap).toList() : matches;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label.toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.4,
          ),
        ),
        if (widget.subtitle != null) ...[
          const SizedBox(height: 4),
          Text(
            widget.subtitle!,
            style: TextStyle(color: t.inkMuted, fontSize: 12.5, height: 1.35),
          ),
        ],
        const SizedBox(height: 10),
        if (widget.value.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final lang in widget.value)
                _chip(t, lang, selected: true, onTap: () => _toggle(lang)),
            ],
          ),
          const SizedBox(height: 10),
        ],
        Container(
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Icon(Icons.search, size: 16, color: t.inkSubtle),
              const SizedBox(width: 10),
              Expanded(
                child: TvTextField(
                  controller: _controller,
                  autocorrect: false,
                  onChanged: (v) => setState(() => _query = v),
                  style: TextStyle(color: t.ink, fontSize: 14),
                  cursorColor: t.accent,
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: 'Search languages',
                    hintStyle: TextStyle(color: t.inkSubtle),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final lang in shown)
              _chip(t, lang, selected: false, onTap: () => _toggle(lang)),
          ],
        ),
      ],
    );
  }

  Widget _chip(
    HarborTokens t,
    String lang, {
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? t.accentSoft : t.canvas.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? t.accent : t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              lang,
              style: TextStyle(
                color: selected ? t.accent : t.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (selected) ...[
              const SizedBox(width: 6),
              Icon(Icons.close, size: 13, color: t.accent),
            ],
          ],
        ),
      ),
    );
  }
}

/// A remote-operable slider: focus it and press Left/Right to adjust by [step]
/// (Up/Down pass through for row traversal). Shows the value via [format] and a
/// Reset control when it differs from [resetTo]. The native `SizeSlider`.
class SettingSlider extends StatefulWidget {
  const SettingSlider({
    super.key,
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
    required this.tokens,
    this.resetTo,
    this.format,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final double step;
  final ValueChanged<double> onChanged;
  final HarborTokens tokens;

  /// When set and the value differs, a Reset control returns to this value.
  final double? resetTo;

  /// Formats the value readout (default: whole-number percent).
  final String Function(double)? format;

  @override
  State<SettingSlider> createState() => _SettingSliderState();
}

class _SettingSliderState extends State<SettingSlider> {
  final FocusNode _node = FocusNode();
  bool _focused = false;

  @override
  void dispose() {
    _node.dispose();
    super.dispose();
  }

  void _nudge(int dir) {
    final steps = ((widget.value - widget.min) / widget.step).round() + dir;
    final next = (widget.min + steps * widget.step).clamp(
      widget.min,
      widget.max,
    );
    if (next != widget.value) widget.onChanged(next);
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowLeft) {
      _nudge(-1);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowRight) {
      _nudge(1);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final fraction = ((widget.value - widget.min) / (widget.max - widget.min))
        .clamp(0.0, 1.0);
    final readout = (widget.format ?? (v) => '${(v * 100).round()}%')(
      widget.value,
    );
    final canReset = widget.resetTo != null && widget.value != widget.resetTo;

    return Focus(
      focusNode: _node,
      onKeyEvent: _onKey,
      onFocusChange: (f) => setState(() => _focused = f),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _node.requestFocus,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: t.canvas.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _focused ? t.accent : t.edgeSoft,
              width: _focused ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 120,
                child: Text(
                  widget.label,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: LayoutBuilder(
                  builder: (context, c) => Stack(
                    alignment: Alignment.centerLeft,
                    children: [
                      Container(
                        height: 4,
                        decoration: BoxDecoration(
                          color: t.raised,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      Container(
                        height: 4,
                        width: c.maxWidth * fraction,
                        decoration: BoxDecoration(
                          color: t.accent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      Positioned(
                        left: (c.maxWidth * fraction - 8).clamp(
                          0.0,
                          c.maxWidth - 16,
                        ),
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            border: Border.all(color: t.accent, width: 2),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 48,
                child: Text(
                  readout,
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 13,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              if (canReset)
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 8,
                  onPressed: () => widget.onChanged(widget.resetTo!),
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      'Reset',
                      style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Parses a `#RRGGBB` hex string to an opaque [Color] (black on failure).
Color hexToColor(String hex) {
  final h = hex.replaceAll('#', '').trim();
  final v = int.tryParse(h.length == 6 ? h : '000000', radix: 16) ?? 0;
  return Color(0xFF000000 | v);
}

/// A labelled row of selectable colour swatches — the remote-operable native
/// counterpart of the web colour popover. Picks from a curated palette (plus
/// the current value if custom); Reset returns to [resetTo].
class SettingColorSwatches extends StatelessWidget {
  const SettingColorSwatches({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.tokens,
    this.palette = kColorPalette,
    this.resetTo,
  });

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final HarborTokens tokens;
  final List<String> palette;
  final String? resetTo;

  static const kColorPalette = <String>[
    '#FFFFFF',
    '#000000',
    '#FFFF00',
    '#FF3B30',
    '#34C759',
    '#00E5FF',
    '#0A84FF',
    '#FF9500',
    '#FF2D95',
    '#8E8E93',
  ];

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final upper = value.toUpperCase();
    final swatches = [
      if (!palette.map((c) => c.toUpperCase()).contains(upper)) value,
      ...palette,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (resetTo != null && upper != resetTo!.toUpperCase())
              Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 8,
                onPressed: () => onChanged(resetTo!),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  child: Text(
                    'Reset',
                    style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final hex in swatches)
                Focusable(
                  tokens: t,
                  scale: 1.12,
                  borderRadius: 999,
                  onPressed: () => onChanged(hex),
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hexToColor(hex),
                      border: Border.all(
                        color: hex.toUpperCase() == upper ? t.accent : t.edge,
                        width: hex.toUpperCase() == upper ? 3 : 1,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A single option in a [SettingOptionCards] group.
class SettingOption<T> {
  const SettingOption({required this.value, required this.label, this.sub});

  final T value;
  final String label;
  final String? sub;
}

/// A labelled compact segmented control — the native port of the web
/// `Segmented`: a title, a row of selectable chips, and optional help text.
class SettingSegmented<T> extends StatelessWidget {
  const SettingSegmented({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    required this.tokens,
    this.sub,
  });

  final String label;
  final String? sub;
  final T value;
  final List<SettingOption<T>> options;
  final ValueChanged<T> onChanged;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: t.ink,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final opt in options)
                Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 10,
                  onPressed: () => onChanged(opt.value),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: opt.value == value
                          ? t.accentSoft
                          : t.canvas.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: opt.value == value ? t.accent : t.edgeSoft,
                      ),
                    ),
                    child: Text(
                      opt.label,
                      style: TextStyle(
                        color: opt.value == value ? t.accent : t.inkMuted,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (sub != null) ...[
          const SizedBox(height: 8),
          Text(
            sub!,
            style: TextStyle(color: t.inkSubtle, fontSize: 12.5, height: 1.35),
          ),
        ],
      ],
    );
  }
}

/// A row of selectable option cards (label + description), one highlighted —
/// the native port of the web pickers such as `HomeModePicker`.
class SettingOptionCards<T> extends StatelessWidget {
  const SettingOptionCards({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
    required this.tokens,
  });

  final T value;
  final List<SettingOption<T>> options;
  final ValueChanged<T> onChanged;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final width =
            (constraints.maxWidth - gap * (options.length - 1)) /
            options.length;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final opt in options)
              SizedBox(
                width: width < 200 ? constraints.maxWidth : width,
                child: Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 14,
                  onPressed: () => onChanged(opt.value),
                  child: Container(
                    decoration: BoxDecoration(
                      color: opt.value == value
                          ? t.accentSoft
                          : t.canvas.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: opt.value == value ? t.accent : t.edgeSoft,
                        width: opt.value == value ? 2 : 1,
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              opt.value == value
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_unchecked,
                              size: 18,
                              color: opt.value == value
                                  ? t.accent
                                  : t.inkSubtle,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                opt.label,
                                style: TextStyle(
                                  color: t.ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (opt.sub != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            opt.sub!,
                            style: TextStyle(
                              color: t.inkSubtle,
                              fontSize: 12.5,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
