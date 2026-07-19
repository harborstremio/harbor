import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/rankings.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

const Map<String, (String, String)> _deptLabels = {
  'Acting': ('Top 100 Actors', 'Most popular performers right now'),
  'Directing': ('Top 100 Directors', 'Filmmakers leading the conversation'),
  'Production': ('Top 100 Producers', 'Names behind the biggest productions'),
  'Writing': ('Top 100 Writers', 'Pens currently in demand'),
};

/// Opens the Top-100 modal for a department, ported from `TopRankModal`: a
/// filterable list of the most popular people, each opening their person view.
void showTopRankModal(BuildContext context, String dept) {
  showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'top-rank',
    barrierColor: Colors.black.withValues(alpha: 0.85),
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (_, _, _) => _TopRankModal(dept: dept),
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

class _TopRankModal extends ConsumerStatefulWidget {
  const _TopRankModal({required this.dept});
  final String dept;

  @override
  ConsumerState<_TopRankModal> createState() => _TopRankModalState();
}

class _TopRankModalState extends ConsumerState<_TopRankModal> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _openPerson(int id) {
    Navigator.of(context).pop();
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.person, {'id': id}));
  }

  void _openMedia(KnownForEntry k) {
    Navigator.of(context).pop();
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.meta, {
            'type': k.mediaType == 'tv' ? 'series' : 'movie',
            'id': 'tmdb:${k.mediaType}:${k.id}',
          }),
        );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final list =
        ref.watch(rankingsProvider).value?.listFor(widget.dept) ??
        const <PersonEntry>[];
    final (title, subtitle) =
        _deptLabels[widget.dept] ?? _deptLabels['Acting']!;

    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? list
        : list
              .where(
                (p) =>
                    p.name.toLowerCase().contains(q) ||
                    p.knownFor.any((k) => k.title.toLowerCase().contains(q)),
              )
              .toList();

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1240, maxHeight: 900),
          child: Material(
            color: t.surface,
            borderRadius: BorderRadius.circular(24),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _header(t, title, subtitle),
                Flexible(
                  child: filtered.isEmpty
                      ? SizedBox(
                          height: 160,
                          child: Center(
                            child: Text(
                              list.isEmpty ? 'Loading…' : 'No matches.',
                              style: TextStyle(color: t.inkMuted, fontSize: 14),
                            ),
                          ),
                        )
                      : FocusTraversalGroup(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
                            child: Wrap(
                              spacing: 16,
                              runSpacing: 16,
                              children: [
                                // Autofocus the first entry so a TV remote lands
                                // on a card rather than nothing when the modal
                                // opens (the search field is left unfocused so it
                                // doesn't force the on-screen keyboard up).
                                for (final (i, p) in filtered.indexed)
                                  _PersonRow(
                                    person: p,
                                    tokens: t,
                                    autofocus: i == 0,
                                    onOpenPerson: _openPerson,
                                    onOpenMedia: _openMedia,
                                  ),
                              ],
                            ),
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

  Widget _header(HarborTokens t, String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 20, 20, 20),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: t.edgeSoft)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 24,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$subtitle · ranked by current popularity · TMDB',
                  style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          SizedBox(
            width: 280,
            child: TvTextField(
              controller: _controller,
              onChanged: (v) => setState(() => _query = v),
              style: TextStyle(color: t.ink, fontSize: 14),
              cursorColor: t.accent,
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Filter by name or title',
                hintStyle: TextStyle(color: t.inkSubtle, fontSize: 14),
                prefixIcon: Icon(Icons.search, color: t.inkSubtle, size: 18),
                filled: true,
                fillColor: t.canvas,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: t.edge),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: t.edge),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide(color: t.accent, width: 2),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Focusable(
            tokens: t,
            borderRadius: 24,
            onPressed: () => Navigator.of(context).pop(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: t.edge),
              ),
              child: Icon(Icons.close, color: t.inkMuted, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.person,
    required this.tokens,
    required this.onOpenPerson,
    required this.onOpenMedia,
    this.autofocus = false,
  });

  final PersonEntry person;
  final HarborTokens tokens;
  final bool autofocus;
  final void Function(int) onOpenPerson;
  final void Function(KnownForEntry) onOpenMedia;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final photo = person.profilePath != null
        ? 'https://image.tmdb.org/t/p/w185${person.profilePath}'
        : null;
    final bestKnown = person.knownFor.take(3).toList();

    return SizedBox(
      width: 372,
      child: Container(
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.4),
          border: Border.all(color: t.edgeSoft),
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo + name open the person; the known-for chips open media.
            Focusable(
              tokens: t,
              borderRadius: 12,
              autofocus: autofocus,
              onPressed: () => onOpenPerson(person.id),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 108,
                    height: 150,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          photo != null
                              ? CachedNetworkImage(
                                  imageUrl: photo,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) => _photoFallback(t),
                                  errorWidget: (_, _, _) => _photoFallback(t),
                                )
                              : _photoFallback(t),
                          Positioned(
                            top: 6,
                            left: 6,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: t.canvas.withValues(alpha: 0.95),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '#${person.rank}',
                                style: TextStyle(
                                  color: t.accent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          person.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t.ink,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'BEST KNOWN FOR',
                          style: TextStyle(
                            color: t.inkSubtle,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (bestKnown.isEmpty)
              Text(
                'No credits available',
                style: TextStyle(color: t.inkSubtle, fontSize: 12),
              )
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final k in bestKnown)
                    _KnownChip(
                      entry: k,
                      tokens: t,
                      onPressed: () => onOpenMedia(k),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _photoFallback(HarborTokens t) => ColoredBox(
    color: t.elevated,
    child: Icon(Icons.person, color: t.inkSubtle, size: 36),
  );
}

class _KnownChip extends StatelessWidget {
  const _KnownChip({
    required this.entry,
    required this.tokens,
    required this.onPressed,
  });

  final KnownForEntry entry;
  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final poster = entry.posterPath != null
        ? 'https://image.tmdb.org/t/p/w92${entry.posterPath}'
        : null;
    return Focusable(
      tokens: t,
      borderRadius: 16,
      scale: 1.04,
      onPressed: onPressed,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 190),
        padding: const EdgeInsets.fromLTRB(2, 2, 10, 2),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.4),
          border: Border.all(color: t.edgeSoft),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 20,
                height: 28,
                child: RpdbPosterImage(
                  metaId: 'tmdb:${entry.mediaType}:${entry.id}',
                  rawPoster: poster,
                  type: entry.mediaType == 'tv' ? 'series' : 'movie',
                  tokens: t,
                  fallback: () => ColoredBox(color: t.canvas),
                ),
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                entry.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (entry.releaseInfo != null) ...[
              const SizedBox(width: 5),
              Text(
                entry.releaseInfo!,
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 10,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
