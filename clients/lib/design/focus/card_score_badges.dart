import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/providers.dart';
import '../../domain/addons/models.dart';
import '../../domain/settings/settings.dart';
import '../../domain/streams/stream_ids.dart';
import '../tokens.dart';

/// One score badge on a poster card — a source marker plus its value.
class _CardBadge {
  const _CardBadge({required this.mark, required this.value});
  final Widget mark;
  final String value;
}

/// The score badges shown in a poster card's corner, ported from the web
/// `pick-card` `ScoreStack`: a compact right-aligned chip listing each enabled
/// rating, capped at `cardBadgeLimit` and placed by `badgePlacement`.
///
/// The primary IMDb / TMDB rating comes from the meta's inline `imdbRating` (no
/// network — the common Cinemeta case). The cross-site sources (Rotten Tomatoes
/// audience, Metacritic, Letterboxd, Trakt, MDBList score) are fetched in a
/// debounced batch from MDBList — see [mdblistCardScoresProvider] — for `tt…`
/// ids when their toggle is on and an `mdblistKey` is set. The MAL / Simkl
/// anime-card sources remain a later slice.
class CardScoreBadges extends ConsumerWidget {
  const CardScoreBadges({
    super.key,
    required this.item,
    required this.tokens,
    this.kids = false,
  });

  final MetaPreview item;
  final HarborTokens tokens;

  /// On the kids surface the rating shows as a single gold star badge (web
  /// `KidsStarBadge`) rather than the adult score chip.
  final bool kids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(settingsProvider);
    if (!s.getBool('showCardBadges')) return const SizedBox.shrink();

    final primary = _badges(s);

    // The kids surface shows only the single primary star, never the adult
    // cross-site chips (web renders `KidsStarBadge` in place of `ScoreStack`).
    if (kids) {
      if (primary.isEmpty) return const SizedBox.shrink();
      final atTopKids = s.getString('badgePlacement') == 'top';
      return _kidsStar(primary.first.value, atTopKids);
    }

    final badges = [...primary, ..._fetchedBadges(ref, s)];
    if (badges.isEmpty) return const SizedBox.shrink();

    final limit = math.max(1, s.getInt('cardBadgeLimit'));
    final shown = badges.take(limit).toList();
    // The web scales the stack down as more badges crowd in.
    final scale = switch (shown.length) {
      <= 3 => 1.0,
      4 => 0.88,
      5 => 0.78,
      _ => 0.7,
    };
    final atTop = s.getString('badgePlacement') == 'top';

    final row = <Widget>[];
    for (var i = 0; i < shown.length; i++) {
      if (i > 0) {
        row.add(
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Text(
              '·',
              style: TextStyle(
                color: tokens.inkSubtle,
                fontSize: 10,
                height: 1,
              ),
            ),
          ),
        );
      }
      row.add(shown[i].mark);
      // Some marks (Metacritic) carry the number inside the badge and set an
      // empty value — skip the trailing text for those.
      if (shown[i].value.isNotEmpty) {
        row.add(const SizedBox(width: 3));
        row.add(
          Text(
            shown[i].value,
            style: TextStyle(
              color: tokens.ink,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              height: 1,
            ),
          ),
        );
      }
    }

    return PositionedDirectional(
      end: 6,
      top: atTop ? 6 : null,
      bottom: atTop ? null : 6,
      child: Transform.scale(
        scale: scale,
        // Web scales from `transformOrigin: 'right'` (vertical centre, right
        // edge) for both placements.
        alignment: Alignment.centerRight,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: tokens.canvas.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: row),
        ),
      ),
    );
  }

  /// The kid-surface rating: the score value inside a gold star badge, ported
  /// from the web `KidsStarBadge`.
  Widget _kidsStar(String value, bool atTop) => PositionedDirectional(
    end: 4,
    top: atTop ? 4 : null,
    bottom: atTop ? null : 4,
    child: SizedBox(
      width: 34,
      height: 34,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SvgPicture.asset('assets/kids/starbadge.svg'),
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                height: 1,
                shadows: [Shadow(color: Color(0x99000000), blurRadius: 3)],
              ),
            ),
          ),
        ],
      ),
    ),
  );

  /// The enabled badges for [item]. Slice 1: the inline IMDb / TMDB rating,
  /// skipped for anime ids (their MAL/Harbor rating is a later slice).
  List<_CardBadge> _badges(Settings s) {
    final rating = item.imdbRating;
    if (rating == null || rating <= 0) return const [];
    if (isAnimeMetaId(item.id)) return const [];
    final value = rating.toStringAsFixed(1);
    // A `tt…` id carries an IMDb rating; anything else carries the TMDB vote —
    // the web `cardImdbValue` / `cardRating` distinction.
    if (item.id.startsWith('tt')) {
      if (s.getBool('showImdbBadge')) {
        return [_CardBadge(mark: _imdbMark(), value: value)];
      }
    } else if (s.getBool('showTmdbBadge')) {
      return [_CardBadge(mark: _tmdbMark(), value: value)];
    }
    return const [];
  }

  /// The cross-site badges fetched in a batch from MDBList (Rotten Tomatoes
  /// audience, Metacritic, Letterboxd, Trakt, MDBList score), ported from the
  /// web `pick-card` `cardBadges`. Fetched when at least one source toggle is on
  /// and an `mdblistKey` is configured; a `tmdb:` id is first resolved to its
  /// `tt…` id (matching the web `useTmdbImdbId` → `useMdblistCardScores` path).
  /// Returns empty until the id + batch resolve; the card rebuilds when they do.
  List<_CardBadge> _fetchedBadges(WidgetRef ref, Settings s) {
    final wantPopcorn = s.getBool('showPopcornBadge');
    final wantMetacritic = s.getBool('showMetacriticBadge');
    final wantLetterboxd = s.getBool('showLetterboxdBadge');
    final wantMdblist = s.getBool('showMdblistBadge');
    final wantTrakt = s.getBool('showTraktBadge');
    if (!(wantPopcorn ||
        wantMetacritic ||
        wantLetterboxd ||
        wantMdblist ||
        wantTrakt)) {
      return const [];
    }
    if (s.mdblistKey.isEmpty) return const [];

    // Resolve the imdb id: a `tt…` id passes straight through; a `tmdb:` id is
    // resolved via TMDB `external_ids` (null until it resolves, or without a
    // TMDB key). Anything else has no cross-site scores.
    final rawId = item.id;
    final String? imdbId;
    if (rawId.startsWith('tt')) {
      imdbId = rawId;
    } else if (rawId.startsWith('tmdb:')) {
      imdbId = ref.watch(imdbIdProvider(rawId)).value;
    } else {
      imdbId = null;
    }
    if (imdbId == null || !imdbId.startsWith('tt')) return const [];

    final kind = item.type == 'series' ? 'show' : 'movie';
    final scores = ref
        .watch(mdblistCardScoresProvider((imdbId: imdbId, kind: kind)))
        .value;
    if (scores == null) return const [];

    final out = <_CardBadge>[];
    final audience = scores.rtAudience;
    if (wantPopcorn && audience != null) {
      out.add(
        _CardBadge(mark: _popcornMark(audience), value: '${audience.round()}%'),
      );
    }
    final metacritic = scores.metacritic;
    if (wantMetacritic && metacritic != null) {
      out.add(_CardBadge(mark: _metacriticMark(metacritic), value: ''));
    }
    final letterboxd = scores.letterboxd;
    if (wantLetterboxd && letterboxd != null) {
      // The MDBList value is 0–10; Letterboxd's native scale is 0–5 stars.
      out.add(
        _CardBadge(
          mark: _logoMark('assets/ratings/letterboxd.png'),
          value: (letterboxd / 2).toStringAsFixed(1),
        ),
      );
    }
    final mdblist = scores.score;
    if (wantMdblist && mdblist != null) {
      out.add(
        _CardBadge(
          mark: _logoMark('assets/ratings/mdblist.png'),
          value: '${mdblist.round()}',
        ),
      );
    }
    final trakt = scores.trakt;
    if (wantTrakt && trakt != null) {
      out.add(
        _CardBadge(
          mark: _svgLogoMark('assets/ratings/trakt.svg'),
          value: '${trakt.round()}%',
        ),
      );
    }
    return out;
  }

  // A monochrome popcorn glyph (lucide `Popcorn`) so it can be tinted — unlike
  // the color emoji, which ignores the foreground color and drops the web's
  // audience-liked highlight.
  static const _popcornSvg =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
      '<path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 '
      '2 2 0 0 0 0 4"/><path d="M10 22 9 8"/><path d="m14 22 1-14"/>'
      '<path d="M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.5.9-1 .9H6.8c-.5 0-.9-.4-1-.9'
      'l-2.6-12c-.1-.6.3-1 .8-1Z"/></svg>';

  Widget _popcornMark(double value) => SvgPicture.string(
    _popcornSvg,
    width: 12,
    height: 12,
    colorFilter: ColorFilter.mode(
      value >= 60 ? tokens.accent : tokens.inkMuted,
      BlendMode.srcIn,
    ),
  );

  Color _metacriticBand(double v) {
    if (v >= 61) return const Color(0xFF10B981);
    if (v >= 40) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  // The color band uses the raw value (web `metacriticTone(badge.value)`); only
  // the displayed number rounds.
  Widget _metacriticMark(double v) => Container(
    constraints: const BoxConstraints(minWidth: 15),
    height: 13,
    alignment: Alignment.center,
    padding: const EdgeInsets.symmetric(horizontal: 2),
    decoration: BoxDecoration(
      color: _metacriticBand(v),
      borderRadius: BorderRadius.circular(3),
    ),
    child: Text(
      '${v.round()}',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 8.5,
        fontWeight: FontWeight.w700,
        height: 1,
      ),
    ),
  );

  Widget _logoMark(String asset) =>
      Image.asset(asset, width: 11, height: 11, fit: BoxFit.contain);

  Widget _svgLogoMark(String asset) =>
      SvgPicture.asset(asset, width: 11, height: 11);

  Widget _imdbMark() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 0.5),
    decoration: BoxDecoration(
      color: const Color(0xFFF5C518),
      borderRadius: BorderRadius.circular(2),
    ),
    child: const Text(
      'IMDb',
      style: TextStyle(
        color: Colors.black,
        fontSize: 8,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.4,
        height: 1,
      ),
    ),
  );

  Widget _tmdbMark() => Text(
    'TMDB',
    style: TextStyle(
      color: tokens.inkMuted,
      fontSize: 8,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.2,
      height: 1,
    ),
  );
}
