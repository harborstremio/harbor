import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/nav_controller.dart';
import '../../../app/sports_providers.dart';
import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/sports/sports_espn.dart';
import '../../../domain/sports/sports_match_detail.dart';

const _yellow = Color(0xFFFACC15);
const _red = Color(0xFFEF4444);
const _green = Color(0xFF22C55E);
const _pitch = Color(0xFF2B4C30);

const _soccerTags = {
  'EPL',
  'UCL',
  'LALIGA',
  'SERIEA',
  'BUNDESLIGA',
  'LIGUE1',
  'MLS',
  'ROSHN',
  'UEL',
  'UECL',
  'WC',
  'AFC',
};

int _cards(String? v) => int.tryParse(v ?? '0') ?? 0;

double _statNum(String? v) =>
    double.tryParse((v ?? '0').replaceAll(RegExp(r'[^0-9.\-]'), '')) ?? 0;

/// The live-TV match detail — score header over Summary / Lineups (or MMA
/// Profile) / Stats tabs. Ported 1:1 from `MatchDetailView`. The [game] is the
/// scoreboard row; the deep detail is fetched from ESPN.
class MatchDetailView extends ConsumerStatefulWidget {
  const MatchDetailView({super.key, required this.game});

  final SportsGame game;

  @override
  ConsumerState<MatchDetailView> createState() => _MatchDetailViewState();
}

class _MatchDetailViewState extends ConsumerState<MatchDetailView> {
  late final bool _isCombat =
      widget.game.id.contains('|') || widget.game.league == 'UFC';
  late String _tab = 'summary';

  List<String> get _tabs => _isCombat
      ? const ['summary', 'profile', 'stats']
      : const ['summary', 'lineups', 'stats'];

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final async = ref.watch(
      matchSummaryProvider((
        leagueTag: widget.game.league,
        eventId: widget.game.id,
      )),
    );
    final detail = async.asData?.value;

    return Container(
      color: t.canvas,
      child: Column(
        children: [
          _header(t, detail),
          _tabBar(t),
          Expanded(
            child: async.isLoading
                ? Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: t.inkSubtle,
                      ),
                    ),
                  )
                : detail == null
                ? _emptyMessage(t, 'Failed to load match details.')
                : _tabBody(t, detail),
          ),
        ],
      ),
    );
  }

  Widget _header(HarborTokens t, SportsMatchDetail? detail) {
    final g = widget.game;
    final live = g.state == SportsState.live;
    final hYellow = _cards(detail?.homeStats.yellowCards);
    final hRed = _cards(detail?.homeStats.redCards);
    final aYellow = _cards(detail?.awayStats.yellowCards);
    final aRed = _cards(detail?.awayStats.redCards);
    final stateText = g.detail.isNotEmpty
        ? g.detail
        : (live
              ? 'Live'
              : g.state == SportsState.post
              ? 'Final'
              : 'Upcoming');

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 72, 24, 32),
      child: Stack(
        children: [
          Align(
            alignment: Alignment.topLeft,
            child: Focusable(
              tokens: t,
              borderRadius: 999,
              onPressed: () => ref.read(navControllerProvider.notifier).back(),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: t.elevated.withValues(alpha: 0.8),
                  shape: BoxShape.circle,
                  border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
                ),
                child: Icon(Icons.arrow_back, size: 20, color: t.ink),
              ),
            ),
          ),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: t.accent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: t.accent.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (live) ...[
                          _LiveDot(color: t.accent),
                          const SizedBox(width: 8),
                        ],
                        Text(
                          g.league,
                          style: TextStyle(
                            color: t.accent,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  Row(
                    children: [
                      Expanded(
                        child: _sideColumn(
                          t,
                          g.home,
                          yellow: hYellow,
                          red: hRed,
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 16,
                            ),
                            decoration: BoxDecoration(
                              color: t.elevated.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(28),
                              border: Border.all(
                                color: t.edgeSoft.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _score(t, g.home.score),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  child: Text(
                                    '-',
                                    style: TextStyle(
                                      color: t.inkSubtle,
                                      fontSize: 36,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                _score(t, g.away.score),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: t.ink,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              stateText,
                              style: TextStyle(
                                color: t.canvas,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Expanded(
                        child: _sideColumn(
                          t,
                          g.away,
                          yellow: aYellow,
                          red: aRed,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _score(HarborTokens t, String score) => Text(
    score.isNotEmpty ? score : '0',
    style: TextStyle(
      color: t.ink,
      fontSize: 56,
      fontWeight: FontWeight.w900,
      letterSpacing: -2,
      fontFeatures: const [FontFeature.tabularFigures()],
    ),
  );

  Widget _sideColumn(
    HarborTokens t,
    SportsSide side, {
    required int yellow,
    required int red,
  }) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 96,
        height: 96,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
        ),
        child: side.logo.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: side.logo,
                fit: BoxFit.contain,
                errorWidget: (_, _, _) => const SizedBox.shrink(),
              )
            : const SizedBox.shrink(),
      ),
      const SizedBox(height: 16),
      Text(
        side.name,
        textAlign: TextAlign.center,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: t.ink,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
      ),
      if (yellow > 0 || red > 0) ...[
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < yellow; i++) _cardChip(_yellow),
            for (var i = 0; i < red; i++) _cardChip(_red),
          ],
        ),
      ],
    ],
  );

  Widget _cardChip(Color color) => Container(
    width: 10,
    height: 14,
    margin: const EdgeInsets.symmetric(horizontal: 1),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(2),
      border: Border.all(color: Colors.black.withValues(alpha: 0.2)),
    ),
  );

  Widget _tabBar(HarborTokens t) => Container(
    constraints: const BoxConstraints(maxWidth: 900),
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.symmetric(horizontal: 24),
    decoration: BoxDecoration(
      border: Border(
        bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.5)),
      ),
    ),
    // The tabs scroll horizontally so they never overflow a narrow phone;
    // on a wide screen they simply fit without scrolling.
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final id in _tabs)
            Padding(
              padding: const EdgeInsets.only(right: 24),
              child: Focusable(
                tokens: t,
                borderRadius: 6,
                onPressed: () => setState(() => _tab = id),
                child: Container(
                  padding: const EdgeInsets.only(bottom: 12, top: 4),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: _tab == id ? t.accent : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    _capitalize(id),
                    style: TextStyle(
                      color: _tab == id ? t.ink : t.inkSubtle,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );

  Widget _tabBody(HarborTokens t, SportsMatchDetail detail) {
    final child = switch (_tab) {
      'summary' => _SummaryTab(detail: detail, tokens: t),
      'lineups' => _LineupsTab(detail: detail, tokens: t),
      'stats' => _StatsTab(detail: detail, tokens: t),
      'profile' => _MmaProfileTab(detail: detail, tokens: t),
      _ => const SizedBox.shrink(),
    };
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 900),
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: child,
        ),
      ),
    );
  }

  Widget _emptyMessage(HarborTokens t, String message) => Center(
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: TextStyle(color: t.inkSubtle, fontSize: 14),
    ),
  );

  static String _capitalize(String s) =>
      s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

// ── Summary ──────────────────────────────────────────────────────────────────

String? _playerImage(MatchEvent e, List<MatchPlayer> players) {
  MatchPlayer? found;
  final pName = e.participantName?.toLowerCase();
  if (pName != null && pName.isNotEmpty) {
    found = _firstOrNull(players, (p) {
      final lower = p.name.toLowerCase();
      final last = lower.split(' ').last;
      return lower == pName || lower.contains(pName) || pName.contains(last);
    });
  }
  if (found == null && e.text.isNotEmpty) {
    final textLower = e.text.toLowerCase();
    found = _firstOrNull(players, (p) {
      final last = p.name.toLowerCase().split(' ').last;
      return last.length > 2 && textLower.contains(last);
    });
  }
  final img = found?.image;
  return (img != null && img.isNotEmpty) ? img : null;
}

T? _firstOrNull<T>(Iterable<T> items, bool Function(T) test) {
  for (final it in items) {
    if (test(it)) return it;
  }
  return null;
}

String _eventGlyph(MatchEventType type) => switch (type) {
  MatchEventType.goal => '⚽',
  MatchEventType.substitution => '🔄',
  MatchEventType.other => 'ℹ️',
  _ => '',
};

class _SummaryTab extends StatelessWidget {
  const _SummaryTab({required this.detail, required this.tokens});

  final SportsMatchDetail detail;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (detail.events.isEmpty) {
      return _centerNote(t, 'No events available yet.');
    }
    final players = [...detail.homeRoster, ...detail.awayRoster];
    return Column(
      children: [
        for (final e in detail.events) ...[
          _eventRow(t, e, _playerImage(e, players)),
          const SizedBox(height: 16),
        ],
      ],
    );
  }

  Widget _eventRow(HarborTokens t, MatchEvent e, String? image) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft.withValues(alpha: 0.3)),
    ),
    child: Row(
      children: [
        SizedBox(
          width: 48,
          child: Text(
            e.time,
            textAlign: TextAlign.center,
            style: TextStyle(color: t.inkMuted, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(width: 16),
        _eventIcon(t, e, image),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                e.text,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (e.participantName != null &&
                  e.participantName!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  e.participantName!,
                  style: TextStyle(color: t.inkSubtle, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );

  Widget _eventIcon(HarborTokens t, MatchEvent e, String? image) {
    if (image != null) {
      return ClipOval(
        child: SizedBox(
          width: 40,
          height: 40,
          child: CachedNetworkImage(imageUrl: image, fit: BoxFit.cover),
        ),
      );
    }
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.canvas,
        shape: BoxShape.circle,
        border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
      ),
      child: switch (e.type) {
        MatchEventType.yellowCard => Container(
          width: 12,
          height: 16,
          decoration: BoxDecoration(
            color: _yellow,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        MatchEventType.redCard => Container(
          width: 12,
          height: 16,
          decoration: BoxDecoration(
            color: _red,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        _ => Text(_eventGlyph(e.type), style: const TextStyle(fontSize: 18)),
      },
    );
  }
}

// ── Lineups ──────────────────────────────────────────────────────────────────

class _LineupsTab extends StatelessWidget {
  const _LineupsTab({required this.detail, required this.tokens});

  final SportsMatchDetail detail;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (detail.homeRoster.isEmpty && detail.awayRoster.isEmpty) {
      return _centerNote(t, 'Lineups not available yet.');
    }
    final isSoccer = _soccerTags.contains(detail.game.league);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isSoccer && detail.homeRoster.isNotEmpty) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _pitchColumn(
                  t,
                  detail.game.home,
                  detail.homeRoster,
                  detail.homeFormation ?? '',
                  isHome: true,
                ),
              ),
              const SizedBox(width: 24),
              Expanded(
                child: _pitchColumn(
                  t,
                  detail.game.away,
                  detail.awayRoster,
                  detail.awayFormation ?? '',
                  isHome: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _rosterList(t, detail.game.home.name, detail.homeRoster),
            ),
            const SizedBox(width: 24),
            Expanded(
              child: _rosterList(t, detail.game.away.name, detail.awayRoster),
            ),
          ],
        ),
      ],
    );
  }

  Widget _pitchColumn(
    HarborTokens t,
    SportsSide side,
    List<MatchPlayer> roster,
    String formation, {
    required bool isHome,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Expanded(
              child: Text(
                side.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (formation.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: t.elevated,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
                ),
                child: Text(
                  formation,
                  style: TextStyle(
                    color: t.inkMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
          ],
        ),
      ),
      _TeamPitch(
        roster: roster,
        formation: formation,
        teamAbbr: side.abbr.isNotEmpty ? side.abbr : (isHome ? 'HOME' : 'AWAY'),
        isHome: isHome,
        tokens: t,
      ),
    ],
  );

  Widget _rosterList(HarborTokens t, String title, List<MatchPlayer> roster) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '${title.toUpperCase()} - FULL ROSTER',
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
              ),
            ),
            Container(
              height: 1,
              color: t.edgeSoft.withValues(alpha: 0.5),
              margin: const EdgeInsets.only(bottom: 8),
            ),
            for (final p in roster)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(
                        p.jersey.isNotEmpty ? p.jersey : '-',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: p.starter ? t.ink : t.inkMuted,
                          fontSize: 13,
                          fontWeight: p.starter
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 32,
                      child: Text(
                        p.position.toUpperCase(),
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          color: t.accent.withValues(alpha: 0.8),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
}

class _TeamPitch extends StatelessWidget {
  const _TeamPitch({
    required this.roster,
    required this.formation,
    required this.teamAbbr,
    required this.isHome,
    required this.tokens,
  });

  final List<MatchPlayer> roster;
  final String formation;
  final String teamAbbr;
  final bool isHome;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final rows = pitchRows(roster, formation);
    return AspectRatio(
      aspectRatio: 3 / 4,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _pitch,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                    width: 2,
                  ),
                ),
              ),
            ),
            Positioned(
              left: 8,
              top: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  teamAbbr.toUpperCase(),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (final row in rows)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        for (final p in row)
                          _PitchPlayerNode(player: p, isHome: isHome),
                      ],
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

class _PitchPlayerNode extends StatelessWidget {
  const _PitchPlayerNode({required this.player, required this.isHome});

  final MatchPlayer player;
  final bool isHome;

  @override
  Widget build(BuildContext context) {
    final last = player.name.isEmpty ? '' : player.name.split(' ').last;
    return Flexible(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isHome
                  ? Colors.white.withValues(alpha: 0.9)
                  : Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: _pitch, width: 2),
            ),
            clipBehavior: Clip.antiAlias,
            child: player.image.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: player.image,
                    fit: BoxFit.cover,
                    width: 34,
                    height: 34,
                    errorWidget: (_, _, _) => _jersey(),
                  )
                : _jersey(),
          ),
          const SizedBox(height: 2),
          Container(
            constraints: const BoxConstraints(maxWidth: 66),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              last,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _jersey() => Text(
    player.jersey.isNotEmpty ? player.jersey : '-',
    style: const TextStyle(
      color: Colors.black,
      fontSize: 13,
      fontWeight: FontWeight.w700,
    ),
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

class _StatsTab extends StatelessWidget {
  const _StatsTab({required this.detail, required this.tokens});

  final SportsMatchDetail detail;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (detail.allStats.isEmpty) {
      return _centerNote(t, 'Statistics not available yet.');
    }
    final rows = [
      for (final s in detail.allStats)
        if (s.homeValue.isNotEmpty || s.awayValue.isNotEmpty) s,
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
      ),
      child: Column(children: [for (final s in rows) _statsRow(t, s)]),
    );
  }

  Widget _statsRow(HarborTokens t, MatchTeamStatRow s) {
    final h = _statNum(s.homeValue);
    final a = _statNum(s.awayValue);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.5)),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Text(
              s.homeValue.isNotEmpty ? s.homeValue : '0',
              style: TextStyle(
                color: h > a ? _green : t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              s.label,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkSubtle, fontSize: 14),
            ),
          ),
          SizedBox(
            width: 48,
            child: Text(
              s.awayValue.isNotEmpty ? s.awayValue : '0',
              textAlign: TextAlign.end,
              style: TextStyle(
                color: a > h ? _green : t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── MMA profile ──────────────────────────────────────────────────────────────

class _MmaProfileTab extends StatelessWidget {
  const _MmaProfileTab({required this.detail, required this.tokens});

  final SportsMatchDetail detail;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final h = detail.homeProfile;
    final a = detail.awayProfile;
    if (h == null || a == null) {
      return _centerNote(t, 'Profile details not available.');
    }
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: _fighter(t, detail.game.home.name, h.fullImage)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'VS',
                  style: TextStyle(
                    color: t.inkMuted.withValues(alpha: 0.3),
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Expanded(child: _fighter(t, detail.game.away.name, a.fullImage)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: t.edgeSoft.withValues(alpha: 0.5)),
          ),
          child: Column(
            children: [
              _StatRow(
                label: 'Height',
                hVal: h.height,
                aVal: a.height,
                tokens: t,
              ),
              _StatRow(
                label: 'Weight',
                hVal: h.weight,
                aVal: a.weight,
                tokens: t,
              ),
              _StatRow(label: 'Age', hVal: h.age, aVal: a.age, tokens: t),
              _StatRow(label: 'Reach', hVal: h.reach, aVal: a.reach, tokens: t),
              _StatRow(
                label: 'Stance',
                hVal: h.stance,
                aVal: a.stance,
                tokens: t,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _fighter(HarborTokens t, String name, String image) => Column(
    children: [
      SizedBox(
        height: 240,
        child: image.isNotEmpty
            ? CachedNetworkImage(imageUrl: image, fit: BoxFit.contain)
            : const SizedBox.shrink(),
      ),
      const SizedBox(height: 8),
      Text(
        name,
        textAlign: TextAlign.center,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: t.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.label,
    required this.hVal,
    required this.aVal,
    required this.tokens,
  });

  final String label;
  final String hVal;
  final String aVal;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final h = _statNum(hVal);
    final a = _statNum(aVal);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            child: Text(
              hVal.isNotEmpty ? hVal : '-',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: h > a ? t.ink : t.inkSubtle,
                fontSize: 14,
                fontWeight: h > a ? FontWeight.w700 : FontWeight.w500,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            child: Text(
              label.toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.inkSubtle,
                fontSize: 12,
                letterSpacing: 0.8,
              ),
            ),
          ),
          SizedBox(
            width: 64,
            child: Text(
              aVal.isNotEmpty ? aVal : '-',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: a > h ? t.ink : t.inkSubtle,
                fontSize: 14,
                fontWeight: a > h ? FontWeight.w700 : FontWeight.w500,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Widget _centerNote(HarborTokens t, String text) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 24),
  child: Center(
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(color: t.inkSubtle, fontSize: 14),
    ),
  ),
);

/// A pinging live dot — a static core under an expanding, fading ring, mirroring
/// the header's `animate-ping`.
class _LiveDot extends StatefulWidget {
  const _LiveDot({required this.color});

  final Color color;

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 8,
    height: 8,
    child: Stack(
      alignment: Alignment.center,
      children: [
        AnimatedBuilder(
          animation: _c,
          builder: (context, child) => Transform.scale(
            scale: 1 + _c.value,
            child: Opacity(
              opacity: 0.75 * (1 - _c.value),
              child: Container(
                decoration: BoxDecoration(
                  color: widget.color,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ),
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: widget.color,
            shape: BoxShape.circle,
          ),
        ),
      ],
    ),
  );
}
