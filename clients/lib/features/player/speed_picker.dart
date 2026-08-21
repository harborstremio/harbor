import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/player/sleep_timer.dart';

/// The curated playback speeds, byte-identical to the web speed menu's
/// `CURATED_SPEEDS`. User-added speeds from `customPlaybackSpeeds` are merged in.
const List<double> kCuratedSpeeds = [0.75, 1.0, 1.25, 1.5, 2.0];

/// One row in the speed list: a rate and whether it came from the user's custom
/// set (removable) rather than the curated defaults.
class _SpeedRow {
  const _SpeedRow(this.value, this.custom);
  final double value;
  final bool custom;
}

/// The in-player playback-speed picker — a native, remote-navigable port of the
/// web `speed-menu` speed section. It lists the curated speeds merged with the
/// viewer's `customPlaybackSpeeds` (sorted, de-duped); picking one applies it and
/// closes. An edit toggle reveals a remove control on each custom speed and an
/// add stepper (0.1–4×) that appends a new custom speed. Every control is
/// [Focusable] and the panel is a focus-trapped group, so a TV remote fully
/// drives it; the dimmed backdrop or Back dismisses.
class SpeedPicker extends StatefulWidget {
  const SpeedPicker({
    super.key,
    required this.tokens,
    required this.tr,
    required this.current,
    required this.custom,
    required this.onSelect,
    required this.onAddCustom,
    required this.onRemoveCustom,
    required this.onClose,
    this.showSleep = false,
    this.sleepSelectedId,
    this.sleepActiveLabel,
    this.sleepCustom = const [],
    this.onSleepPreset,
    this.onAddSleepCustom,
    this.onRemoveSleepCustom,
    this.onSleepCancel,
  });

  final HarborTokens tokens;
  final Translations tr;

  /// The current playback rate (the selected row).
  final double current;

  /// The viewer's custom speeds (the `customPlaybackSpeeds` setting).
  final List<double> custom;

  /// Applies [rate] and closes.
  final ValueChanged<double> onSelect;

  /// Adds [rate] to the custom set (already validated + de-duped by the caller).
  final ValueChanged<double> onAddCustom;

  /// Removes [rate] from the custom set.
  final ValueChanged<double> onRemoveCustom;
  final VoidCallback onClose;

  /// Whether to render the sleep-timer section (VOD only — the web menu adds it
  /// as a second section). All the `sleep*` fields are consulted only then.
  final bool showSleep;

  /// The armed sleep preset id (a [SleepPreset.id], or a custom minutes value as
  /// a string), or null when no sleep is armed.
  final String? sleepSelectedId;

  /// The live label for an armed sleep — a `mm:ss` countdown for a minutes timer.
  final String? sleepActiveLabel;

  /// The viewer's custom sleep minutes (`customSleepMinutes`).
  final List<int> sleepCustom;

  final ValueChanged<SleepPreset>? onSleepPreset;
  final ValueChanged<int>? onAddSleepCustom;
  final ValueChanged<int>? onRemoveSleepCustom;
  final VoidCallback? onSleepCancel;

  @override
  State<SpeedPicker> createState() => _SpeedPickerState();
}

class _SpeedPickerState extends State<SpeedPicker> {
  bool _editing = false;
  double _addValue = 1.35;
  int _sleepAddValue = 20;

  final FocusScopeNode _scope = FocusScopeNode(debugLabel: 'speed-picker');

  /// The always-present Edit/Done toggle — a stable landing spot for the remote
  /// after an add/remove disposes the control that had focus (otherwise the
  /// D-pad highlight vanishes and the panel goes dead).
  final FocusNode _editFocus = FocusNode(debugLabel: 'speed-edit-toggle');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scope.requestFocus();
    });
  }

  @override
  void didUpdateWidget(SpeedPicker old) {
    super.didUpdateWidget(old);
    // An in-panel add/remove rebuilds us with a changed custom set, disposing
    // the row/button that held focus. Land the remote on the Edit/Done toggle
    // so the panel stays drivable. (Guarded on an actual list change, so the
    // live sleep countdown rebuild doesn't yank focus.)
    if (!listEquals(old.custom, widget.custom) ||
        !listEquals(old.sleepCustom, widget.sleepCustom)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _editing) _editFocus.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _editFocus.dispose();
    _scope.dispose();
    super.dispose();
  }

  HarborTokens get t => widget.tokens;
  Translations get tr => widget.tr;

  /// The curated speeds merged with the custom set, sorted ascending, de-duped —
  /// the web `speedList` memo.
  List<_SpeedRow> get _rows {
    final seen = <double>{};
    final rows = <_SpeedRow>[];
    for (final s in kCuratedSpeeds) {
      if (seen.add(s)) rows.add(_SpeedRow(s, false));
    }
    for (final s in widget.custom) {
      final v = _round(s);
      if (seen.add(v)) rows.add(_SpeedRow(v, true));
    }
    rows.sort((a, b) => a.value.compareTo(b.value));
    return rows;
  }

  static double _round(double v) => (v * 100).roundToDouble() / 100;

  /// A compact label: `1`, `1.5`, `0.75` (no trailing zeros), matching the
  /// player's own `_speedText`.
  String _speedText(double sp) =>
      sp == sp.roundToDouble() ? sp.toStringAsFixed(0) : '$sp';

  bool _isSelected(double v) => (widget.current - v).abs() < 0.01;

  /// Whether [_addValue] can be added (finite, in range, not already present).
  bool get _canAdd {
    final v = _round(_addValue);
    if (v < 0.1 || v > 4) return false;
    if (kCuratedSpeeds.contains(v)) return false;
    return !widget.custom.map(_round).contains(v);
  }

  void _stepAdd(double delta) {
    setState(() => _addValue = (_round(_addValue + delta)).clamp(0.1, 4.0));
  }

  @override
  Widget build(BuildContext context) {
    final idiom = Idiom.of(context);
    final wide = !idiom.isPhone;
    final rows = _rows;

    final panel = Container(
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: t.edge),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _header(),
          Flexible(
            child: ListView(
              padding: const EdgeInsets.all(8),
              shrinkWrap: true,
              children: [
                if (widget.showSleep) _sectionLabel(tr.t('Playback speed')),
                for (final r in rows) _speedRow(r),
                if (_editing) _addRow(),
                if (widget.showSleep) ...[
                  const SizedBox(height: 6),
                  _sectionLabel(tr.t('Sleep timer')),
                  for (final (m, custom) in _sleepMinuteRows)
                    _sleepMinuteRow(m, custom),
                  for (final p in kSleepPresets)
                    if (p.minutes == null) _sleepEpisodeRow(p),
                  if (_editing) _addSleepRow(),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    return FocusScope(
      node: _scope,
      child: FocusTraversalGroup(
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onClose,
                child: ColoredBox(color: Colors.black.withValues(alpha: 0.5)),
              ),
            ),
            SafeArea(
              child: Align(
                alignment: wide
                    ? AlignmentDirectional.bottomEnd
                    : Alignment.bottomCenter,
                child: Padding(
                  padding: EdgeInsets.all(wide ? 20 : 12),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: 360,
                      maxHeight: MediaQuery.sizeOf(context).height * 0.72,
                    ),
                    child: panel,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() => Container(
    padding: const EdgeInsetsDirectional.only(start: 16, end: 8),
    height: 52,
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
    ),
    child: Row(
      children: [
        Text(
          widget.showSleep ? tr.t('Speed & sleep') : tr.t('Playback speed'),
          style: TextStyle(
            color: t.ink,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        const Spacer(),
        _iconAction(
          icon: _editing ? Icons.done_rounded : Icons.edit_outlined,
          tooltip: _editing ? tr.t('Done') : tr.t('Edit'),
          active: _editing,
          focusNode: _editFocus,
          onPressed: () => setState(() => _editing = !_editing),
        ),
        _iconAction(
          icon: Icons.close_rounded,
          tooltip: tr.t('Close'),
          onPressed: widget.onClose,
        ),
      ],
    ),
  );

  Widget _iconAction({
    required IconData icon,
    required String tooltip,
    required VoidCallback onPressed,
    bool active = false,
    FocusNode? focusNode,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    focusNode: focusNode,
    onPressed: onPressed,
    child: Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      child: Icon(icon, size: 18, color: active ? t.accent : t.inkMuted),
    ),
  );

  Widget _speedRow(_SpeedRow r) {
    final selected = _isSelected(r.value);
    final label = r.value == 1.0 ? tr.t('Normal') : '${_speedText(r.value)}×';
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        children: [
          Expanded(
            child: Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 10,
              autofocus: selected,
              onPressed: () => widget.onSelect(r.value),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 11,
                ),
                decoration: BoxDecoration(
                  color: selected ? t.raised : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: selected ? t.edge : Colors.transparent,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 16,
                      height: 16,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: selected ? t.accent : t.raised,
                      ),
                      child: selected
                          ? Icon(Icons.check, size: 10, color: t.canvas)
                          : null,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      label,
                      style: TextStyle(
                        color: selected ? t.ink : t.inkMuted,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (r.value == 1.0) ...[
                      const SizedBox(width: 8),
                      Text(
                        tr.t('default'),
                        style: TextStyle(color: t.inkSubtle, fontSize: 11),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          // A custom speed can be removed in edit mode.
          if (_editing && r.custom)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 6),
              child: Focusable(
                tokens: t,
                scale: 1.0,
                borderRadius: 999,
                onPressed: () => widget.onRemoveCustom(r.value),
                child: Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.remove_circle_outline,
                    size: 18,
                    color: t.danger,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _addRow() => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          _stepButton(Icons.remove_rounded, () => _stepAdd(-0.05)),
          Expanded(
            child: Text(
              '${_speedText(_round(_addValue))}×',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.ink,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          _stepButton(Icons.add_rounded, () => _stepAdd(0.05)),
          const SizedBox(width: 8),
          // When the value can't be added (out of range / already present) the
          // pill is a dead target — exclude it from focus so the D-pad skips it
          // rather than landing on a button that does nothing on Select.
          ExcludeFocus(
            excluding: !_canAdd,
            child: Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 999,
              onPressed: _canAdd
                  ? () => widget.onAddCustom(_round(_addValue))
                  : () {},
              child: Opacity(
                opacity: _canAdd ? 1 : 0.4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: t.accent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    tr.t('Add'),
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _stepButton(IconData icon, VoidCallback onPressed) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: t.edgeSoft),
      ),
      child: Icon(icon, size: 18, color: t.inkMuted),
    ),
  );

  // ── Sleep timer section ─────────────────────────────────────────────────

  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(
        color: t.inkSubtle,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
      ),
    ),
  );

  /// The sleep minute rows: the curated `30`/`60` merged with the viewer's
  /// custom minutes, sorted, de-duped (custom ones flagged for the remove icon).
  List<(int, bool)> get _sleepMinuteRows {
    final seen = <int>{};
    final rows = <(int, bool)>[];
    for (final m in const [30, 60]) {
      if (seen.add(m)) rows.add((m, false));
    }
    for (final m in widget.sleepCustom) {
      if (seen.add(m)) rows.add((m, true));
    }
    rows.sort((a, b) => a.$1.compareTo(b.$1));
    return rows;
  }

  /// A sleep minute label: `1 hour` for 60, else `N min` (web `SLEEP_PRESETS`).
  String _minuteLabel(int m) =>
      m == 60 ? tr.t('1 hour') : tr.t('{n} min', {'n': m});

  Widget _sleepMinuteRow(int minutes, bool custom) {
    final selected = widget.sleepSelectedId == '$minutes';
    final trailing = selected ? widget.sleepActiveLabel : null;
    return _sleepRowShell(
      selected: selected,
      label: _minuteLabel(minutes),
      trailing: trailing,
      onTap: selected
          ? widget.onSleepCancel
          : () => widget.onSleepPreset?.call(
              SleepPreset(
                id: '$minutes',
                label: _minuteLabel(minutes),
                minutes: minutes,
              ),
            ),
      onRemove: (_editing && custom)
          ? () => widget.onRemoveSleepCustom?.call(minutes)
          : null,
    );
  }

  Widget _sleepEpisodeRow(SleepPreset p) {
    final selected = widget.sleepSelectedId == p.id;
    return _sleepRowShell(
      selected: selected,
      label: tr.t(p.label),
      onTap: selected
          ? widget.onSleepCancel
          : () => widget.onSleepPreset?.call(p),
    );
  }

  /// The shared sleep row: a selectable pill with a check, optional live trailing
  /// (countdown), and an optional remove control for a custom minute.
  Widget _sleepRowShell({
    required bool selected,
    required String label,
    String? trailing,
    VoidCallback? onTap,
    VoidCallback? onRemove,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 2),
    child: Row(
      children: [
        Expanded(
          child: Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 10,
            onPressed: onTap ?? () {},
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              decoration: BoxDecoration(
                color: selected ? t.raised : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: selected ? t.edge : Colors.transparent,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 16,
                    height: 16,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected ? t.accent : t.raised,
                    ),
                    child: selected
                        ? Icon(Icons.check, size: 10, color: t.canvas)
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: selected ? t.ink : t.inkMuted,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (trailing != null)
                    Text(
                      trailing,
                      style: TextStyle(
                        color: t.accent,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (onRemove != null)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 6),
            child: Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 999,
              onPressed: onRemove,
              child: Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                child: Icon(
                  Icons.remove_circle_outline,
                  size: 18,
                  color: t.danger,
                ),
              ),
            ),
          ),
      ],
    ),
  );

  bool get _canAddSleep {
    final v = _sleepAddValue;
    if (v < 1 || v > 1440) return false;
    if (v == 30 || v == 60) return false;
    return !widget.sleepCustom.contains(v);
  }

  Widget _addSleepRow() => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          _stepButton(
            Icons.remove_rounded,
            () => setState(
              () => _sleepAddValue = (_sleepAddValue - 5).clamp(1, 1440),
            ),
          ),
          Expanded(
            child: Text(
              tr.t('{n} min', {'n': _sleepAddValue}),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.ink,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          _stepButton(
            Icons.add_rounded,
            () => setState(
              () => _sleepAddValue = (_sleepAddValue + 5).clamp(1, 1440),
            ),
          ),
          const SizedBox(width: 8),
          ExcludeFocus(
            excluding: !_canAddSleep,
            child: Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 999,
              onPressed: _canAddSleep
                  ? () => widget.onAddSleepCustom?.call(_sleepAddValue)
                  : () {},
              child: Opacity(
                opacity: _canAddSleep ? 1 : 0.4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: t.accent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    tr.t('Add'),
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
