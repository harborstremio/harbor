import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/catalog/tmdb_person.dart';
import '../../domain/nav/frame.dart';
import 'top_rank_modal.dart';

/// The person view: a hero (photo, name, vitals, biography) over the person's
/// full filmography — Known For, Movies, TV Shows, and crew sections. Ported
/// 1:1 from `PersonView` (award strip + rank badge land with those subsystems).
class PersonView extends ConsumerWidget {
  const PersonView({super.key, required this.personId});

  final int personId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final person = ref.watch(personProvider(personId));
    final rankings = ref.watch(rankingsProvider).value;

    void openMeta(PersonCredit c) => ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.meta, {
            'type': c.mediaType == 'movie' ? 'movie' : 'series',
            'id': creditToMeta(c).id,
          }),
        );

    return ColoredBox(
      color: t.canvas,
      child: person.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
        ),
        error: (_, _) => _centered('Could not load this person.', t),
        data: (p) {
          if (p == null) return _centered('Unknown', t);
          final dept = p.knownForDepartment.isNotEmpty
              ? p.knownForDepartment
              : 'Acting';
          final rank = rankings?.rankOf(personId, dept: dept);
          return _Body(person: p, tokens: t, onOpen: openMeta, rank: rank);
        },
      ),
    );
  }

  Widget _centered(String text, HarborTokens t) => Center(
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 16)),
  );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.person,
    required this.tokens,
    required this.onOpen,
    required this.rank,
  });

  final PersonDetail person;
  final HarborTokens tokens;
  final void Function(PersonCredit) onOpen;
  final int? rank;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final sections = derivePersonSections(person);

    String? backdrop;
    for (final c in sections.knownFor) {
      if (c.background != null) {
        backdrop = c.background;
        break;
      }
    }
    final photo = person.profilePath != null
        ? '$tmdbImg/h632${person.profilePath}'
        : null;

    final rows = <(String, List<PersonCredit>, bool)>[
      ('Known For', sections.knownFor, false),
      if (sections.movies.isNotEmpty)
        ('Movies · ${sections.movies.length}', sections.movies, true),
      if (sections.shows.isNotEmpty)
        ('TV Shows · ${sections.shows.length}', sections.shows, true),
      if (sections.directing.isNotEmpty)
        ('Directing', sections.directing, true),
      if (sections.writing.isNotEmpty) ('Writing', sections.writing, true),
      if (sections.producing.isNotEmpty)
        ('Producing', sections.producing, true),
      if (sections.other.length > 4)
        ('Other Work', sections.other.take(24).toList(), true),
    ];
    final noFilmography = person.cast.isEmpty && person.crew.isEmpty;
    // Autofocus the first row that actually has credits — "Known For" (row 0)
    // is often empty, and an empty row renders nothing to focus.
    final firstPopulated = rows.indexWhere((r) => r.$2.isNotEmpty);

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _Hero(
            person: person,
            photo: photo,
            backdrop: backdrop,
            tokens: t,
            rank: rank,
          ),
        ),
        SliverList.builder(
          itemCount: rows.length,
          itemBuilder: (context, i) {
            final (title, credits, showRole) = rows[i];
            if (credits.isEmpty) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 28),
              child: _FilmRow(
                title: title,
                credits: credits,
                showRole: showRole,
                tokens: t,
                onOpen: onOpen,
                autofocusFirst: i == firstPopulated,
              ),
            );
          },
        ),
        if (noFilmography)
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                pageGutter(Idiom.of(context)),
                40,
                pageGutter(Idiom.of(context)),
                40,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: t.edge, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text(
                      'No filmography on record.',
                      style: TextStyle(color: t.inkMuted, fontSize: 14),
                    ),
                  ),
                ),
              ),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 48)),
      ],
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.person,
    required this.photo,
    required this.backdrop,
    required this.tokens,
    required this.rank,
  });

  final PersonDetail person;
  final String? photo;
  final String? backdrop;
  final HarborTokens tokens;
  final int? rank;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final idiom = Idiom.of(context);
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    final age = person.birthday != null
        ? calcAge(person.birthday!, person.deathday)
        : null;

    final photoBox = ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: phone ? 150 : 240,
        height: phone ? 225 : 360,
        child: _poster(photo, person.name, t),
      ),
    );

    final info = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (person.knownForDepartment.isNotEmpty)
              Text(
                person.knownForDepartment.toUpperCase(),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2.4,
                ),
              ),
            if (rank != null) ...[
              const SizedBox(width: 12),
              _RankChip(
                rank: rank!,
                dept: person.knownForDepartment.isNotEmpty
                    ? person.knownForDepartment
                    : 'Acting',
                tokens: t,
              ),
            ],
          ],
        ),
        SizedBox(height: phone ? 10 : 14),
        Text(
          person.name.isNotEmpty ? person.name : 'Unknown',
          style: TextStyle(
            color: t.ink,
            fontSize: phone ? 40 : 64,
            height: 0.98,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 16),
        _vitals(age, t),
        if (person.biography.isNotEmpty) ...[
          const SizedBox(height: 18),
          _Bio(text: person.biography, tokens: t),
        ],
      ],
    );

    return Stack(
      children: [
        if (backdrop != null)
          Positioned.fill(
            child: ImageFiltered(
              imageFilter: ui.ImageFilter.blur(sigmaX: 80, sigmaY: 80),
              child: Opacity(
                opacity: 0.45,
                child: CachedNetworkImage(
                  imageUrl: backdrop!,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            ),
          ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  t.canvas.withValues(alpha: 0.4),
                  t.canvas.withValues(alpha: 0.7),
                  t.canvas,
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(g, 44, g, 12),
          // Phone stacks the portrait above the vitals so the name never gets
          // crushed into the sliver of width a 240px photo leaves beside it.
          child: phone
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [photoBox, const SizedBox(height: 20), info],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    photoBox,
                    const SizedBox(width: 40),
                    Expanded(child: info),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _vitals(int? age, HarborTokens t) {
    final items = <String>[
      if (person.birthday != null)
        'Born ${fmtDate(person.birthday!)}${age != null ? ' · $age' : ''}',
      if (person.deathday != null) 'Died ${fmtDate(person.deathday!)}',
      if (person.placeOfBirth != null) person.placeOfBirth!,
    ];
    if (items.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 24,
      runSpacing: 8,
      children: [
        for (final s in items)
          Text(s, style: TextStyle(color: t.inkMuted, fontSize: 14)),
      ],
    );
  }
}

/// The "Top N" ranking chip shown beside the department label. Opens the
/// department's Top-100 modal, ported from the person-view rank button.
class _RankChip extends StatelessWidget {
  const _RankChip({
    required this.rank,
    required this.dept,
    required this.tokens,
  });

  final int rank;
  final String dept;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 6,
      scale: 1.06,
      onPressed: () => showTopRankModal(context, dept),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: t.accentSoft,
          border: Border.all(color: t.accent.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'TOP',
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.6,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '$rank',
              style: TextStyle(
                color: t.accent,
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The biography with a remote-operable expand/collapse toggle.
class _Bio extends StatefulWidget {
  const _Bio({required this.text, required this.tokens});

  final String text;
  final HarborTokens tokens;

  @override
  State<_Bio> createState() => _BioState();
}

class _BioState extends State<_Bio> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 680),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.text,
            maxLines: _expanded ? null : 4,
            overflow: _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
            style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.55),
          ),
          const SizedBox(height: 8),
          Focusable(
            tokens: t,
            borderRadius: 8,
            scale: 1.04,
            onPressed: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                _expanded ? 'Show less' : 'Read more',
                style: TextStyle(
                  color: t.accent,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilmRow extends StatelessWidget {
  const _FilmRow({
    required this.title,
    required this.credits,
    required this.showRole,
    required this.tokens,
    required this.onOpen,
    required this.autofocusFirst,
  });

  final String title;
  final List<PersonCredit> credits;
  final bool showRole;
  final HarborTokens tokens;
  final void Function(PersonCredit) onOpen;
  final bool autofocusFirst;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Text(
            title,
            style: TextStyle(
              color: t.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 288,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: credits.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, i) => _FilmCard(
                credit: credits[i],
                showRole: showRole,
                tokens: t,
                onPressed: () => onOpen(credits[i]),
                autofocus: autofocusFirst && i == 0,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FilmCard extends StatelessWidget {
  const _FilmCard({
    required this.credit,
    required this.showRole,
    required this.tokens,
    required this.onPressed,
    required this.autofocus,
  });

  final PersonCredit credit;
  final bool showRole;
  final HarborTokens tokens;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final role = (credit.character?.trim().isNotEmpty ?? false)
        ? credit.character!.trim()
        : (credit.job?.trim() ?? '');
    final subtitle = showRole
        ? [
            role,
            credit.releaseInfo,
          ].where((s) => s != null && s.isNotEmpty).join(' · ')
        : (credit.releaseInfo ?? '');

    return SizedBox(
      width: 150,
      child: Focusable(
        tokens: t,
        autofocus: autofocus,
        onPressed: onPressed,
        borderRadius: 12,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 2 / 3,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: RpdbPosterImage(
                  metaId: creditToMeta(credit).id,
                  rawPoster: credit.poster,
                  type: credit.mediaType == 'movie' ? 'movie' : 'series',
                  tokens: t,
                  fallback: () => _nameFallback(credit.title, t),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(2, 8, 2, 0),
              child: Text(
                credit.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 13,
                  height: 1.25,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (subtitle.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(2, 2, 2, 0),
                child: Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

Widget _nameFallback(String name, HarborTokens t) => ColoredBox(
  color: t.surface,
  child: Center(
    child: Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        name,
        textAlign: TextAlign.center,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: t.inkSubtle, fontSize: 12),
      ),
    ),
  ),
);

/// A person photo (not a poster, so no RPDB routing), with a name fallback.
Widget _poster(String? url, String name, HarborTokens t) {
  if (url == null) return _nameFallback(name, t);
  return CachedNetworkImage(
    imageUrl: url,
    fit: BoxFit.cover,
    placeholder: (_, _) => ColoredBox(color: t.surface),
    errorWidget: (_, _, _) => _nameFallback(name, t),
  );
}
