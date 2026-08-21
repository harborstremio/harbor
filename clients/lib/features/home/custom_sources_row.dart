import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/tmdb_collection.dart';
import '../../domain/home/custom_sources.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

/// A Home "custom source" shelf — a titled horizontal rail of [CustomSourceFolder]
/// tiles, ported 1:1 from the web `CustomSourcesRow` / `SourceFolderCard`. Each
/// tile is a cover-image (or emoji) card that, when opened, fetches the folder's
/// aggregated works and pushes them into the shared grid view.
class CustomSourcesRow extends ConsumerWidget {
  const CustomSourcesRow({super.key, required this.row});

  final CustomSourceRow row;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (row.folders.isEmpty) return const SizedBox.shrink();
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final g = pageGutter(Idiom.of(context));
    // Match the web tile widths: poster folders are 160-wide portrait, landscape
    // folders 320-wide 16:9.
    final isPoster = row.folders.first.isPoster;
    final tileWidth = isPoster ? 160.0 : 320.0;
    final tileHeight = isPoster ? 240.0 : 180.0;

    return FocusTraversalGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(g, 4, g, 10),
            child: Text(
              tr.t(row.title),
              style: TextStyle(
                color: t.ink,
                fontSize: 19,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(
            // A little vertical slack so the 1.04 focus-scale is never clipped
            // by the fixed rail height.
            height: tileHeight + 16,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: row.folders.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => Center(
                child: SizedBox(
                  height: tileHeight,
                  child: _SourceFolderCard(
                    folder: row.folders[i],
                    tokens: t,
                    tr: tr,
                    width: tileWidth,
                    autofocus: false,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceFolderCard extends ConsumerStatefulWidget {
  const _SourceFolderCard({
    required this.folder,
    required this.tokens,
    required this.tr,
    required this.width,
    required this.autofocus,
  });

  final CustomSourceFolder folder;
  final HarborTokens tokens;
  final Translations tr;
  final double width;
  final bool autofocus;

  @override
  ConsumerState<_SourceFolderCard> createState() => _SourceFolderCardState();
}

class _SourceFolderCardState extends ConsumerState<_SourceFolderCard> {
  bool _focused = false;
  bool _loading = false;

  Future<void> _open() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      final resolved = await _resolveMetas();
      if (!mounted) return;
      // null => an error dialog was shown, or no supported source could resolve
      // (e.g. a Trakt-list folder — Slice 3). A resolved source always opens the
      // grid, even empty, matching web `openGrid` (which navigates regardless of
      // the result and lets the grid show its own empty state).
      if (resolved == null) return;
      ref
          .read(navControllerProvider.notifier)
          .push(
            Frame(FrameKind.grid, {
              'title': resolved.title,
              'items': [for (final m in resolved.items) m.json],
            }),
          );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Resolves the folder's works + the grid title, mirroring the web
  /// `SourceFolderCard.handleClick` priority: native sources first (TMDB
  /// discover/company/collection), then the add-on catalog. Returns null when an
  /// error dialog was surfaced (missing key / missing add-on) or no supported
  /// source could be resolved (so the caller opens nothing).
  Future<({String title, List<MetaPreview> items})?> _resolveMetas() async {
    final folder = widget.folder;
    if (folder.sources.isNotEmpty) {
      final source = folder.sources.first;
      // Web opens the grid titled `source.title || folder.title` for native
      // sources.
      final title = (source.title?.isNotEmpty ?? false)
          ? source.title!
          : folder.title;
      if (source.provider == 'tmdb') {
        final key = ref.read(settingsProvider).tmdbKey;
        if (key.isEmpty) {
          await _showMissingTmdbKey();
          return null;
        }
        final client = ref.read(tmdbClientProvider);
        final type = source.mediaType.toLowerCase() == 'tv' ? 'tv' : 'movie';
        if (source.tmdbSourceType == 'DISCOVER' ||
            source.tmdbSourceType == 'COMPANY') {
          final params = <String, String>{};
          if (source.sortBy != null) params['sort_by'] = source.sortBy!;
          final filters = source.filters;
          if (filters != null) {
            filters.forEach((k, v) {
              // A multi-value filter arrives as a JSON array; TMDB wants CSV
              // (`878,12`), which is also what web's String(v) produces —
              // Dart's '$v' on a List would emit `[878, 12]`.
              final s = v is List ? v.join(',') : '$v';
              if (k == 'year') {
                params[type == 'tv'
                        ? 'first_air_date_year'
                        : 'primary_release_year'] =
                    s;
              } else if (k == 'voteCountGte') {
                params['vote_count.gte'] = s;
              } else if (k == 'voteAverageGte') {
                params['vote_average.gte'] = s;
              } else {
                params[_camelToSnake(k)] = s;
              }
            });
          }
          if (source.tmdbSourceType == 'COMPANY' && source.tmdbId != null) {
            params['with_companies'] = source.tmdbId!;
          }
          return (title: title, items: await client.discover(type, params));
        }
        if (source.tmdbSourceType == 'COLLECTION' && source.tmdbId != null) {
          final id = int.tryParse(source.tmdbId!);
          if (id == null) return (title: title, items: const <MetaPreview>[]);
          final coll = await fetchTmdbCollection(client, id);
          return (title: title, items: coll?.parts ?? const <MetaPreview>[]);
        }
      }
      // Trakt-list folders need the list fetch + hydrate plumbing (Slice 3);
      // fall through so a catalog source (if any) can still resolve.
    }

    if (folder.catalogSources.isEmpty) return null;
    final source = folder.catalogSources.first;
    final addon = ref
        .read(activeAddonsProvider)
        .where((a) => (a.manifest?.id ?? a.id) == source.addonId)
        .firstOrNull;
    if (addon == null) {
      await _showAddonMissing(source.addonId);
      return null;
    }
    final base = addon.transportUrl.replaceFirst(
      RegExp(r'/manifest\.json$'),
      '',
    );
    final res = await ref
        .read(addonClientProvider)
        .catalog(base, source.type, source.catalogId);
    return (
      title: folder.title,
      items: res.valueOrNull ?? const <MetaPreview>[],
    );
  }

  String _camelToSnake(String s) => s.replaceAllMapped(
    RegExp('[A-Z]'),
    (m) => '_${m.group(0)!.toLowerCase()}',
  );

  Future<void> _showMissingTmdbKey() => showContextMenu<void>(
    context: context,
    tokens: widget.tokens,
    actions: [
      ContextMenuAction(
        value: null,
        icon: Icons.vpn_key_outlined,
        label: widget.tr.t('Missing TMDB Key'),
      ),
    ],
  );

  Future<void> _showAddonMissing(String addonId) => showContextMenu<void>(
    context: context,
    tokens: widget.tokens,
    actions: [
      ContextMenuAction(
        value: null,
        icon: Icons.extension_off_outlined,
        label: widget.tr.t('Addon not installed'),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final f = widget.folder;
    final showGif = _focused && (f.focusGifUrl?.isNotEmpty ?? false);
    return Focusable(
      tokens: t,
      autofocus: widget.autofocus,
      borderRadius: 16,
      scale: 1.04,
      onFocusChange: (v) => setState(() => _focused = v),
      onPressed: _open,
      child: Opacity(
        opacity: _loading ? 0.5 : 1,
        child: SizedBox(
          width: widget.width,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Cover art, or an emoji / initial fallback when none is set.
                if (f.coverImageUrl?.isNotEmpty ?? false)
                  AnimatedOpacity(
                    opacity: showGif ? 0 : 1,
                    duration: const Duration(milliseconds: 300),
                    child: CachedNetworkImage(
                      imageUrl: f.coverImageUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => _fallback(t, f),
                      placeholder: (_, _) => ColoredBox(color: t.elevated),
                    ),
                  )
                else
                  _fallback(t, f),
                if (f.focusGifUrl?.isNotEmpty ?? false)
                  AnimatedOpacity(
                    opacity: showGif ? 1 : 0,
                    duration: const Duration(milliseconds: 300),
                    child: CachedNetworkImage(
                      imageUrl: f.focusGifUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => const SizedBox.shrink(),
                      placeholder: (_, _) => const SizedBox.shrink(),
                    ),
                  ),
                // Bottom-up scrim so the title stays legible over any art.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        Color(0xE0000000),
                        Color(0x4D000000),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
                if (!f.hideTitle)
                  Positioned(
                    left: 14,
                    right: 14,
                    bottom: 12,
                    child: Text(
                      f.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w600,
                        height: 1.08,
                        shadows: [
                          Shadow(color: Color(0xB3000000), blurRadius: 14),
                        ],
                      ),
                    ),
                  ),
                if (_loading)
                  const Center(
                    child: SizedBox(
                      width: 26,
                      height: 26,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The cover fallback — the folder's emoji centred on the elevated surface, or
  /// the title's initial when there is no emoji.
  Widget _fallback(HarborTokens t, CustomSourceFolder f) {
    final emoji = f.coverEmoji;
    return ColoredBox(
      color: t.elevated,
      child: Center(
        child: Text(
          (emoji?.isNotEmpty ?? false)
              ? emoji!
              : (f.title.isNotEmpty ? f.title.characters.first : '★'),
          style: TextStyle(
            fontSize: (emoji?.isNotEmpty ?? false) ? 44 : 30,
            color: t.inkMuted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
