import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/streams/custom_filter.dart';
import '../../domain/streams/stream_badges.dart';
import 'format_badge.dart';
import '../../design/focus/tv_text_field.dart';

/// The outcome of the filter builder: the user saved a filter, deleted one, or
/// cancelled (null return).
sealed class FilterBuilderResult {
  const FilterBuilderResult();
}

class FilterSaved extends FilterBuilderResult {
  const FilterSaved(this.filter);
  final CustomStreamFilter filter;
}

class FilterDeleted extends FilterBuilderResult {
  const FilterDeleted(this.id);
  final String id;
}

/// Opens the custom stream-filter builder as a focus-trapped, remote-navigable
/// dialog. [initial] non-null edits an existing filter (enabling Delete); null
/// creates a new one. Returns a [FilterSaved]/[FilterDeleted], or null on
/// cancel. Ports the web `FilterBuilder`.
Future<FilterBuilderResult?> showFilterBuilder(
  BuildContext context, {
  required HarborTokens tokens,
  CustomStreamFilter? initial,
}) => showGeneralDialog<FilterBuilderResult>(
  context: context,
  barrierDismissible: true,
  barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
  barrierColor: Colors.black.withValues(alpha: 0.7),
  transitionDuration: const Duration(milliseconds: 140),
  pageBuilder: (ctx, _, _) =>
      _FilterBuilderDialog(tokens: tokens, initial: initial),
  transitionBuilder: (ctx, anim, _, child) => FadeTransition(
    opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
    child: child,
  ),
);

String _newFilterId() =>
    'cf-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(100000)}';

/// The format-badge glyph for a filter option, or null when it has none (or is
/// a tooltip-only kind the web hides). Ports `badge-maps` `badgeFor`.
BadgeKind? badgeForFilterOption(String dimension, String value) =>
    switch (dimension) {
      'resolution' => switch (value) {
        '4K' => BadgeKind.uhd4k,
        '1080p' => BadgeKind.p1080,
        '720p' => BadgeKind.p720,
        '480p' => BadgeKind.p480,
        'SD' => BadgeKind.sd,
        _ => null,
      },
      'source' => switch (value) {
        'BluRay' || 'BDRip' => BadgeKind.bluray,
        'REMUX' => BadgeKind.remux,
        'WEB-DL' => BadgeKind.webdl,
        'WEBRip' || 'HDRip' => BadgeKind.webrip,
        'DVDRip' => BadgeKind.dvd,
        'HDTV' => BadgeKind.hdtv,
        'HDTS' => BadgeKind.hdts,
        'SCR' => BadgeKind.scr,
        // CAM / TS / TC are tooltip-only badges in the web → label only.
        _ => null,
      },
      'codec' => switch (value) {
        'HEVC' => BadgeKind.hevc,
        'AV1' => BadgeKind.av1,
        _ => null,
      },
      'audio' => switch (value) {
        'Atmos' => BadgeKind.atmos,
        'TrueHD' => BadgeKind.trueHd,
        'DTS-HD MA' => BadgeKind.dtsHdMa,
        'DTS' => BadgeKind.dts,
        'DD+' => BadgeKind.ddp,
        'AC3' => BadgeKind.ac3,
        'AAC' => BadgeKind.aac,
        'Opus' => BadgeKind.opus,
        'FLAC' => BadgeKind.flac,
        _ => null,
      },
      _ => null,
    };

class _FilterBuilderDialog extends StatefulWidget {
  const _FilterBuilderDialog({required this.tokens, this.initial});

  final HarborTokens tokens;
  final CustomStreamFilter? initial;

  @override
  State<_FilterBuilderDialog> createState() => _FilterBuilderDialogState();
}

class _FilterBuilderDialogState extends State<_FilterBuilderDialog> {
  late CustomStreamFilter _draft;
  late final TextEditingController _name;
  late final TextEditingController _minSeeders;
  late final TextEditingController _maxSize;

  bool get _isEdit => widget.initial != null;
  bool get _canSave => _name.text.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _draft = widget.initial ?? newCustomFilter('', id: _newFilterId());
    _name = TextEditingController(text: _draft.name);
    _minSeeders = TextEditingController(
      text: _draft.minSeeders?.toString() ?? '',
    );
    _maxSize = TextEditingController(text: _draft.maxSizeGb?.toString() ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _minSeeders.dispose();
    _maxSize.dispose();
    super.dispose();
  }

  List<String> _toggled(List<String> current, String value) =>
      current.contains(value)
      ? [
          for (final v in current)
            if (v != value) v,
        ]
      : [...current, value];

  void _save() {
    if (!_canSave) return;
    Navigator.of(
      context,
    ).pop(FilterSaved(_draft.copyWith(name: _name.text.trim())));
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Center(
      child: Material(
        color: Colors.transparent,
        child: ConstrainedBox(
          // Cap at 88% of the viewport height (web `max-h-[88vh]`); the body
          // scrolls within.
          constraints: BoxConstraints(
            maxWidth: 560,
            maxHeight: MediaQuery.of(context).size.height * 0.88,
          ),
          child: Container(
            margin: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: t.edgeSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: FocusTraversalGroup(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _header(t),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _nameField(t),
                          const SizedBox(height: 20),
                          _multiSection(
                            t,
                            'Resolution',
                            'resolution',
                            resolutionOptions,
                            _draft.resolution,
                            (v) {
                              setState(
                                () => _draft = _draft.copyWith(
                                  resolution: _toggled(_draft.resolution, v),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 18),
                          _multiSection(
                            t,
                            'Source',
                            'source',
                            sourceOptions,
                            _draft.source,
                            (v) {
                              setState(
                                () => _draft = _draft.copyWith(
                                  source: _toggled(_draft.source, v),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 18),
                          _multiSection(
                            t,
                            'Codec',
                            'codec',
                            codecOptions,
                            _draft.codec,
                            (v) {
                              setState(
                                () => _draft = _draft.copyWith(
                                  codec: _toggled(_draft.codec, v),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 18),
                          _multiSection(
                            t,
                            'Audio',
                            'audio',
                            audioOptions,
                            _draft.audio,
                            (v) {
                              setState(
                                () => _draft = _draft.copyWith(
                                  audio: _toggled(_draft.audio, v),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 18),
                          _toggleRow(
                            t,
                            'HDR only',
                            'Keep Dolby Vision, HDR10, HLG. Drop SDR.',
                            _draft.requireHdr,
                            (v) => setState(
                              () => _draft = _draft.copyWith(requireHdr: v),
                            ),
                          ),
                          const SizedBox(height: 10),
                          _toggleRow(
                            t,
                            'Cached only',
                            'Only streams already in your debrid library.',
                            _draft.cachedOnly,
                            (v) => setState(
                              () => _draft = _draft.copyWith(cachedOnly: v),
                            ),
                          ),
                          const SizedBox(height: 18),
                          _numberRow(
                            t,
                            'Min seeders',
                            'Excludes direct and debrid streams with no seeders.',
                            _minSeeders,
                            (n) => setState(
                              () => _draft = _draft.copyWith(minSeeders: n),
                            ),
                          ),
                          const SizedBox(height: 10),
                          _numberRow(
                            t,
                            'Max size (GB)',
                            'Caps file size. Unknown sizes still pass.',
                            _maxSize,
                            (n) => setState(
                              () => _draft = _draft.copyWith(maxSizeGb: n),
                            ),
                          ),
                          if (isFilterEmpty(_draft)) ...[
                            const SizedBox(height: 18),
                            _emptyHint(t),
                          ],
                        ],
                      ),
                    ),
                  ),
                  _footer(t),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(HarborTokens t) => Container(
    padding: const EdgeInsets.fromLTRB(24, 22, 16, 16),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _isEdit ? 'Edit filter' : 'New filter',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                summarizeFilter(_draft),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: t.inkMuted, fontSize: 12.5),
              ),
            ],
          ),
        ),
        Focusable(
          tokens: t,
          borderRadius: 999,
          onPressed: () => Navigator.of(context).pop(),
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(Icons.close, size: 20, color: t.inkSubtle),
          ),
        ),
      ],
    ),
  );

  Widget _nameField(HarborTokens t) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _sectionLabel(t, 'Name'),
      const SizedBox(height: 8),
      TvTextField(
        controller: _name,
        autofocus: true,
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _save(),
        style: TextStyle(color: t.ink, fontSize: 15),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'My filter',
          hintStyle: TextStyle(color: t.inkSubtle),
          filled: true,
          fillColor: t.canvas,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.edge),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.ink),
          ),
        ),
      ),
    ],
  );

  Widget _multiSection(
    HarborTokens t,
    String title,
    String dimension,
    List<String> options,
    List<String> selected,
    void Function(String) onToggle,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _sectionLabel(t, title),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final o in options)
            _MultiPill(
              tokens: t,
              label: o,
              badge: badgeForFilterOption(dimension, o),
              active: selected.contains(o),
              onPressed: () => onToggle(o),
            ),
        ],
      ),
    ],
  );

  Widget _toggleRow(
    HarborTokens t,
    String title,
    String sub,
    bool value,
    void Function(bool) onChanged,
  ) => Focusable(
    tokens: t,
    borderRadius: 12,
    onPressed: () => onChanged(!value),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(color: t.inkSubtle, fontSize: 12.5)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _Switch(tokens: t, value: value),
        ],
      ),
    ),
  );

  Widget _numberRow(
    HarborTokens t,
    String title,
    String sub,
    TextEditingController controller,
    void Function(num?) onChanged,
  ) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(sub, style: TextStyle(color: t.inkSubtle, fontSize: 12.5)),
            ],
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(
          width: 96,
          child: TvTextField(
            controller: controller,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            textAlign: TextAlign.end,
            onChanged: (raw) {
              final v = raw.trim();
              onChanged(v.isEmpty ? null : num.tryParse(v));
            },
            style: TextStyle(color: t.ink, fontSize: 14),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Any',
              hintStyle: TextStyle(color: t.inkSubtle),
              filled: true,
              fillColor: t.elevated,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 10,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: t.edge),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: t.ink),
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _emptyHint(HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: t.raised.withValues(alpha: 0.6),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      'No dimensions set. This filter matches every stream.',
      style: TextStyle(color: t.inkMuted, fontSize: 12.5),
    ),
  );

  Widget _footer(HarborTokens t) => Container(
    padding: const EdgeInsets.fromLTRB(24, 14, 24, 20),
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: t.edgeSoft)),
    ),
    child: Row(
      children: [
        if (_isEdit)
          Focusable(
            tokens: t,
            borderRadius: 12,
            onPressed: () =>
                Navigator.of(context).pop(FilterDeleted(_draft.id)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.delete_outline, size: 16, color: t.danger),
                  const SizedBox(width: 6),
                  Text(
                    'Delete',
                    style: TextStyle(
                      color: t.danger,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        const Spacer(),
        Focusable(
          tokens: t,
          borderRadius: 12,
          onPressed: () => Navigator.of(context).pop(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: t.inkMuted,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Opacity(
          opacity: _canSave ? 1 : 0.5,
          child: Focusable(
            tokens: t,
            borderRadius: 12,
            onPressed: _save,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check, size: 16, color: t.canvas),
                  const SizedBox(width: 6),
                  Text(
                    _isEdit ? 'Save' : 'Create',
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _sectionLabel(HarborTokens t, String text) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: t.inkSubtle,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.4,
    ),
  );
}

class _MultiPill extends StatelessWidget {
  const _MultiPill({
    required this.tokens,
    required this.label,
    required this.badge,
    required this.active,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final String label;
  final BadgeKind? badge;
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.accentSoft : t.raised,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (badge != null) ...[
              FormatBadge(kind: badge!, size: BadgeSize.sm),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: active ? t.accent : t.inkMuted,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Switch extends StatelessWidget {
  const _Switch({required this.tokens, required this.value});

  final HarborTokens tokens;
  final bool value;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 40,
      height: 24,
      decoration: BoxDecoration(
        color: value ? t.accent : t.edge,
        borderRadius: BorderRadius.circular(999),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 150),
        alignment: value ? Alignment.centerRight : Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(color: t.canvas, shape: BoxShape.circle),
          ),
        ),
      ),
    );
  }
}
