import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/dashed_border.dart';
import '../../design/tokens.dart';
import '../../domain/lists/list_types.dart';
import 'add_list_form.dart';
import 'source_dot.dart';

/// The Library → My Lists empty state: a pitch to import a list, the add form,
/// and the supported-source chips. Ported 1:1 from the web
/// `src/views/lists/empty-state.tsx`.
class ListsEmptyState extends ConsumerWidget {
  const ListsEmptyState({super.key, required this.onAdd});

  final void Function(String ref, String name) onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: DashedBorder(
            color: t.edge,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 56),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: t.elevated,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.playlist_add_rounded,
                      size: 24,
                      color: t.inkMuted,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    tr.t('Bring your lists with you'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Text(
                      tr.t(
                        'Paste a public list from Trakt, MDBList, TMDB, '
                        'Letterboxd, IMDb, or MyAnimeList. Harbor pulls the '
                        'titles in and keeps the artwork sharp.',
                      ),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: t.inkMuted,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    decoration: BoxDecoration(
                      color: t.canvas.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: t.edgeSoft),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: AddListForm(
                      submitLabel: tr.t('Add list'),
                      hideCancel: true,
                      onSubmit: onAdd,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [for (final s in ListSource.values) _chip(t, s)],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(HarborTokens t, ListSource source) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: t.elevated,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: sourceDotColor(t, source),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          source.label,
          style: TextStyle(
            color: t.ink,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}
