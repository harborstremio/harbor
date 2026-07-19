import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/net/safe_launch.dart';
import '../../design/focus/focusable.dart';
import '../../design/rating_badges.dart';
import '../../design/tokens.dart';
import '../../domain/ratings/mdblist.dart';
import '../../domain/ratings/omdb.dart';
import '../../domain/settings/settings.dart';

/// The detail hero ratings pill, ported from `hero-ratings.tsx`: divider-joined
/// score badges (IMDb/TMDB primary, RT critics + audience, Letterboxd,
/// Metacritic, Trakt, Simkl, MDBList), each gated on its settings toggle and on
/// data availability. Returns an empty widget when nothing is enabled/present.
class HeroRatings extends StatelessWidget {
  const HeroRatings({
    super.key,
    required this.rating,
    required this.ratingSource,
    required this.omdb,
    required this.mdblist,
    required this.settings,
    required this.tokens,
    this.imdbId,
    this.mediaType = 'movie',
  });

  final String? rating;
  final String ratingSource; // imdb | tmdb
  final OmdbScores? omdb;
  final MdblistScores? mdblist;
  final Settings settings;
  final HarborTokens tokens;

  /// The title's IMDb id — when present, the IMDb / Letterboxd / Trakt / Simkl /
  /// MDBList score badges open that source (1:1 with the web `onOpenUrl`).
  final String? imdbId;
  final String mediaType; // movie | tv (MDBList uses movie|show)

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final showRatings = settings.getBool('showDetailRatings');
    final metacritic = mdblist?.metacritic?.round() ?? omdb?.metascore;
    final items = <Widget>[];
    // A valid IMDb id makes the source badges deep-link to their rating page.
    final tt = (imdbId != null && imdbId!.startsWith('tt')) ? imdbId : null;
    final mdbType = mediaType == 'tv' ? 'show' : 'movie';

    void add(Widget icon, String value, {String? url}) => items.add(
      _ScoreItem(
        icon: icon,
        value: value,
        tokens: t,
        onTap: url == null ? null : () => launchExternalUrl(url),
      ),
    );

    // Primary IMDb / TMDB rating.
    final primaryOn = ratingSource == 'tmdb'
        ? settings.getBool('showTmdbDetail')
        : settings.getBool('showImdbDetail');
    if (rating != null && rating!.isNotEmpty && showRatings && primaryOn) {
      add(
        ratingSource == 'tmdb'
            ? Text(
                'TMDB',
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              )
            : _imdbBadge(),
        rating!,
        url: ratingSource == 'tmdb' || tt == null
            ? null
            : 'https://www.imdb.com/title/$tt/',
      );
    }

    if (showRatings &&
        settings.getBool('showRtDetail') &&
        omdb?.rtCritics != null) {
      add(
        SvgPicture.string(
          omdb!.rtCritics! >= 60 ? kRtFreshSvg : kRtRottenSvg,
          height: 16,
        ),
        '${omdb!.rtCritics}%',
      );
    }

    if (showRatings &&
        settings.getBool('showRtAudienceDetail') &&
        mdblist?.rtAudience != null) {
      add(
        Text(
          '🍿',
          style: TextStyle(
            fontSize: 13,
            color: mdblist!.rtAudience! >= 60 ? t.accent : t.inkSubtle,
          ),
        ),
        '${mdblist!.rtAudience!.round()}%',
      );
    }

    if (showRatings &&
        settings.getBool('showLetterboxdDetail') &&
        mdblist?.letterboxd != null) {
      add(
        _logo('assets/ratings/letterboxd.png'),
        mdblist!.letterboxd!.toStringAsFixed(1),
        url: tt == null ? null : 'https://letterboxd.com/imdb/$tt/',
      );
    }

    if (showRatings &&
        settings.getBool('showMetacriticDetail') &&
        metacritic != null) {
      add(
        Container(
          height: 18,
          constraints: const BoxConstraints(minWidth: 22),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: metacriticBand(metacritic),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '$metacritic',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        '',
      );
    }

    if (showRatings &&
        settings.getBool('showTraktDetail') &&
        mdblist?.trakt != null) {
      add(
        _svgLogo('assets/ratings/trakt.svg'),
        '${mdblist!.trakt!.round()}%',
        url: tt == null ? null : 'https://trakt.tv/search/imdb/$tt',
      );
    }

    final simkl = mdblist?.simkl;
    if (settings.getBool('showSimklBadge') &&
        settings.getBool('simklShowCommunityRatings') &&
        simkl != null) {
      add(
        _logo('assets/ratings/simkl.png'),
        simkl.toStringAsFixed(1),
        url: tt == null ? null : 'https://simkl.com/search/id/?i=$tt',
      );
    }

    if (showRatings &&
        settings.getBool('showMdblistDetail') &&
        mdblist?.score != null) {
      add(
        _logo('assets/ratings/mdblist.png'),
        '${mdblist!.score!.round()}',
        url: tt == null ? null : 'https://mdblist.com/$mdbType/$tt',
      );
    }

    if (items.isEmpty) return const SizedBox.shrink();

    final joined = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      if (i > 0) {
        joined.add(
          Container(
            width: 1,
            height: 14,
            color: t.edgeSoft.withValues(alpha: 0.6),
          ),
        );
      }
      joined.add(items[i]);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: joined),
    );
  }

  Widget _imdbBadge() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
    decoration: BoxDecoration(
      color: const Color(0xFFF5C518),
      borderRadius: BorderRadius.circular(3),
    ),
    child: const Text(
      'IMDb',
      style: TextStyle(
        color: Colors.black,
        fontSize: 9,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.4,
      ),
    ),
  );

  Widget _logo(String asset) =>
      Image.asset(asset, width: 14, height: 14, fit: BoxFit.contain);

  Widget _svgLogo(String asset) =>
      SvgPicture.asset(asset, width: 14, height: 14);
}

class _ScoreItem extends StatelessWidget {
  const _ScoreItem({
    required this.icon,
    required this.value,
    required this.tokens,
    this.onTap,
  });

  final Widget icon;
  final String value;
  final HarborTokens tokens;

  /// Opens the badge's rating source; when null the badge is display-only.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          if (value.isNotEmpty) ...[
            const SizedBox(width: 6),
            Text(
              value,
              style: TextStyle(
                color: tokens.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return content;
    return Focusable(
      tokens: tokens,
      borderRadius: 8,
      scale: 1.0,
      onPressed: onTap!,
      child: content,
    );
  }
}
