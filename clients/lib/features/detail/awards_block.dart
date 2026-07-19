import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/awards_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../design/awards/award_icons.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/awards/wikidata_awards.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

const Map<AwardType, int> _typeOrder = {
  AwardType.oscar: 0,
  AwardType.emmy: 1,
  AwardType.bafta: 2,
  AwardType.goldenGlobe: 3,
  AwardType.sag: 4,
  AwardType.criticsChoice: 5,
  AwardType.cannes: 6,
  AwardType.venice: 7,
  AwardType.berlin: 8,
  AwardType.other: 9,
};

const Map<AwardType, String> _typeTitle = {
  AwardType.oscar: 'Academy Awards',
  AwardType.emmy: 'Primetime Emmys',
  AwardType.bafta: 'BAFTA Awards',
  AwardType.goldenGlobe: 'Golden Globes',
  AwardType.sag: 'Screen Actors Guild Awards',
  AwardType.criticsChoice: "Critics' Choice Awards",
  AwardType.cannes: 'Cannes Film Festival',
  AwardType.venice: 'Venice Film Festival',
  AwardType.berlin: 'Berlin Film Festival',
  AwardType.other: 'Other Awards',
};

/// The detail "Awards & Recognition" section, ported from `awards-block.tsx`:
/// the title's Wikidata awards grouped by body, each with a laurel + logo, a
/// win/nomination tally, a year span, and per-category rows whose recipients
/// link to their person page. Renders nothing until awards resolve or when
/// there are none.
class AwardsBlock extends ConsumerWidget {
  const AwardsBlock({
    super.key,
    required this.imdbId,
    required this.tokens,
    this.title,
    this.year,
  });

  final String imdbId;
  final HarborTokens tokens;

  /// The title/year, used to fold in the bundled award wins Wikidata may miss.
  final String? title;
  final int? year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tr = ref.watch(translationsProvider);
    final live = ref.watch(awardsProvider(imdbId)).value ?? const [];
    final history = ref.watch(awardsHistoryProvider).value;
    final awards = history != null
        ? history.mergeBundledAwards(live, title, year: year)
        : live;
    final groups = <AwardType, List<AwardEntry>>{};
    for (final a in awards) {
      if (a.type == AwardType.other) continue;
      (groups[a.type] ??= []).add(a);
    }
    if (groups.isEmpty) return const SizedBox.shrink();
    final sorted = groups.entries.toList()
      ..sort((a, b) => _typeOrder[a.key]!.compareTo(_typeOrder[b.key]!));

    final t = tokens;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: pageGutter(Idiom.of(context))),
      child: Container(
        padding: const EdgeInsets.only(top: 40),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: t.edgeSoft)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr.t('Awards & Recognition'),
              style: TextStyle(
                color: t.ink,
                fontSize: 24,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 32),
            for (final entry in sorted) ...[
              _AwardGroup(
                type: entry.key,
                entries: entry.value,
                tokens: t,
                tr: tr,
                onOpenAward: (type) => ref
                    .read(navControllerProvider.notifier)
                    .push(Frame(FrameKind.award, {'type': type.id})),
              ),
              if (entry.key != sorted.last.key) const SizedBox(height: 40),
            ],
          ],
        ),
      ),
    );
  }
}

class _AwardGroup extends StatelessWidget {
  const _AwardGroup({
    required this.type,
    required this.entries,
    required this.tokens,
    required this.tr,
    required this.onOpenAward,
  });

  final AwardType type;
  final List<AwardEntry> entries;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(AwardType type) onOpenAward;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final wins =
        entries
            .where((e) => e.result == AwardResult.won && e.category != null)
            .toList()
          ..sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
    final noms =
        entries
            .where(
              (e) => e.result == AwardResult.nominated && e.category != null,
            )
            .toList()
          ..sort((a, b) => (b.year ?? 0).compareTo(a.year ?? 0));
    final totalWins = entries.where((e) => e.result == AwardResult.won).length;
    final totalNoms = entries
        .where((e) => e.result == AwardResult.nominated)
        .length;
    final tint = laurelColorFor(type);
    final hasDetail = wins.isNotEmpty || noms.isNotEmpty;
    final years = entries.map((e) => e.year).whereType<int>().toSet().toList()
      ..sort();

    return LayoutBuilder(
      builder: (context, c) {
        final wide = c.maxWidth >= 900;
        final header = _header(t, tint, totalWins, totalNoms, years);
        final body = _body(t, wins, noms, hasDetail);
        if (wide) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 240, child: header),
              const SizedBox(width: 56),
              Expanded(child: body),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [header, const SizedBox(height: 20), body],
        );
      },
    );
  }

  Widget _header(
    HarborTokens t,
    Color tint,
    int totalWins,
    int totalNoms,
    List<int> years,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      totalWins > 0
          ? Laurel(
              size: 88,
              color: tint,
              child: AwardLogo(type: type, size: 32),
            )
          : SizedBox(
              height: 80,
              width: 80,
              child: Center(
                child: Opacity(
                  opacity: 0.8,
                  child: AwardLogo(type: type, size: 40),
                ),
              ),
            ),
      const SizedBox(height: 20),
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 6,
        onPressed: () => onOpenAward(type),
        child: Text(
          tr.t(_typeTitle[type] ?? 'Awards'),
          style: TextStyle(
            color: t.ink,
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      const SizedBox(height: 6),
      _tallyLine(t, totalWins, totalNoms),
      if (years.isNotEmpty) ...[
        const SizedBox(height: 5),
        Text(
          _yearSpan(years),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    ],
  );

  Widget _tallyLine(HarborTokens t, int wins, int noms) {
    final spans = <InlineSpan>[];
    final base = TextStyle(
      color: t.inkSubtle,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      letterSpacing: 1.9,
    );
    if (wins > 0) {
      spans.add(
        TextSpan(
          text: '$wins',
          style: base.copyWith(color: t.accent),
        ),
      );
      spans.add(
        TextSpan(text: ' ${tr.t(wins == 1 ? 'WIN' : 'WINS')}', style: base),
      );
    }
    if (wins > 0 && noms > 0) {
      spans.add(
        TextSpan(
          text: '   ·   ',
          style: base.copyWith(color: t.inkSubtle.withValues(alpha: 0.4)),
        ),
      );
    }
    if (noms > 0) {
      spans.add(
        TextSpan(
          text: tr.t(noms == 1 ? '{n} NOMINATION' : '{n} NOMINATIONS', {
            'n': noms,
          }),
          style: base,
        ),
      );
    }
    return Text.rich(TextSpan(children: spans));
  }

  Widget _body(
    HarborTokens t,
    List<AwardEntry> wins,
    List<AwardEntry> noms,
    bool hasDetail,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (wins.isNotEmpty)
        for (final e in wins) _EntryRow(entry: e, won: true, tokens: t),
      if (noms.isNotEmpty) ...[
        if (wins.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(
            tr.t('ALSO NOMINATED'),
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 2.1,
            ),
          ),
          const SizedBox(height: 4),
        ],
        for (final e in noms) _EntryRow(entry: e, won: false, tokens: t),
      ],
      if (!hasDetail)
        Text(
          tr.t('Recognized at the {award}.', {
            'award': tr.t(_typeTitle[type] ?? 'Awards'),
          }),
          style: TextStyle(color: t.inkSubtle, fontSize: 13, height: 1.4),
        ),
    ],
  );

  static String _yearSpan(List<int> years) {
    if (years.isEmpty) return '';
    if (years.length == 1) return '${years.first}';
    final first = years.first, last = years.last;
    return first == last ? '$first' : '$first–$last';
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({
    required this.entry,
    required this.won,
    required this.tokens,
  });

  final AwardEntry entry;
  final bool won;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final recipients =
        entry.recipients ?? (entry.recipient != null ? [entry.recipient!] : []);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.3)),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 44,
            child: Text(
              entry.year != null ? '${entry.year}' : '–',
              style: TextStyle(
                color: won ? t.accent : t.inkSubtle,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.category ?? '',
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    height: 1.2,
                  ),
                ),
                if (recipients.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Wrap(
                    children: [
                      for (var i = 0; i < recipients.length; i++) ...[
                        _RecipientLink(name: recipients[i], tokens: t),
                        if (i < recipients.length - 1)
                          Text(
                            ', ',
                            style: TextStyle(color: t.inkSubtle, fontSize: 12),
                          ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// An award recipient's name that resolves to their TMDB person page on tap
/// (when a TMDB key is set and the person is found). Ported from the web
/// `PersonLink`.
class _RecipientLink extends ConsumerWidget {
  const _RecipientLink({required this.name, required this.tokens});

  final String name;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final hasKey = ref.watch(tmdbClientProvider).hasKey;
    final label = Text(
      name,
      style: TextStyle(color: t.inkSubtle, fontSize: 12),
    );
    if (!hasKey) return label;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 4,
      onPressed: () async {
        final id = await ref.read(tmdbClientProvider).personIdByName(name);
        if (id == null) return;
        ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.person, {'id': id}));
      },
      child: label,
    );
  }
}
