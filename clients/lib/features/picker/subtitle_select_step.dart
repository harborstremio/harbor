import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/flag.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/subtitles/models.dart';
import '../../domain/subtitles/subtitle_choices.dart';
import '../../domain/subtitles/subtitle_search.dart';

/// The viewer's pre-play subtitle choice: turn subtitles off, or a specific
/// track (url/lang/title). Ports web `subtitlePreselect`.
class SubtitlePreselect {
  const SubtitlePreselect({required this.off, this.url, this.lang, this.title});

  const SubtitlePreselect.off()
    : off = true,
      url = null,
      lang = null,
      title = null;

  final bool off;
  final String? url;
  final String? lang;
  final String? title;
}

/// The outcome of the subtitle step: play with this [preselect] (null =
/// "let Harbor choose"). A null *result* (not this) means the viewer backed out.
class SubtitleStepResult {
  const SubtitleStepResult({this.preselect});
  final SubtitlePreselect? preselect;
}

/// Shows the full-screen "Choose subtitles" step (web `SubtitleSelectStep`) and
/// resolves to the play outcome, or null if the viewer backed out (don't play).
Future<SubtitleStepResult?> showSubtitleSelectStep(
  BuildContext context, {
  required SubSearchQuery query,
  required String metaName,
  String? contextLine,
  bool isAnime = false,
}) => Navigator.of(context, rootNavigator: true).push<SubtitleStepResult>(
  PageRouteBuilder(
    opaque: true,
    barrierColor: Colors.black,
    pageBuilder: (_, _, _) => SubtitleSelectStep(
      query: query,
      metaName: metaName,
      contextLine: contextLine,
      isAnime: isAnime,
    ),
  ),
);

class SubtitleSelectStep extends ConsumerStatefulWidget {
  const SubtitleSelectStep({
    super.key,
    required this.query,
    required this.metaName,
    this.contextLine,
    this.isAnime = false,
  });

  final SubSearchQuery query;
  final String metaName;
  final String? contextLine;
  final bool isAnime;

  @override
  ConsumerState<SubtitleSelectStep> createState() => _SubtitleSelectStepState();
}

class _SubtitleSelectStepState extends ConsumerState<SubtitleSelectStep> {
  bool _loading = true;
  List<SubResult> _results = const [];
  SubtitleChoices _choices = SubtitleChoices.empty;
  String _activeLang = 'all';
  // The selected id, or 'off', or null before init.
  String? _selected;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = ref.read(settingsProvider);
    final subProv = settings.getMap('subProvidersEnabled');
    final prefLangs = settings.getStringList('preferredSubLangs');
    List<SubResult> results = const [];
    try {
      results = await ref
          .read(subtitleSearcherProvider)
          .search(
            widget.query,
            providers: SubProviders(
              opensubtitles: subProv['opensubtitles'] != false,
              addons: subProv['addons'] != false,
              wyzie: subProv['wyzie'] == true,
            ),
            addons: ref.read(activeAddonsProvider),
            preferredLangs: prefLangs.isEmpty ? const ['English'] : prefLangs,
          );
    } catch (_) {
      results = const [];
    }
    if (!mounted) return;
    final choices = groupSubtitleChoices(results);
    setState(() {
      _loading = false;
      _results = results;
      _choices = choices;
      _selected = choices.bestId ?? 'off';
      if (choices.bestId != null) {
        _activeLang = choices.groups
            .firstWhere(
              (g) => g.items.any((it) => it.id == choices.bestId),
              orElse: () => choices.groups.first,
            )
            .langKey;
      }
    });
  }

  void _start() {
    if (_loading) return;
    if (_selected == 'off') {
      Navigator.of(
        context,
      ).pop(const SubtitleStepResult(preselect: SubtitlePreselect.off()));
      return;
    }
    SubResult? r;
    for (final x in _results) {
      if (x.id == _selected) {
        r = x;
        break;
      }
    }
    Navigator.of(context).pop(
      SubtitleStepResult(
        preselect: r == null
            ? null
            : SubtitlePreselect(
                off: false,
                url: r.url,
                lang: r.lang,
                title: r.title ?? r.langName ?? r.lang,
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final total = _results.length;
    final visible = _activeLang == 'all'
        ? _results
        : _choices.groups
              .firstWhere(
                (g) => g.langKey == _activeLang,
                orElse: () => const SubtitleLangGroup(
                  langKey: '',
                  langDisplay: '',
                  items: [],
                ),
              )
              .items;

    return Scaffold(
      backgroundColor: t.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Focusable(
                    tokens: t,
                    borderRadius: 999,
                    onPressed: () => Navigator.of(context).maybePop(),
                    child: Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: t.elevated.withValues(alpha: 0.7),
                        shape: BoxShape.circle,
                        border: Border.all(color: t.edgeSoft),
                      ),
                      child: Icon(
                        Icons.arrow_back,
                        size: 20,
                        color: t.inkMuted,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.closed_caption,
                              size: 22,
                              color: t.accent,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Choose subtitles',
                              style: TextStyle(
                                color: t.ink,
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        if ((widget.contextLine ?? widget.metaName).isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              widget.contextLine ?? widget.metaName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: t.inkMuted, fontSize: 14),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: _loading
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(strokeWidth: 2),
                            const SizedBox(height: 14),
                            Text(
                              'Finding subtitles…',
                              style: TextStyle(color: t.inkMuted, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : Container(
                        decoration: BoxDecoration(
                          color: t.elevated.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: t.edgeSoft),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Row(
                          children: [
                            SizedBox(width: 190, child: _sidebar(t, total)),
                            Container(width: 1, color: t.edgeSoft),
                            Expanded(child: _trackList(t, visible)),
                          ],
                        ),
                      ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Focusable(
                    tokens: t,
                    borderRadius: 999,
                    onPressed: () =>
                        Navigator.of(context).pop(const SubtitleStepResult()),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
                      child: Text(
                        'Skip, let Harbor choose',
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  Focusable(
                    tokens: t,
                    autofocus: true,
                    borderRadius: 999,
                    onPressed: _start,
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 30),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: t.accent,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.play_arrow_rounded,
                            size: 22,
                            color: t.canvas,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Start playback',
                            style: TextStyle(
                              color: t.canvas,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sidebar(HarborTokens t, int total) => ListView(
    padding: const EdgeInsets.all(10),
    children: [
      _sidebarItem(
        t,
        active: _activeLang == 'all',
        label: 'All languages',
        count: total,
        icon: Icon(Icons.language, size: 16, color: t.inkMuted),
        onTap: () => setState(() => _activeLang = 'all'),
      ),
      for (final g in _choices.groups)
        _sidebarItem(
          t,
          active: _activeLang == g.langKey,
          label: g.langDisplay,
          count: g.items.length,
          icon: Flag(
            language: g.langDisplay,
            tokens: t,
            size: FlagSize.sm,
            showLabel: false,
          ),
          onTap: () => setState(() => _activeLang = g.langKey),
        ),
    ],
  );

  Widget _sidebarItem(
    HarborTokens t, {
    required bool active,
    required String label,
    required int count,
    required Widget icon,
    required VoidCallback onTap,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: active ? t.elevated : null,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? t.edge : Colors.transparent),
        ),
        child: Row(
          children: [
            icon,
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? t.ink : t.inkMuted,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Text(
              '$count',
              style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _trackList(HarborTokens t, List<SubResult> visible) => ListView(
    padding: const EdgeInsets.all(10),
    children: [
      _row(
        t,
        selected: _selected == 'off',
        onTap: () => setState(() => _selected = 'off'),
        leading: Icon(Icons.closed_caption_off, size: 19, color: t.inkSubtle),
        title: 'No subtitles',
      ),
      if (!_loading && _results.isEmpty)
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'No subtitles found. Start anyway — Harbor keeps looking while you '
            'watch.',
            style: TextStyle(color: t.inkMuted, fontSize: 14),
          ),
        ),
      for (final r in visible)
        _row(
          t,
          selected: _selected == r.id,
          isBest: r.id == _choices.bestId,
          onTap: () => setState(() => _selected = r.id),
          leading: Flag(
            language: r.langName ?? r.lang,
            tokens: t,
            size: FlagSize.md,
            showLabel: false,
          ),
          title: r.title ?? r.langName ?? r.lang,
          subtitle: [
            r.source.label,
            if (r.format != null) r.format!.toUpperCase(),
            if (r.hearingImpaired) 'HI/SDH',
            if (r.forced) 'Forced',
          ].join(' · '),
        ),
    ],
  );

  Widget _row(
    HarborTokens t, {
    required bool selected,
    required VoidCallback onTap,
    required Widget leading,
    required String title,
    String? subtitle,
    bool isBest = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Focusable(
      tokens: t,
      borderRadius: 16,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: selected ? t.accentSoft : null,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? t.accent.withValues(alpha: 0.5) : t.edgeSoft,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: selected ? t.accent : t.raised,
                shape: BoxShape.circle,
              ),
              child: selected
                  ? Icon(Icons.check, size: 14, color: t.canvas)
                  : null,
            ),
            const SizedBox(width: 12),
            leading,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: t.ink, fontSize: 14.5),
                        ),
                      ),
                      if (isBest) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: t.accentSoft,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'BEST MATCH',
                            style: TextStyle(
                              color: t.accent,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (subtitle != null && subtitle.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: t.inkSubtle, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
