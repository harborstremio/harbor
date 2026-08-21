import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/focus/tv_row.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/catalog_row.dart';
import '../../domain/i18n/translations.dart';

/// A connected-service Library tab — the user's lists from Trakt / Simkl / MAL /
/// Letterboxd rendered as scrollable rails (web's per-service Library tabs).
/// Each service already exposes its lists as a rows provider, so the tab just
/// renders that: a spinner while loading, an actionable empty state, else the
/// titled rails of poster cards (click → the shared detail/play path).
class ServiceRowsTab extends StatelessWidget {
  const ServiceRowsTab({
    super.key,
    required this.tokens,
    required this.tr,
    required this.rows,
    required this.emptyText,
    required this.onSelect,
  });

  final HarborTokens tokens;
  final Translations tr;
  final AsyncValue<List<CatalogRow>> rows;
  final String emptyText;
  final void Function(MetaPreview meta) onSelect;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return rows.when(
      loading: () => Center(
        child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
      ),
      error: (_, _) => _message(t, tr.t('Could not load this library.')),
      data: (list) {
        final visible = [for (final r in list) if (r.items.isNotEmpty) r];
        if (visible.isEmpty) return _message(t, emptyText);
        return ListView.builder(
          padding: const EdgeInsets.only(bottom: 40),
          itemCount: visible.length,
          itemBuilder: (context, i) {
            final row = visible[i];
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: TvRow(
                title: tr.t(row.title),
                items: row.items,
                tokens: t,
                viewAll: false,
                autofocusFirst: i == 0,
                onSelect: onSelect,
              ),
            );
          },
        );
      },
    );
  }

  Widget _message(HarborTokens t, String text) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(color: t.inkMuted, fontSize: 15),
      ),
    ),
  );
}
