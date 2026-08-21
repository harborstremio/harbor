import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/simkl_providers.dart';
import '../../app/theme_controller.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/calendar/calendar.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

/// The calendar data source. The custom source lands with its aggregation.
enum CalendarSource { all, library, trakt, simkl, anticipated, premieres }

/// The Calendar view — the TMDB release calendar as a month grid. Ported from
/// the web `views/calendar.tsx` `all` source (`10-pages.md`): month navigation,
/// All/Movies/TV/Anime filter chips, a 6×7 day grid with up to three releases
/// per day and an overflow "day" menu, all remote-operable.
class CalendarView extends ConsumerStatefulWidget {
  const CalendarView({super.key});

  @override
  ConsumerState<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends ConsumerState<CalendarView> {
  late int _year;
  late int _month; // 1-12
  CalendarFilter _filter = CalendarFilter.all;
  CalendarSource _source = CalendarSource.all;

  /// The active translator; `build` watches it so a language change repaints.
  Translations get _tr => ref.read(translationsProvider);

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _year = now.year;
    _month = now.month;
  }

  void _step(int delta) {
    setState(() {
      final m = _month + delta;
      if (m < 1) {
        _month = 12;
        _year -= 1;
      } else if (m > 12) {
        _month = 1;
        _year += 1;
      } else {
        _month = m;
      }
    });
  }

  void _today() {
    final now = DateTime.now();
    setState(() {
      _year = now.year;
      _month = now.month;
    });
  }

  void _openItem(CalendarItem item) {
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.meta, {
            'type': item.type == 'tv' ? 'series' : 'movie',
            'id': calendarBaseId(item.id),
          }),
        );
  }

  Future<void> _openDay(HarborTokens t, List<CalendarItem> items) async {
    final chosen = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: [
        for (final it in items)
          ContextMenuAction(
            value: it.id,
            label: it.name,
            icon: it.isAnime
                ? Icons.auto_awesome
                : (it.type == 'tv'
                      ? Icons.live_tv_outlined
                      : Icons.movie_outlined),
          ),
      ],
    );
    if (chosen == null) return;
    final item = items.firstWhere((i) => i.id == chosen);
    _openItem(item);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    ref.watch(translationsProvider); // repaint on a language change
    final weekStartsMonday = ref
        .watch(settingsProvider)
        .getBool('weekStartsMonday');
    final traktConnected = ref.watch(traktConnectedProvider);
    final simklConnected = ref.watch(simklConnectedProvider);
    // Guard against a stale selection after a disconnect.
    if (_source == CalendarSource.trakt && !traktConnected) {
      _source = CalendarSource.all;
    }
    if (_source == CalendarSource.simkl && !simklConnected) {
      _source = CalendarSource.all;
    }
    final async = switch (_source) {
      CalendarSource.library => ref.watch(
        libraryCalendarProvider((year: _year, month: _month)),
      ),
      CalendarSource.trakt => ref.watch(
        traktCalendarProvider((year: _year, month: _month)),
      ),
      CalendarSource.simkl => ref.watch(
        simklCalendarProvider((year: _year, month: _month)),
      ),
      CalendarSource.anticipated => ref.watch(
        anticipatedCalendarProvider((year: _year, month: _month)),
      ),
      CalendarSource.premieres => ref.watch(
        simklPremieresCalendarProvider((year: _year, month: _month)),
      ),
      CalendarSource.all => ref.watch(
        calendarMonthProvider((year: _year, month: _month)),
      ),
    };
    final items = async.asData?.value ?? const <CalendarItem>[];
    final filtered = applyCalendarFilter(items, _filter);
    final grouped = groupByDate(filtered);
    final cells = buildMonthCells(
      _year,
      _month,
      weekStartsMonday: weekStartsMonday,
    );
    final todayIso = calendarIso(DateTime.now());
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);

    return Container(
      color: t.canvas,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _header(
              t,
              items,
              traktConnected,
              simklConnected,
              weekStartsMonday,
              idiom,
            ),
            Expanded(
              child: async.when(
                loading: () => const Center(
                  child: SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                ),
                error: (_, _) =>
                    _message(t, _tr.t('The calendar could not be loaded.')),
                data: (data) {
                  if (data.isEmpty &&
                      _source == CalendarSource.all &&
                      ref.watch(settingsProvider).tmdbKey.isEmpty) {
                    return _message(
                      t,
                      _tr.t('Add a TMDB key in Settings to see the calendar.'),
                    );
                  }
                  if (filtered.isEmpty) {
                    return _message(
                      t,
                      _tr.t(switch (_source) {
                        CalendarSource.library =>
                          'Nothing in your library releases this month.',
                        CalendarSource.trakt =>
                          'No upcoming releases from Trakt this month.',
                        CalendarSource.simkl =>
                          'Nothing in your Simkl lists releases this month.',
                        CalendarSource.anticipated =>
                          'No anticipated releases this month.',
                        CalendarSource.premieres => 'No premieres this month.',
                        CalendarSource.all => 'No releases this month.',
                      }),
                    );
                  }
                  return Padding(
                    padding: EdgeInsets.fromLTRB(
                      g,
                      8,
                      g,
                      24 + overscanInset(idiom).bottom,
                    ),
                    child: SingleChildScrollView(
                      child: _grid(
                        t,
                        cells,
                        grouped,
                        todayIso,
                        weekStartsMonday,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(
    HarborTokens t,
    List<CalendarItem> items,
    bool traktConnected,
    bool simklConnected,
    bool weekStartsMonday,
    Idiom idiom,
  ) {
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    final title = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _tr.t('RELEASES'),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 3,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _tr.tOr('nav.calendar', 'Calendar'),
          style: TextStyle(
            color: t.ink,
            fontSize: phone ? 28 : 34,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
    // The month-nav controls: chevrons, Today, and the month/year pill. On a
    // phone the pill drops its 160px floor so the cluster fits.
    final monthNav = [
      _roundButton(t, Icons.chevron_left, _tr.t('Previous month'), () {
        _step(-1);
      }),
      _pillButton(t, _tr.t('Today'), _today),
      Container(
        height: 40,
        constraints: phone
            ? const BoxConstraints()
            : const BoxConstraints(minWidth: 160),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Text(
          '${_tr.t(calendarMonthNames[_month - 1])} $_year',
          style: TextStyle(
            color: t.ink,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      _roundButton(t, Icons.chevron_right, _tr.t('Next month'), () {
        _step(1);
      }),
    ];

    return Padding(
      padding: EdgeInsets.fromLTRB(g, 28, g, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Wide keeps the title and the month nav on one line; phone stacks the
          // nav BELOW the title but still as one compact horizontal cluster
          // (`‹ Today  July 2026  ›`). A Row gives the pills unbounded width so
          // they hug their content (a Wrap gave them bounded-loose width, which
          // made the alignment-centered pills expand to full width, one per
          // line); the horizontal scroll keeps it overflow-proof on any width.
          if (phone) ...[
            title,
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final (i, w) in monthNav.indexed) ...[
                    if (i > 0) const SizedBox(width: 8),
                    w,
                  ],
                ],
              ),
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(child: title),
                for (final (i, w) in monthNav.indexed) ...[
                  if (i > 0) const SizedBox(width: 8),
                  w,
                ],
              ],
            ),
          const SizedBox(height: 16),
          // Source + filter chip rows wrap so the growing chip set (Trakt/Simkl
          // when connected, the week toggle) never overflows on a phone.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _sourceChip(t, CalendarSource.all, _tr.t('All')),
              _sourceChip(t, CalendarSource.library, _tr.t('Library')),
              if (traktConnected) _sourceChip(t, CalendarSource.trakt, 'Trakt'),
              if (simklConnected) _sourceChip(t, CalendarSource.simkl, 'Simkl'),
              _sourceChip(t, CalendarSource.anticipated, _tr.t('Anticipated')),
              _sourceChip(t, CalendarSource.premieres, _tr.t('Premieres')),
              _toggleChip(
                t,
                _tr.t('Start week on Monday'),
                weekStartsMonday,
                () => ref
                    .read(settingsProvider.notifier)
                    .setValue('weekStartsMonday', !weekStartsMonday),
              ),
            ],
          ),
          if (_source == CalendarSource.all ||
              _source == CalendarSource.premieres) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final f in CalendarFilter.values) _filterChip(t, f, items),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _sourceChip(HarborTokens t, CalendarSource s, String label) {
    final active = _source == s;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      // Land the remote on the active source chip so the calendar opens with a
      // visible focus target on a TV.
      autofocus: active,
      onPressed: () => setState(() => _source = s),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.ink : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? t.ink : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? t.canvas : t.inkMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _toggleChip(
    HarborTokens t,
    String label,
    bool active,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: active ? t.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: active ? t.ink : t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? t.canvas : t.inkMuted,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );

  static const _filterLabels = {
    CalendarFilter.all: 'All',
    CalendarFilter.movie: 'Movies',
    CalendarFilter.tv: 'TV',
    CalendarFilter.anime: 'Anime',
  };

  Widget _filterChip(
    HarborTokens t,
    CalendarFilter f,
    List<CalendarItem> items,
  ) {
    final active = _filter == f;
    final count = f == CalendarFilter.all
        ? items.length
        : applyCalendarFilter(items, f).length;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: () => setState(() => _filter = f),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? t.ink : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? t.ink : t.edgeSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _tr.t(_filterLabels[f]!),
              style: TextStyle(
                color: active ? t.canvas : t.inkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$count',
              style: TextStyle(
                color: active ? t.canvas.withValues(alpha: 0.65) : t.inkSubtle,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _grid(
    HarborTokens t,
    List<CalendarCell> cells,
    Map<String, List<CalendarItem>> grouped,
    String todayIso,
    bool weekStartsMonday,
  ) {
    final weekdays = orderedWeekdayNames(weekStartsMonday);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (final d in weekdays)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 6,
                  ),
                  child: Text(
                    _tr.t(d).toUpperCase(),
                    style: TextStyle(
                      color: t.inkSubtle,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.6,
                    ),
                  ),
                ),
              ),
          ],
        ),
        for (var row = 0; row < 6; row++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var col = 0; col < 7; col++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: _cell(t, cells[row * 7 + col], grouped, todayIso),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _cell(
    HarborTokens t,
    CalendarCell cell,
    Map<String, List<CalendarItem>> grouped,
    String todayIso,
  ) {
    final events = grouped[cell.iso] ?? const <CalendarItem>[];
    final isToday = cell.iso == todayIso;
    return Container(
      constraints: const BoxConstraints(minHeight: 116),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: cell.inMonth
            ? (isToday
                  ? t.elevated.withValues(alpha: 0.4)
                  : t.elevated.withValues(alpha: 0.15))
            : t.canvas.withValues(alpha: 0.3),
        border: Border.all(
          color: isToday && cell.inMonth
              ? t.ink.withValues(alpha: 0.6)
              : t.edgeSoft.withValues(alpha: cell.inMonth ? 1 : 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                '${cell.date.day}',
                style: TextStyle(
                  color: isToday
                      ? t.ink
                      : (cell.inMonth ? t.inkMuted : t.inkSubtle),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (events.isNotEmpty)
                Text(
                  '${events.length}',
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          for (final item in events.take(3)) ...[
            _chip(t, item),
            const SizedBox(height: 4),
          ],
          if (events.length > 3)
            Focusable(
              tokens: t,
              scale: 1.0,
              borderRadius: 6,
              onPressed: () => _openDay(t, events),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 2),
                child: Text(
                  '+${events.length - 3} more',
                  style: TextStyle(color: t.inkSubtle, fontSize: 11),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip(HarborTokens t, CalendarItem item) {
    final accent = item.isAnime
        ? t.accent
        : (item.type == 'tv' ? t.success : t.inkMuted);
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 6,
      onPressed: () => _openItem(item),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: t.canvas.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(6),
          border: Border(left: BorderSide(color: accent, width: 2.5)),
        ),
        child: Text(
          item.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: t.ink,
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _roundButton(
    HarborTokens t,
    IconData icon,
    String semantic,
    VoidCallback onTap,
  ) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: t.edgeSoft),
      ),
      child: Icon(icon, color: t.inkMuted, size: 18, semanticLabel: semantic),
    ),
  );

  Widget _pillButton(HarborTokens t, String label, VoidCallback onTap) =>
      Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 999,
        onPressed: onTap,
        child: Container(
          height: 40,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );

  Widget _message(HarborTokens t, String text) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(color: t.inkMuted, fontSize: 15),
      ),
    ),
  );
}
