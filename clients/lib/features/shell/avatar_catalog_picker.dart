import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_text_field.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/profiles/avatar_catalog.dart';

/// One catalog avatar flattened with its franchise group, for search.
class _FlatAvatar {
  const _FlatAvatar(this.id, this.name, this.group);
  final String id;
  final String name;
  final String group;
}

final List<_FlatAvatar> _flatCatalog = [
  for (final g in kAvatarCatalog)
    for (final it in g.items) _FlatAvatar(it.id, it.name, g.group),
];

/// Opens the built-in ready-avatar catalog (the web `AvatarCatalogModal`): a
/// searchable, remote-navigable grid of the 629 bundled avatars. Returns the
/// chosen avatar's stored value (`/avatars/<id>.webp`, web-interchangeable) or
/// null if dismissed. This is the ONLY avatar-set path on TV (photo upload is
/// touch-only), and a browse alternative to upload elsewhere.
Future<String?> showAvatarCatalogPicker(
  BuildContext context, {
  required HarborTokens tokens,
  String? current,
}) {
  return Navigator.of(context, rootNavigator: true).push<String>(
    PageRouteBuilder<String>(
      opaque: true,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 250),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (_, _, _) =>
          _AvatarCatalogPicker(tokens: tokens, current: current),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(
        opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
        child: child,
      ),
    ),
  );
}

class _AvatarCatalogPicker extends ConsumerStatefulWidget {
  const _AvatarCatalogPicker({required this.tokens, this.current});

  final HarborTokens tokens;
  final String? current;

  @override
  ConsumerState<_AvatarCatalogPicker> createState() =>
      _AvatarCatalogPickerState();
}

class _AvatarCatalogPickerState extends ConsumerState<_AvatarCatalogPicker> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<_FlatAvatar> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) {
      // Float the currently-selected avatar to the front so it opens visible and
      // (on TV) focused — otherwise re-editing a profile whose avatar is deep in
      // the 629-item list would hide the current pick off-screen at offset 0.
      final cur = widget.current;
      if (cur == null || cur.isEmpty) return _flatCatalog;
      final i = _flatCatalog.indexWhere((a) => avatarStoredValue(a.id) == cur);
      if (i <= 0) return _flatCatalog;
      return [
        _flatCatalog[i],
        for (var j = 0; j < _flatCatalog.length; j++)
          if (j != i) _flatCatalog[j],
      ];
    }
    return [
      for (final a in _flatCatalog)
        if (a.name.toLowerCase().contains(q) ||
            a.group.toLowerCase().contains(q))
          a,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final idiom = Idiom.of(context);
    final isTv = idiom.isTv;
    // Idiom-scaled tile so the grid reads well on a phone and from the couch.
    final tile = isTv
        ? 132.0
        : idiom.isTablet
        ? 116.0
        : 100.0;
    // Decode the 384px source avatars down to ~the display resolution so the
    // full 629-item grid doesn't thrash the 100MB ImageCache (a full-size decode
    // is ~576 KiB each) or re-decode on every fling — matters on low-end TV boxes.
    final cacheW = (tile * MediaQuery.devicePixelRatioOf(context)).round();
    final items = _filtered;
    return Scaffold(
      backgroundColor: t.canvas,
      body: SafeArea(
        child: FocusTraversalGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        tr.t('Choose an avatar'),
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Focusable(
                      tokens: t,
                      borderRadius: 999,
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: t.elevated,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.close, size: 20, color: t.ink),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: t.elevated,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: t.edge),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        Icon(Icons.search, size: 18, color: t.inkMuted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TvTextField(
                            controller: _search,
                            autofocus: !isTv,
                            textInputAction: TextInputAction.search,
                            style: TextStyle(color: t.ink, fontSize: 15),
                            cursorColor: t.accent,
                            decoration: InputDecoration(
                              isDense: true,
                              border: InputBorder.none,
                              hintText: tr.t('Search characters or shows…'),
                              hintStyle: TextStyle(color: t.inkMuted),
                              contentPadding: const EdgeInsets.symmetric(
                                vertical: 12,
                              ),
                            ),
                            onChanged: (v) => setState(() => _query = v),
                          ),
                        ),
                        if (_query.isNotEmpty)
                          Focusable(
                            tokens: t,
                            borderRadius: 999,
                            onPressed: () {
                              _search.clear();
                              setState(() => _query = '');
                            },
                            child: Icon(
                              Icons.clear,
                              size: 18,
                              color: t.inkMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: items.isEmpty
                    ? Center(
                        child: Text(
                          tr.t('No avatars match your search.'),
                          style: TextStyle(color: t.inkMuted, fontSize: 15),
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: tile,
                          mainAxisSpacing: 16,
                          crossAxisSpacing: 16,
                          childAspectRatio: 0.82,
                        ),
                        itemCount: items.length,
                        itemBuilder: (context, i) {
                          final a = items[i];
                          final stored = avatarStoredValue(a.id);
                          final selected = widget.current == stored;
                          return _AvatarTile(
                            tokens: t,
                            item: a,
                            selected: selected,
                            autofocus: isTv && i == 0,
                            cacheWidth: cacheW,
                            onPick: () => Navigator.of(context).pop(stored),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvatarTile extends StatelessWidget {
  const _AvatarTile({
    required this.tokens,
    required this.item,
    required this.selected,
    required this.onPick,
    required this.cacheWidth,
    this.autofocus = false,
  });

  final HarborTokens tokens;
  final _FlatAvatar item;
  final bool selected;
  final VoidCallback onPick;
  final int cacheWidth;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Semantics(
      label: '${item.name} · ${item.group}',
      button: true,
      selected: selected,
      child: Focusable(
        tokens: t,
        borderRadius: 14,
        autofocus: autofocus,
        onPressed: onPick,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? t.accent : t.edge,
                  width: selected ? 3 : 1,
                ),
              ),
              child: ClipOval(
                child: AspectRatio(
                  aspectRatio: 1,
                  child: Image.asset(
                    'assets/avatars/${item.id}.webp',
                    fit: BoxFit.cover,
                    cacheWidth: cacheWidth,
                    filterQuality: FilterQuality.medium,
                    errorBuilder: (_, _, _) => ColoredBox(color: t.surface),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkSubtle, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
