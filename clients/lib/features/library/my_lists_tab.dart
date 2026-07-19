import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/dates.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/library/custom_lists.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';
import 'add_title_search.dart';

/// The Library "My Lists" tab — the viewer's hand-curated collections, ported
/// from the web `MyListsTab`: a grid of list cards with create, and an inline
/// detail view (open a list to browse, delete titles, rename or delete it).
class MyListsTab extends ConsumerStatefulWidget {
  const MyListsTab({super.key});

  @override
  ConsumerState<MyListsTab> createState() => _MyListsTabState();
}

class _MyListsTabState extends ConsumerState<MyListsTab> {
  String? _selectedListId;

  Future<void> _create() async {
    final id = await showCreateListDialog(context, ref);
    if (id != null && mounted) setState(() => _selectedListId = id);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final lists = ref.watch(customListsProvider);

    final selected = _selectedListId == null
        ? null
        : lists.where((l) => l.id == _selectedListId).firstOrNull;
    if (selected != null) {
      return _ListDetail(
        list: selected,
        tokens: t,
        tr: tr,
        onBack: () => setState(() => _selectedListId = null),
      );
    }

    if (lists.isEmpty) return _EmptyLists(tokens: t, tr: tr, onCreate: _create);

    final atMax = lists.length >= kMaxLists;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              tr.t('{n} / {max} lists', {'n': lists.length, 'max': kMaxLists}),
              style: TextStyle(color: t.inkMuted, fontSize: 12),
            ),
            _pillButton(
              t,
              Icons.add_rounded,
              tr.t('Create new list'),
              atMax ? null : _create,
            ),
          ],
        ),
        const SizedBox(height: 18),
        Expanded(
          child: GridView.builder(
            // Clear the TV overscan crop so the last row isn't cut by the bezel.
            padding: EdgeInsets.only(
              bottom: overscanInset(Idiom.of(context)).bottom + 8,
            ),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 260,
              mainAxisExtent: 208,
              crossAxisSpacing: 18,
              mainAxisSpacing: 18,
            ),
            itemCount: lists.length,
            itemBuilder: (_, i) => _ListCard(
              list: lists[i],
              tokens: t,
              tr: tr,
              onOpen: () => setState(() => _selectedListId = lists[i].id),
            ),
          ),
        ),
      ],
    );
  }
}

Widget _pillButton(
  HarborTokens t,
  IconData icon,
  String label,
  VoidCallback? onPressed, {
  bool filled = false,
  // On a phone the detail header is tight — a long localized label ("إعادة
  // تسمية", "Renomear") would overflow the two-pill row — so drop to an
  // icon-only circle there. `label` is still used as the a11y tooltip.
  bool compact = false,
}) {
  final enabled = onPressed != null;
  return Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onPressed ?? () {},
    child: Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Container(
        height: 40,
        width: compact ? 40 : null,
        padding: compact
            ? EdgeInsets.zero
            : const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? t.ink : t.canvas.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(999),
          border: filled ? null : Border.all(color: t.edge),
        ),
        child: compact
            ? Tooltip(
                message: label,
                child: Icon(icon, size: 18, color: filled ? t.canvas : t.ink),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 16, color: filled ? t.canvas : t.ink),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: TextStyle(
                      color: filled ? t.canvas : t.ink,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    ),
  );
}

/// "N items" plus, when the list has been touched, "· Updated {when}" — ported
/// from the web `ListCard` subtitle.
String _subtitle(Translations tr, int count, int updatedAt) {
  final items = count == 1 ? tr.t('1 item') : tr.t('{n} items', {'n': count});
  if (updatedAt <= 0) return items;
  final when = relativeTime(updatedAt, DateTime.now());
  return '$items · ${tr.t('Updated {when}', {'when': when})}';
}

class _ListCard extends StatelessWidget {
  const _ListCard({
    required this.list,
    required this.tokens,
    required this.tr,
    required this.onOpen,
  });

  final CustomList list;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final covers = list.items.take(3).toList();
    final count = list.items.length;
    return Focusable(
      tokens: t,
      borderRadius: 20,
      onPressed: onOpen,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 122,
              width: double.infinity,
              child: covers.isEmpty
                  ? ColoredBox(
                      color: t.canvas,
                      child: Icon(
                        Icons.layers_outlined,
                        size: 24,
                        color: t.inkSubtle,
                      ),
                    )
                  : _Fan(covers: covers, tokens: t),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    list.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _subtitle(tr, count, list.updatedAt),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: t.inkSubtle, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Fan extends StatelessWidget {
  const _Fan({required this.covers, required this.tokens});
  final List<ListItem> covers;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        for (var i = 0; i < covers.length; i++)
          Transform(
            alignment: Alignment.center,
            transform: Matrix4.translationValues(
              (i - (covers.length - 1) / 2) * 30.0,
              0,
              0,
            )..rotateZ((i - (covers.length - 1) / 2) * 0.12),
            child: SizedBox(
              width: 70,
              child: AspectRatio(
                aspectRatio: 2 / 3,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: RpdbPosterImage(
                    metaId: covers[i].id,
                    rawPoster: covers[i].poster,
                    type: covers[i].type,
                    tokens: tokens,
                    fallback: () => ColoredBox(color: tokens.elevated),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _EmptyLists extends StatelessWidget {
  const _EmptyLists({
    required this.tokens,
    required this.tr,
    required this.onCreate,
  });
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.layers_outlined, size: 42, color: t.inkSubtle),
          const SizedBox(height: 16),
          Text(
            tr.t('Create your first list'),
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Text(
              tr.t(
                'Group the movies and shows you love. Rewatch shelf, weekend '
                'picks, whatever keeps them close.',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
            ),
          ),
          const SizedBox(height: 20),
          _pillButton(
            t,
            Icons.add_rounded,
            tr.t('New list'),
            onCreate,
            filled: true,
          ),
        ],
      ),
    );
  }
}

class _ListDetail extends ConsumerWidget {
  const _ListDetail({
    required this.list,
    required this.tokens,
    required this.tr,
    required this.onBack,
  });

  final CustomList list;
  final HarborTokens tokens;
  final Translations tr;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final count = list.items.length;
    final compact = Idiom.of(context).isPhone;
    // The whole detail scrolls as one section (the web `<section>` inside a
    // scrolling page) so the add-title results panel pushes the grid down
    // rather than overflowing a bounded Column.
    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 10,
          onPressed: onBack,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.arrow_back_rounded, size: 16, color: t.inkMuted),
                const SizedBox(width: 6),
                Text(
                  tr.t('Back to lists'),
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    list.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 34,
                      height: 1.05,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _detailSubtitle(tr, count, list.updatedAt),
                    style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            _pillButton(
              t,
              Icons.drive_file_rename_outline_rounded,
              tr.t('Rename'),
              () => _rename(context, ref),
              compact: compact,
            ),
            const SizedBox(width: 8),
            _pillButton(
              t,
              Icons.delete_outline_rounded,
              tr.t('Delete'),
              () => _delete(context, ref),
              compact: compact,
            ),
          ],
        ),
        const SizedBox(height: 16),
        AddTitleSearch(list: list, tokens: t),
        const SizedBox(height: 18),
      ],
    );

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: header),
        if (list.items.isEmpty)
          SliverFillRemaining(hasScrollBody: false, child: _emptyList(t, tr))
        else
          SliverPadding(
            padding: EdgeInsets.only(
              bottom: overscanInset(Idiom.of(context)).bottom,
            ),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 150,
                childAspectRatio: 2 / 3.35,
                crossAxisSpacing: 16,
                mainAxisSpacing: 20,
              ),
              delegate: SliverChildBuilderDelegate(
                (_, i) => _ItemTile(
                  item: list.items[i],
                  listId: list.id,
                  tokens: t,
                  tr: tr,
                ),
                childCount: list.items.length,
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _rename(BuildContext context, WidgetRef ref) async {
    final name = await showCreateListDialog(
      context,
      ref,
      initial: list.name,
      title: tr.t('Rename list'),
      confirm: tr.t('Rename'),
    );
    // showCreateListDialog creates when no rename target; use the notifier
    // directly for rename via its returned text.
    if (name != null) {
      await ref.read(customListsProvider.notifier).rename(list.id, name);
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    await ref.read(customListsProvider.notifier).remove(list.id);
    // The KV write is awaited; bail if the Library screen was torn down in the
    // meantime so the parent setState in onBack can't fire post-dispose.
    if (!context.mounted) return;
    onBack();
  }

  Widget _emptyList(HarborTokens t, Translations tr) => Center(
    child: Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 44),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft, style: BorderStyle.solid),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.layers_outlined, size: 26, color: t.inkSubtle),
          const SizedBox(height: 12),
          Text(
            tr.t('Nothing here yet'),
            style: TextStyle(
              color: t.ink,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Text(
              tr.t(
                'Add titles with the search above, or hit "Add to list" on any movie or show\'s page.',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.5),
            ),
          ),
        ],
      ),
    ),
  );
}

/// The detail header subtitle, ported from the web ListDetail: "{n} / {max}
/// items" with a "· Updated {when}" suffix once the list has been touched.
String _detailSubtitle(Translations tr, int count, int updatedAt) {
  final items = tr.t('{n} / {max} items', {'n': count, 'max': kMaxListItems});
  if (updatedAt <= 0) return items;
  final when = relativeTime(updatedAt, DateTime.now());
  return '$items · ${tr.t('Updated {when}', {'when': when})}';
}

class _ItemTile extends ConsumerWidget {
  const _ItemTile({
    required this.item,
    required this.listId,
    required this.tokens,
    required this.tr,
  });

  final ListItem item;
  final String listId;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: Focusable(
                  tokens: t,
                  borderRadius: 12,
                  onPressed: () => ref
                      .read(navControllerProvider.notifier)
                      .push(
                        Frame(FrameKind.meta, {
                          'type': item.type,
                          'id': item.id,
                        }),
                      ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: RpdbPosterImage(
                      metaId: item.id,
                      rawPoster: item.poster,
                      type: item.type,
                      tokens: t,
                      fallback: () => ColoredBox(color: t.elevated),
                    ),
                  ),
                ),
              ),
              PositionedDirectional(
                top: 4,
                end: 4,
                child: Focusable(
                  tokens: t,
                  scale: 1.0,
                  borderRadius: 999,
                  onPressed: () => ref
                      .read(customListsProvider.notifier)
                      .toggle(listId, item.id),
                  child: Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: t.canvas.withValues(alpha: 0.85),
                      shape: BoxShape.circle,
                      border: Border.all(color: t.edgeSoft),
                    ),
                    child: Icon(Icons.close_rounded, size: 15, color: t.ink),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          item.name.isEmpty ? item.id : item.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: t.inkMuted, fontSize: 12),
        ),
      ],
    );
  }
}

/// A dialog to name a new list (or [initial]/[title]/[confirm] to reuse it for
/// rename). Returns the entered name after creating (default) or, when [initial]
/// is given, just the trimmed name; null on cancel.
Future<String?> showCreateListDialog(
  BuildContext context,
  WidgetRef ref, {
  String? initial,
  String? title,
  String? confirm,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _CreateListDialog(
      ref: ref,
      initial: initial,
      title: title,
      confirm: confirm,
    ),
  );
}

class _CreateListDialog extends StatefulWidget {
  const _CreateListDialog({
    required this.ref,
    this.initial,
    this.title,
    this.confirm,
  });
  final WidgetRef ref;
  final String? initial;
  final String? title;
  final String? confirm;

  @override
  State<_CreateListDialog> createState() => _CreateListDialogState();
}

class _CreateListDialogState extends State<_CreateListDialog> {
  late final TextEditingController _name = TextEditingController(
    text: widget.initial ?? '',
  );
  bool _busy = false;

  bool get _isRename => widget.initial != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final trimmed = _name.text.trim();
    if (trimmed.isEmpty || _busy) return;
    setState(() => _busy = true);
    if (_isRename) {
      Navigator.of(context).pop(trimmed);
      return;
    }
    final id = await widget.ref
        .read(customListsProvider.notifier)
        .create(trimmed);
    if (mounted) Navigator.of(context).pop(id);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.ref.watch(tokensProvider);
    final tr = widget.ref.watch(translationsProvider);
    return Dialog(
      backgroundColor: t.elevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.title ?? tr.t('New list'),
                style: TextStyle(
                  color: t.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tr.t('Group the movies and shows you want to keep close.'),
                style: TextStyle(color: t.inkMuted, fontSize: 13),
              ),
              const SizedBox(height: 18),
              TvTextField(
                controller: _name,
                autofocus: true,
                maxLength: 60,
                onSubmitted: (_) => _submit(),
                style: TextStyle(color: t.ink, fontSize: 15),
                cursorColor: t.accent,
                decoration: InputDecoration(
                  counterText: '',
                  hintText: tr.t('Weekend watchlist'),
                  hintStyle: TextStyle(color: t.inkSubtle),
                  filled: true,
                  fillColor: t.canvas,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: t.edge),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: t.accent, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: Focusable(
                      tokens: t,
                      scale: 1.0,
                      borderRadius: 12,
                      onPressed: () => Navigator.of(context).pop(),
                      child: Container(
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: t.edgeSoft),
                        ),
                        child: Text(
                          tr.t('Cancel'),
                          style: TextStyle(
                            color: t.inkMuted,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Focusable(
                      tokens: t,
                      scale: 1.0,
                      borderRadius: 12,
                      onPressed: _submit,
                      child: Container(
                        alignment: Alignment.center,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: t.accent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          widget.confirm ?? tr.t('Create'),
                          style: TextStyle(
                            color: t.canvas,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
