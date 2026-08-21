import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/anime/anime_filter.dart' show animeOriginOptions;
import '../../domain/i18n/translations.dart';

/// The genres offered by the Tune-anime picker, in web display order; ids are
/// Jikan genre ids (mirrors web `OPTIONS` built from `GENRE`).
const List<({int id, String label})> _genreOptions = [
  (id: 1, label: 'Action'),
  (id: 2, label: 'Adventure'),
  (id: 4, label: 'Comedy'),
  (id: 8, label: 'Drama'),
  (id: 10, label: 'Fantasy'),
  (id: 24, label: 'Sci-Fi'),
  (id: 22, label: 'Romance'),
  (id: 36, label: 'Slice of Life'),
  (id: 37, label: 'Supernatural'),
  (id: 7, label: 'Mystery'),
  (id: 40, label: 'Psychological'),
  (id: 14, label: 'Horror'),
  (id: 41, label: 'Thriller'),
  (id: 18, label: 'Mecha'),
  (id: 30, label: 'Sports'),
  (id: 19, label: 'Music'),
];

/// Opens the "Tune anime" picker — favorite genres + origin excludes + hide-
/// watched — persisting to settings on Done and invoking [onSaved] so the caller
/// re-runs the top-picks assembly. Ported from web `AnimeGenrePicker`
/// (the web hero-edge "Tune" button opens this; the Flutter anime room has no
/// hero, so the header "Tune" action opens it).
Future<void> showAnimeGenrePicker(
  BuildContext context, {
  required VoidCallback onSaved,
}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'tune-anime',
    barrierColor: Colors.black.withValues(alpha: 0.82),
    transitionDuration: const Duration(milliseconds: 160),
    pageBuilder: (_, _, _) => _AnimeGenrePickerSheet(onSaved: onSaved),
    transitionBuilder: (_, anim, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
      child: child,
    ),
  );
}

class _AnimeGenrePickerSheet extends ConsumerStatefulWidget {
  const _AnimeGenrePickerSheet({required this.onSaved});
  final VoidCallback onSaved;

  @override
  ConsumerState<_AnimeGenrePickerSheet> createState() =>
      _AnimeGenrePickerSheetState();
}

class _AnimeGenrePickerSheetState
    extends ConsumerState<_AnimeGenrePickerSheet> {
  late Set<int> _selected;
  late Set<String> _origins;
  late bool _hideWatched;

  @override
  void initState() {
    super.initState();
    final s = ref.read(settingsProvider);
    _selected = {...s.getIntList('animeFavoriteGenres')};
    _origins = {...s.getStringList('animeExcludeOrigins')};
    _hideWatched = s.getBool('animeHideWatchedPicks');
  }

  void _toggleGenre(int id) => setState(
    () => _selected.contains(id) ? _selected.remove(id) : _selected.add(id),
  );
  void _toggleOrigin(String code) => setState(
    () => _origins.contains(code) ? _origins.remove(code) : _origins.add(code),
  );

  Future<void> _save() async {
    await ref.read(settingsProvider.notifier).setValues({
      'animeFavoriteGenres': _selected.toList(),
      'animeExcludeOrigins': _origins.toList(),
      'animeHideWatchedPicks': _hideWatched,
      'animePicksDismissedAt': DateTime.now().millisecondsSinceEpoch,
    });
    if (!mounted) return;
    Navigator.of(context).maybePop();
    widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 32),
        child: FocusTraversalGroup(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560, maxHeight: 760),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: t.elevated,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: t.edgeSoft.withValues(alpha: 0.7)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0xD9000000),
                    blurRadius: 90,
                    offset: Offset(0, 40),
                    spreadRadius: -30,
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _header(t, tr),
                  Flexible(child: _body(t, tr)),
                  _footer(t, tr),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(HarborTokens t, Translations tr) => Padding(
    padding: const EdgeInsets.fromLTRB(28, 26, 16, 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr.t('Tune anime').toUpperCase(),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2.8,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                tr.t('Shape your anime feed.'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 25,
                  fontWeight: FontWeight.w500,
                  letterSpacing: -0.4,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                tr.t(
                  'Steer your picks toward what you love, and hide what you don’t.',
                ),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13.5,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        Focusable(
          borderRadius: 20,
          onPressed: () => Navigator.of(context).maybePop(),
          child: Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: t.canvas.withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.close_rounded, size: 18, color: t.inkSubtle),
          ),
        ),
      ],
    ),
  );

  Widget _body(HarborTokens t, Translations tr) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(28, 22, 28, 22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel(t, tr.t('Genres you want more of')),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (var i = 0; i < _genreOptions.length; i++)
              _pill(
                t,
                label: tr.t(_genreOptions[i].label),
                on: _selected.contains(_genreOptions[i].id),
                onColor: t.ink,
                onText: t.canvas,
                autofocus: i == 0,
                onPressed: () => _toggleGenre(_genreOptions[i].id),
              ),
          ],
        ),
        const SizedBox(height: 24),
        Divider(color: t.edgeSoft.withValues(alpha: 0.45), height: 1),
        const SizedBox(height: 22),
        _sectionLabel(t, tr.t('Hide from your picks')),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final o in animeOriginOptions)
              _pill(
                t,
                label: tr.t(o.label),
                on: _origins.contains(o.code),
                onColor: t.danger,
                onText: Colors.white,
                onPressed: () => _toggleOrigin(o.code),
              ),
          ],
        ),
        const SizedBox(height: 14),
        _hideWatchedRow(t, tr),
      ],
    ),
  );

  Widget _sectionLabel(HarborTokens t, String text) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: t.inkSubtle,
      fontSize: 11,
      fontWeight: FontWeight.w800,
      letterSpacing: 2,
    ),
  );

  Widget _hideWatchedRow(HarborTokens t, Translations tr) => Focusable(
    borderRadius: 12,
    onPressed: () => setState(() => _hideWatched = !_hideWatched),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _hideWatched ? t.accent : Colors.transparent,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: _hideWatched ? t.accent : t.edge,
                width: 1.5,
              ),
            ),
            child: _hideWatched
                ? Icon(Icons.check_rounded, size: 15, color: t.canvas)
                : null,
          ),
          const SizedBox(width: 12),
          Text(
            tr.t('Hide anime I’ve already watched'),
            style: TextStyle(
              color: t.ink,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _footer(HarborTokens t, Translations tr) => Container(
    padding: const EdgeInsets.fromLTRB(28, 16, 28, 18),
    decoration: BoxDecoration(
      border: Border(
        top: BorderSide(color: t.edgeSoft.withValues(alpha: 0.45)),
      ),
    ),
    child: Row(
      children: [
        if (_selected.isNotEmpty)
          Focusable(
            borderRadius: 10,
            onPressed: () => setState(_selected.clear),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Text(
                tr.t('Clear all'),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        const Spacer(),
        Text(
          _selected.isEmpty
              ? tr.t('None yet')
              : tr.t('{n} selected', {'n': _selected.length}),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12.5,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(width: 16),
        Focusable(
          borderRadius: 22,
          onPressed: _save,
          child: Container(
            height: 44,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 28),
            decoration: BoxDecoration(
              color: t.ink,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Text(
              tr.t('Done'),
              style: TextStyle(
                color: t.canvas,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _pill(
    HarborTokens t, {
    required String label,
    required bool on,
    required Color onColor,
    required Color onText,
    required VoidCallback onPressed,
    bool autofocus = false,
  }) => Focusable(
    borderRadius: 22,
    autofocus: autofocus,
    onPressed: onPressed,
    child: Container(
      height: 44,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: on ? onColor : t.canvas.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(22),
        border: on ? null : Border.all(color: t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: on ? onText : t.inkMuted,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}
