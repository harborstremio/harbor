import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../design/focus/tv_text_field.dart';

/// Opens the "Add to list" menu for a title, ported from `AddToListMenu`: toggle
/// the title in/out of each custom list, or create a new list (the title is
/// added to it). A remote-operable in-process overlay.
void showAddToListMenu(
  BuildContext context, {
  required String itemId,
  required String type,
  required String name,
  String? poster,
}) {
  showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'add-to-list',
    barrierColor: Colors.black.withValues(alpha: 0.6),
    transitionDuration: const Duration(milliseconds: 180),
    pageBuilder: (_, _, _) =>
        _AddToListMenu(itemId: itemId, type: type, name: name, poster: poster),
    transitionBuilder: (_, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(
        scale: Tween(
          begin: 0.97,
          end: 1.0,
        ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
        child: child,
      ),
    ),
  );
}

class _AddToListMenu extends ConsumerStatefulWidget {
  const _AddToListMenu({
    required this.itemId,
    required this.type,
    required this.name,
    required this.poster,
  });
  final String itemId;
  final String type;
  final String name;
  final String? poster;

  @override
  ConsumerState<_AddToListMenu> createState() => _AddToListMenuState();
}

class _AddToListMenuState extends ConsumerState<_AddToListMenu> {
  final _controller = TextEditingController();
  bool _creating = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    final id = await ref.read(customListsProvider.notifier).create(name);
    if (id != null) {
      await ref
          .read(customListsProvider.notifier)
          .addTo(
            id,
            widget.itemId,
            type: widget.type,
            name: widget.name,
            poster: widget.poster,
          );
    }
    _controller.clear();
    if (mounted) setState(() => _creating = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final lists = ref.watch(customListsProvider);
    final containing = <String>{
      for (final l in lists)
        if (l.items.any((it) => it.id == widget.itemId)) l.id,
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Material(
          color: t.elevated,
          borderRadius: BorderRadius.circular(20),
          clipBehavior: Clip.antiAlias,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380, maxHeight: 560),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _header(t),
                Flexible(
                  child: lists.isEmpty && !_creating
                      ? Padding(
                          padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
                          child: Text(
                            tr.t('No lists yet. Create your first one below.'),
                            style: TextStyle(color: t.inkSubtle, fontSize: 13),
                          ),
                        )
                      : SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Column(
                            children: [
                              for (final (i, l) in lists.indexed)
                                _ListRow(
                                  name: l.name,
                                  count: l.items.length,
                                  inList: containing.contains(l.id),
                                  tokens: t,
                                  // Land the remote on the first list so a TV
                                  // session has a visible target on entry.
                                  autofocus: i == 0,
                                  onToggle: () => ref
                                      .read(customListsProvider.notifier)
                                      .toggle(
                                        l.id,
                                        widget.itemId,
                                        type: widget.type,
                                        name: widget.name,
                                        poster: widget.poster,
                                      ),
                                ),
                            ],
                          ),
                        ),
                ),
                _footer(t, autofocusCreate: lists.isEmpty),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(HarborTokens t) => Container(
    padding: const EdgeInsets.fromLTRB(16, 12, 12, 10),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            ref.read(translationsProvider).t('ADD TO LIST'),
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.4,
            ),
          ),
        ),
        Focusable(
          tokens: t,
          borderRadius: 20,
          onPressed: () => Navigator.of(context).pop(),
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(Icons.close, color: t.inkMuted, size: 18),
          ),
        ),
      ],
    ),
  );

  Widget _footer(HarborTokens t, {bool autofocusCreate = false}) {
    final tr = ref.read(translationsProvider);
    if (_creating) {
      return Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: t.edgeSoft)),
        ),
        child: TvTextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _create(),
          style: TextStyle(color: t.ink, fontSize: 14),
          cursorColor: t.accent,
          decoration: InputDecoration(
            isDense: true,
            hintText: tr.t('List name…'),
            hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
            filled: true,
            fillColor: t.canvas,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: t.edge),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: t.edge),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: t.accent, width: 2),
            ),
            suffixIcon: IconButton(
              icon: Icon(Icons.check, color: t.accent, size: 20),
              onPressed: _create,
            ),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: t.edgeSoft)),
      ),
      child: Focusable(
        tokens: t,
        borderRadius: 10,
        // With no lists yet this is the only actionable control, so autofocus it
        // for a TV session (the list rows take focus when there are lists).
        autofocus: autofocusCreate,
        onPressed: () => setState(() => _creating = true),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Icon(Icons.add, color: t.inkMuted, size: 18),
              const SizedBox(width: 10),
              Text(
                tr.t('Create new list'),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ListRow extends StatelessWidget {
  const _ListRow({
    required this.name,
    required this.count,
    required this.inList,
    required this.tokens,
    required this.onToggle,
    this.autofocus = false,
  });
  final String name;
  final int count;
  final bool inList;
  final HarborTokens tokens;
  final VoidCallback onToggle;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 10,
      autofocus: autofocus,
      onPressed: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: inList ? t.accentSoft : Colors.transparent,
                border: Border.all(color: inList ? t.accent : t.edge),
                borderRadius: BorderRadius.circular(6),
              ),
              child: inList
                  ? Icon(Icons.check, size: 14, color: t.accent)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: t.ink, fontSize: 13.5),
              ),
            ),
            Text(
              '$count',
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 11,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
