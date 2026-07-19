import 'package:flutter/material.dart';

import '../../design/flag.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/language/language_names.dart';

/// One subtitle option in the picker — an engine track (embedded or an
/// engine-added external) or an external search result not yet added. [key] is
/// the stable id the player maps back to a selection (`trk:<id>` / `ext:<i>`).
class SubtitleVariant {
  const SubtitleVariant({
    required this.key,
    required this.lang,
    required this.title,
    required this.external,
    this.codec,
    this.forced = false,
    this.hearingImpaired = false,
    this.isDefault = false,
    this.imported = false,
  });

  final String key;
  final String lang; // language code, or '' when unknown
  final String title; // release/title text, or ''
  final bool external;
  final String? codec;
  final bool forced;
  final bool hearingImpaired;
  final bool isDefault;
  final bool imported;

  String get langDisplay =>
      lang.trim().isEmpty ? 'Unknown' : languageName(lang);
  String get langGroupKey => langDisplay.toLowerCase();
}

class _LangGroup {
  _LangGroup(this.key, this.display);
  final String key;
  final String display;
  final List<SubtitleVariant> variants = [];
}

List<_LangGroup> _groupByLang(List<SubtitleVariant> tracks) {
  final map = <String, _LangGroup>{};
  for (final t in tracks) {
    (map[t.langGroupKey] ??= _LangGroup(
      t.langGroupKey,
      t.langDisplay,
    )).variants.add(t);
  }
  return map.values.toList();
}

const _kAllLangs = '__all__';

/// The full subtitle picker — a native, remote-navigable port of the web
/// SubtitleMenu MenuBody. Off/On + per-language groups select the language; a
/// filtered track list (All / Embedded / External source tabs, HI and Forced
/// filters) picks the track; a footer searches for more. On a phone the
/// language groups collapse to a horizontal chip row above the list; tablet/TV
/// keep the two-pane layout. Every control is [Focusable], and the whole panel
/// is a focus-trapped group so a TV remote fully drives it; the dimmed backdrop,
/// the close button, or Back dismisses it.
class SubtitlePicker extends StatefulWidget {
  const SubtitlePicker({
    super.key,
    required this.tokens,
    required this.tr,
    required this.variants,
    required this.selectedKey,
    required this.delayActive,
    required this.onSelect,
    required this.onOff,
    required this.onSync,
    required this.onSearch,
    required this.onClose,
    this.searching = false,
  });

  final HarborTokens tokens;
  final Translations tr;
  final List<SubtitleVariant> variants;

  /// The selected variant key, or null when subtitles are off.
  final String? selectedKey;
  final bool delayActive;
  final bool searching;

  final void Function(String key) onSelect;
  final VoidCallback onOff;
  final VoidCallback onSync;
  final Future<void> Function() onSearch;
  final VoidCallback onClose;

  @override
  State<SubtitlePicker> createState() => _SubtitlePickerState();
}

class _SubtitlePickerState extends State<SubtitlePicker> {
  String? _activeLang; // null = auto-first, _kAllLangs = all
  String _sourceFilter = 'all'; // all | embedded | external
  bool _hideHI = false;
  bool _forcedOnly = false;

  /// The picker owns a focus scope; the player root keeps primary focus until
  /// we pull it in here, so without this the D-pad can't reach the picker's
  /// controls at all. Requested after the first frame so the autofocus control
  /// (Off / the selected track) receives it.
  final FocusScopeNode _scope = FocusScopeNode(debugLabel: 'subtitle-picker');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scope.requestFocus();
    });
  }

  @override
  void dispose() {
    _scope.dispose();
    super.dispose();
  }

  HarborTokens get t => widget.tokens;
  Translations get tr => widget.tr;

  List<_LangGroup> get _groups => _groupByLang(widget.variants);

  bool get _offSelected => widget.selectedKey == null;

  /// The active language group, resolving `null` to the group holding the
  /// selection (or the first group).
  String? _resolvedActiveLang(List<_LangGroup> groups) {
    if (groups.isEmpty) return null;
    if (_activeLang == _kAllLangs) return _kAllLangs;
    if (_activeLang != null && groups.any((g) => g.key == _activeLang)) {
      return _activeLang;
    }
    final sel = groups
        .where((g) => g.variants.any((v) => v.key == widget.selectedKey))
        .firstOrNull;
    return sel?.key ?? groups.first.key;
  }

  List<SubtitleVariant> _visible(List<_LangGroup> groups, String? activeLang) {
    final base = activeLang == _kAllLangs
        ? widget.variants
        : (groups.where((g) => g.key == activeLang).firstOrNull?.variants ??
              const []);
    return base.where((v) {
      if (_sourceFilter == 'embedded' && v.external) return false;
      if (_sourceFilter == 'external' && !v.external) return false;
      if (_hideHI && v.hearingImpaired) return false;
      if (_forcedOnly && !v.forced) return false;
      return true;
    }).toList();
  }

  Future<void> _runSearch() async {
    await widget.onSearch();
  }

  @override
  Widget build(BuildContext context) {
    final idiom = Idiom.of(context);
    final wide = !idiom.isPhone;
    final groups = _groups;
    final activeLang = _resolvedActiveLang(groups);
    final visible = _visible(groups, activeLang);
    final embedded = widget.variants.where((v) => !v.external).length;
    final external = widget.variants.where((v) => v.external).length;

    final panel = Container(
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(wide ? 20 : 22),
        border: Border.all(color: t.edge),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _header(),
          Flexible(
            child: wide
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(width: 168, child: _sidebar(groups, activeLang)),
                      Container(width: 1, color: t.edgeSoft),
                      Expanded(child: _trackPane(visible, embedded, external)),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _langChips(groups, activeLang),
                      Container(height: 1, color: t.edgeSoft),
                      Flexible(child: _trackPane(visible, embedded, external)),
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
              child: wide
                  ? Align(
                      alignment: AlignmentDirectional.bottomEnd,
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: 640,
                            maxHeight: MediaQuery.sizeOf(context).height * 0.72,
                          ),
                          child: panel,
                        ),
                      ),
                    )
                  : Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxHeight: MediaQuery.sizeOf(context).height * 0.82,
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
          tr.t('Subtitles'),
          style: TextStyle(
            color: t.ink,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (widget.variants.isNotEmpty) ...[
          const SizedBox(width: 8),
          Text(
            '${widget.variants.length}',
            style: TextStyle(color: t.inkSubtle, fontSize: 12),
          ),
        ],
        const Spacer(),
        _iconAction(
          icon: Icons.timer_outlined,
          tooltip: tr.t('Subtitle sync'),
          badge: widget.delayActive,
          onPressed: () {
            widget.onSync();
            widget.onClose();
          },
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
    bool badge = false,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(icon, size: 18, color: t.inkMuted),
          if (badge)
            PositionedDirectional(
              end: -1,
              top: -1,
              child: Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: t.accent,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    ),
  );

  // ── Wide sidebar ──────────────────────────────────────────────────────────

  Widget _sidebar(List<_LangGroup> groups, String? activeLang) => Container(
    color: t.canvas.withValues(alpha: 0.3),
    padding: const EdgeInsets.all(8),
    child: ListView(
      children: [
        _offOnRow(),
        if (groups.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 4),
            child: Text(
              tr.t('Languages').toUpperCase(),
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.6,
              ),
            ),
          ),
        if (groups.length > 1)
          _langRow(
            active: activeLang == _kAllLangs,
            onTap: () => setState(() => _activeLang = _kAllLangs),
            leading: Icon(Icons.language, size: 14, color: t.inkMuted),
            label: tr.t('All languages'),
            count: widget.variants.length,
          ),
        for (final g in groups)
          _langRow(
            active: activeLang == g.key,
            onTap: () => setState(() => _activeLang = g.key),
            leading: Flag(
              language: g.display,
              tokens: t,
              size: FlagSize.sm,
              showLabel: false,
            ),
            label: g.display,
            count: g.variants.length,
            selectedDot: g.variants.any((v) => v.key == widget.selectedKey),
          ),
      ],
    ),
  );

  Widget _offOnRow() => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 8,
    autofocus: _offSelected,
    onPressed: widget.onOff,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      decoration: BoxDecoration(
        color: _offSelected ? Colors.transparent : t.raised,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 16,
            height: 16,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _offSelected ? t.raised : t.accent,
            ),
            child: _offSelected
                ? null
                : Icon(Icons.check, size: 10, color: t.canvas),
          ),
          const SizedBox(width: 8),
          Text(
            _offSelected ? tr.t('Off') : tr.t('On'),
            style: TextStyle(
              color: _offSelected ? t.inkSubtle : t.ink,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _langRow({
    required bool active,
    required VoidCallback onTap,
    required Widget leading,
    required String label,
    required int count,
    bool selectedDot = false,
  }) => Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 8,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.raised : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? t.edge : Colors.transparent),
        ),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? t.ink : t.inkMuted,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (selectedDot) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: t.accent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              '$count',
              style: TextStyle(color: t.inkSubtle, fontSize: 10.5),
            ),
          ],
        ),
      ),
    ),
  );

  // ── Phone language chips ──────────────────────────────────────────────────

  Widget _langChips(List<_LangGroup> groups, String? activeLang) => SizedBox(
    height: 52,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      children: [
        _chip(
          label: _offSelected ? tr.t('Off') : tr.t('On'),
          active: _offSelected,
          onTap: widget.onOff,
        ),
        if (groups.length > 1)
          _chip(
            label: tr.t('All'),
            active: activeLang == _kAllLangs,
            onTap: () => setState(() => _activeLang = _kAllLangs),
          ),
        for (final g in groups)
          _chip(
            label: '${g.display} · ${g.variants.length}',
            active: activeLang == g.key,
            onTap: () => setState(() => _activeLang = g.key),
          ),
      ],
    ),
  );

  Widget _chip({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) => Padding(
    padding: const EdgeInsetsDirectional.only(end: 8),
    child: Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? t.accentSoft : t.raised,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? t.accent : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? t.accent : t.inkMuted,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ),
  );

  // ── Track pane ────────────────────────────────────────────────────────────

  Widget _trackPane(
    List<SubtitleVariant> visible,
    int embedded,
    int external,
  ) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (widget.variants.isNotEmpty) _filterRow(embedded, external),
      Flexible(
        child: widget.variants.isEmpty
            ? _emptyState()
            : visible.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 24,
                ),
                child: Text(
                  tr.t(
                    'No tracks match these filters. Try toggling HI/SDH or '
                    'Forced.',
                  ),
                  style: TextStyle(color: t.inkMuted, fontSize: 13),
                ),
              )
            : ListView(
                padding: const EdgeInsets.all(8),
                children: [for (final v in visible) _variantRow(v)],
              ),
      ),
      _searchFooter(),
    ],
  );

  Widget _filterRow(int embedded, int external) => Container(
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
      color: t.canvas.withValues(alpha: 0.15),
    ),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    child: Row(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _tab('all', tr.t('All'), widget.variants.length),
                const SizedBox(width: 6),
                _tab('embedded', tr.t('Embedded'), embedded),
                const SizedBox(width: 6),
                _tab('external', tr.t('External'), external),
              ],
            ),
          ),
        ),
        const SizedBox(width: 6),
        _toggleChip(
          tr.t('HI'),
          active: !_hideHI,
          onTap: () {
            setState(() => _hideHI = !_hideHI);
          },
        ),
        const SizedBox(width: 4),
        _toggleChip(
          tr.t('Forced'),
          active: _forcedOnly,
          onTap: () {
            setState(() => _forcedOnly = !_forcedOnly);
          },
        ),
      ],
    ),
  );

  Widget _tab(String value, String label, int count) {
    final active = _sourceFilter == value;
    final disabled = count == 0 && value != 'all';
    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: Focusable(
        key: Key('sub-tab-$value'),
        tokens: t,
        scale: 1.0,
        borderRadius: 999,
        onPressed: disabled
            ? () {}
            : () => setState(() => _sourceFilter = value),
        child: Container(
          height: 28,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: active ? t.raised : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: active ? t.edge : Colors.transparent),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: active ? t.ink : t.inkMuted,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '$count',
                style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _toggleChip(
    String label, {
    required bool active,
    required VoidCallback onTap,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      height: 26,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: active ? t.accent : t.raised,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? t.canvas : t.inkMuted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );

  Widget _variantRow(SubtitleVariant v) {
    final selected = v.key == widget.selectedKey;
    final title = v.title.trim().isNotEmpty
        ? v.title
        : (v.external ? tr.t('External subtitle') : tr.t('Embedded track'));
    final langName = v.lang.trim().isEmpty
        ? tr.t('Unknown')
        : languageName(v.lang);
    final tags = <(String, _Tone)>[
      if (v.forced) (tr.t('Forced'), _Tone.info),
      if (v.hearingImpaired) (tr.t('HI/SDH'), _Tone.warn),
      if (v.isDefault) (tr.t('Default'), _Tone.plain),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 10,
        autofocus: selected,
        onPressed: () => widget.onSelect(v.key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? t.raised : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: selected ? t.edge : Colors.transparent),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 16,
                height: 16,
                margin: const EdgeInsets.only(top: 1),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.ink,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          langName.toUpperCase(),
                          style: TextStyle(
                            color: t.inkSubtle,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Text(
                          v.imported
                              ? tr.t('Imported')
                              : (v.external
                                    ? tr.t('External')
                                    : tr.t('Embedded')),
                          style: TextStyle(color: t.inkSubtle, fontSize: 10.5),
                        ),
                        if (v.codec != null && v.codec!.isNotEmpty)
                          Text(
                            v.codec!.toUpperCase(),
                            style: TextStyle(
                              color: t.inkSubtle,
                              fontSize: 10.5,
                            ),
                          ),
                        for (final (label, tone) in tags) _tag(label, tone),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tag(String label, _Tone tone) {
    final (bg, fg) = switch (tone) {
      _Tone.warn => (t.danger.withValues(alpha: 0.15), t.danger),
      _Tone.info => (t.accent.withValues(alpha: 0.15), t.accent),
      _Tone.plain => (t.raised, t.inkMuted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: fg,
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }

  Widget _emptyState() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
    child: Row(
      children: [
        if (widget.searching) ...[
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: t.inkSubtle,
            ),
          ),
          const SizedBox(width: 12),
        ],
        Expanded(
          child: Text(
            widget.searching
                ? tr.t('Looking for subtitles…')
                : tr.t('No subtitles found yet. Try the search below.'),
            style: TextStyle(color: t.inkMuted, fontSize: 13),
          ),
        ),
      ],
    ),
  );

  Widget _searchFooter() => DecoratedBox(
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: t.edgeSoft)),
    ),
    child: Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 0,
      onPressed: widget.searching ? () {} : _runSearch,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        alignment: AlignmentDirectional.centerStart,
        child: Row(
          children: [
            if (widget.searching)
              SizedBox(
                width: 13,
                height: 13,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: t.inkMuted,
                ),
              )
            else
              Icon(Icons.search, size: 14, color: t.inkMuted),
            const SizedBox(width: 8),
            Text(
              tr.t('Find more subtitles'),
              style: TextStyle(
                color: t.inkMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

enum _Tone { warn, info, plain }
