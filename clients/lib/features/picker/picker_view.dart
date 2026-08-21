import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/download_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/saved_filter_providers.dart';
import '../../app/theme_controller.dart';
import '../../core/abort_signal.dart';
import '../../design/addons/addon_logo.dart';
import '../../design/flag.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/debrid/debrid_types.dart';
import '../../domain/downloads/download_engine.dart';
import '../../domain/downloads/season_download.dart';
import '../../domain/library/playback_history.dart';
import '../../domain/nav/frame.dart';
import '../../domain/streams/addon_order.dart';
import '../../domain/streams/parsed_stream.dart';
import '../../domain/streams/remembered_source.dart';
import '../../domain/streams/parser/stream_enums.dart';
import '../../domain/streams/resolve.dart';
import '../../domain/streams/custom_filter.dart';
import '../../domain/streams/language_match.dart';
import '../../domain/streams/scoring/scored_stream.dart';
import '../../domain/streams/source_confirmation.dart';
import '../../domain/streams/stream_badges.dart';
import '../../domain/streams/stream_ids.dart';
import '../../domain/streams/stream_facets.dart';
import '../../domain/streams/trust.dart';
import '../../domain/subtitles/models.dart';
import '../player/immersive_orientation.dart';
import 'auto_connecting.dart';
import 'subtitle_select_step.dart';
import 'facet_menu_row.dart';
import 'filter_builder.dart';
import 'format_badge.dart';

/// Whether the picker resolves a stream to play it or to save it offline. In
/// [PickerIntent.download] mode every row's action enqueues a single download
/// (ported from the web play-picker's `intent` mode) instead of opening the
/// player; [PickerIntent.downloadSeason] enqueues every episode of the target
/// season from the chosen torrent's file list.
enum PickerIntent { play, download, downloadSeason }

/// The play-picker: the ranked, tiered list of streams for a title (and, for a
/// series, an episode). Reached by pushing a `picker` frame from the detail
/// view. Fully remote-navigable; supports the tiered and flat (Stremio) layouts,
/// and a cached-only / per-tier filter. Applies the stream trust filter per the
/// `streamFilterLevel` setting, with a Show-all escape.
class PickerView extends ConsumerStatefulWidget {
  const PickerView({
    super.key,
    required this.type,
    required this.id,
    this.season,
    this.episode,
    this.title,
    this.year,
    this.releaseDate,
    this.isAnime = false,
    this.intent = PickerIntent.play,
    this.poster,
    this.autoPlay = false,
  });

  final String type;
  final String id;
  final int? season;
  final int? episode;
  final String? title;

  /// Instant play: when true (the `instantPlay` setting), the picker auto-fires
  /// the best available source (cached first, then the ranked rest) through a
  /// connecting screen instead of listing the sources, falling through to the
  /// manual list once every candidate fails.
  final bool autoPlay;

  /// Play vs. download; in download mode a selection enqueues instead of playing.
  final PickerIntent intent;

  /// The title poster, carried into the download item's card (web `meta.poster`).
  final String? poster;

  /// Expected release year / date and anime flag — sourced from the opening
  /// detail context — condition the trust filter (cinema-window and size rules).
  final int? year;
  final String? releaseDate;
  final bool isAnime;

  @override
  ConsumerState<PickerView> createState() => _PickerViewState();
}

class _PickerViewState extends ConsumerState<PickerView> {
  late bool _flatLayout;

  /// Whether to hide sources that lack an audio track in a preferred language
  /// (seeded from `requirePreferredLanguage`; toggled by the header pill).
  late bool _langFilter;
  bool _cachedOnly = false;
  bool _showAll = false;

  /// Condensed layout only: the quality tier whose lead source the hero card
  /// shows. `null` follows the best pick's tier. Tapping a tier in the
  /// "Switch quality" strip re-points the hero — it does NOT filter the list
  /// (web `selectedTier` → `currentPick`).
  StreamTier? _selectedTier;

  /// Condensed layout only: whether the "All sources" drawer holding the full
  /// grouped list is expanded. `null` follows the computed default (collapsed
  /// when a best-source card leads the view, expanded otherwise); once the
  /// viewer taps the drawer it becomes an explicit override. Ports web
  /// `SourceDrawer`'s `drawerOpen` (default collapsed).
  bool? _drawerOpen;

  /// The selected facet values keyed by dimension (`facetDims` key → chosen
  /// bucket); a missing key or `"all"` means that dimension is unfiltered.
  final Map<String, String> _facets = {};

  /// The applied saved custom filter's id, or null.
  String? _activeFilterId;

  /// Instant-play state: [_autoFired] once a resolve has been dispatched;
  /// [_autoCancelled] once the user backed out or every candidate failed
  /// (drop to the manual list); [_autoDone] once the player has opened (so Back
  /// from the player lands on the source list, not the connecting screen);
  /// [_immersive] tracks whether the connecting screen rotated to landscape.
  bool _autoFired = false;
  bool _autoCancelled = false;
  bool _autoDone = false;
  bool _immersive = false;

  /// Backs out of instant play to the manual source list, restoring portrait.
  void _cancelAuto() {
    if (_immersive) {
      exitImmersiveLandscape();
      _immersive = false;
    }
    if (mounted) setState(() => _autoCancelled = true);
  }

  /// Restores portrait when auto play falls through to the manual list from a
  /// build-time decision (empty/errored fetch), where [_cancelAuto]'s setState
  /// cannot run. Scheduled for the next frame.
  void _exitImmersiveIfEntered() {
    if (_immersive) {
      _immersive = false;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => exitImmersiveLandscape(),
      );
    }
  }

  /// The ordered auto-play candidates: the trust-filtered sources in ranked
  /// order, with the best cached pick ([RankedPicker.primary]) hoisted to the
  /// front. Auto-fire tries them in turn. Ports the web `useAutoCandidates`
  /// (cached-first, then the rest).
  List<ScoredStream> _autoCandidates(RankedPicker picker) {
    final opts = _trustOptions();
    final filtering = !_showAll && !opts.disabled;
    final kept = filtering
        ? applyTrust(
            picker.all.map((s) => s.parsed).toList(),
            opts,
          ).keep.toSet()
        : null;
    // Drop any source explicitly tagged for a different episode (a mislabeled
    // per-episode stream), so it can never be auto-played — the port of the web
    // useAutoCandidates `episodeConflict` guard. Season packs (episode null) and
    // movies are untouched.
    final pool =
        (kept == null
                ? picker.all
                : picker.all.where((s) => kept.contains(s.parsed)))
            .where((s) => !_episodeConflict(s))
            .toList();
    final primary =
        (picker.primary != null &&
            !_episodeConflict(picker.primary!) &&
            (kept == null || kept.contains(picker.primary!.parsed)))
        ? picker.primary
        : null;
    // Front-load the source-memory picks (the port of the web useAutoCandidates
    // pushes): "keep source for next episode" (same source profile as the last
    // episode) first, then "remember last stream" (the exact prior source) —
    // both only when instant-playable, so neither jumps an uncached source
    // ahead of the cached pick.
    final sourced = _sourceEntryMatch(pool);
    final previous = _rememberedMatch(pool);
    return [
      ?sourced,
      if (previous != null && !identical(previous, sourced)) previous,
      if (primary != null &&
          !identical(primary, sourced) &&
          !identical(primary, previous))
        primary,
      for (final s in pool)
        if (!identical(s, sourced) &&
            !identical(s, previous) &&
            !identical(s, primary))
          s,
    ];
  }

  /// The pool stream matching the last-played entry that is instant-playable,
  /// or null — gated on the `rememberLastStream` setting.
  ScoredStream? _rememberedMatch(List<ScoredStream> pool) {
    if (!ref.read(settingsProvider).getBool('rememberLastStream')) return null;
    final entry = ref
        .read(playbackHistoryStoreProvider)
        .readEntry(widget.id, season: widget.season, episode: widget.episode);
    return rememberedMatch(pool, entry);
  }

  /// Whether [s] is explicitly tagged for a different episode than the one being
  /// played — the port of the web `episodeConflict`. A pack (episode null) or a
  /// movie never conflicts.
  bool _episodeConflict(ScoredStream s) {
    final ep = widget.episode;
    final se = s.parsed.episode;
    if (ep == null || se == null) return false;
    if (se != ep) return true;
    final ss = s.parsed.season;
    return widget.season != null && ss != null && ss != widget.season;
  }

  /// The instant-playable stream sharing the source profile carried into this
  /// series episode: the per-season lock (`seasonSourceLock`, skipped for anime)
  /// takes precedence over the last-played source (`keepSourceNextEpisode`).
  /// Ports the web `seasonLockEntry ?? lastSeriesSource` → `sourceMatch`.
  ScoredStream? _sourceEntryMatch(List<ScoredStream> pool) {
    if (!widget.autoPlay || widget.type != 'series') return null;
    final s = ref.read(settingsProvider);
    PlaybackEntry? entry;
    // Skip anime by the id-prefix (kitsu:/mal:/…), matching the season-lock
    // WRITE gate + the web — not the genre-based `widget.isAnime`, which would
    // strand a lock written under an imdb id that carries an anime genre.
    if (s.getBool('seasonSourceLock') && !isAnimeMetaId(widget.id)) {
      entry = ref.read(seasonLockStoreProvider).read(widget.id, widget.season);
    }
    entry ??= s.getBool('keepSourceNextEpisode')
        ? ref
              .read(playbackHistoryStoreProvider)
              .readLastSeriesPlayback(widget.id)
        : null;
    return sourceMatch(pool, entry);
  }

  /// Resolves auto-play [candidates] in order, opening the player on the first
  /// success and advancing past a failure; when every candidate fails it falls
  /// through to the manual source list. Committed so an uncached-but-resolvable
  /// source is fetched (the instant-play intent), matching the web `onPlay`.
  Future<void> _fireCandidate(List<ScoredStream> candidates, int idx) async {
    if (idx >= candidates.length) {
      _cancelAuto();
      return;
    }
    final result = await ref.read(
      resolveStreamProvider((
        stream: candidates[idx].parsed,
        committed: true,
      )).future,
    );
    if (!mounted) return;
    if (result is ResolveOk) {
      _openPlayer(result, candidates[idx]);
      // Leave the source list under the player (Back returns to it) and keep
      // the landscape lock the player takes over.
      if (mounted) setState(() => _autoDone = true);
      return;
    }
    _fireCandidate(candidates, idx + 1);
  }

  void _setFacet(String key, String value) => setState(() {
    if (value == 'all') {
      _facets.remove(key);
    } else {
      _facets[key] = value;
    }
  });

  /// Clears every facet and the active saved filter (the row's Reset).
  void _resetFilters() => setState(() {
    _facets.clear();
    _activeFilterId = null;
  });

  /// The add-on dropdown selector for the flat layout — the CircleLogo of the
  /// chosen add-on (or "All sources"), its stream count, and a chevron. Tapping
  /// opens a remote-navigable menu of every add-on that returned a stream.
  /// Ports the web StremioLayout add-on menu; the choice is the `addon` facet.
  Widget _addonDropdown(HarborTokens t, List<ScoredStream> pool) {
    final counts = <String, int>{};
    final ids = <String, String>{};
    for (final s in pool) {
      final name = s.parsed.addonName.trim();
      if (name.isEmpty) continue;
      counts[name] = (counts[name] ?? 0) + 1;
      ids.putIfAbsent(name, () => s.parsed.addonId);
    }
    final names = counts.keys.toList()..sort();
    // A single add-on has nothing to choose between — hide the selector.
    if (names.length < 2) return const SizedBox.shrink();
    final selected = _facets['addon'];
    final label = selected ?? 'All sources';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Focusable(
        tokens: t,
        borderRadius: 16,
        onPressed: () => _openAddonMenu(t, names, counts, ids, pool.length),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: t.elevated,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              _addonCircle(t, selected == null ? null : ids[selected], label),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.expand_more, size: 20, color: t.inkMuted),
            ],
          ),
        ),
      ),
    );
  }

  Widget _addonCircle(HarborTokens t, String? addonId, String name) {
    const size = 36.0;
    if (addonId == null) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: t.elevated,
          border: Border.all(color: t.edgeSoft),
        ),
        child: Icon(Icons.grid_view_rounded, size: 16, color: t.inkMuted),
      );
    }
    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: AddonLogo(
          addonId: addonId,
          addonName: name,
          size: AddonLogoSize.lg,
        ),
      ),
    );
  }

  Future<void> _openAddonMenu(
    HarborTokens t,
    List<String> names,
    Map<String, int> counts,
    Map<String, String> ids,
    int total,
  ) async {
    const allSentinel = ' all';
    final picked = await showDialog<String>(
      context: context,
      builder: (_) => _AddonMenu(
        tokens: t,
        names: names,
        counts: counts,
        ids: ids,
        total: total,
        selected: _facets['addon'],
        allSentinel: allSentinel,
      ),
    );
    if (picked == null) return;
    _setFacet('addon', picked == allSentinel ? 'all' : picked);
  }

  /// Opens the filter builder ([initial] non-null edits), then persists the
  /// outcome: a saved filter is stored and made active; a deleted one is removed
  /// and deactivated. Ports the web `onSave`/`onDelete`.
  Future<void> _openFilterBuilder({CustomStreamFilter? initial}) async {
    final result = await showFilterBuilder(
      context,
      tokens: ref.read(tokensProvider),
      initial: initial,
    );
    if (result == null || !mounted) return;
    final ctrl = ref.read(savedStreamFiltersProvider.notifier);
    switch (result) {
      case FilterSaved(:final filter):
        await ctrl.save(filter);
        if (mounted) setState(() => _activeFilterId = filter.id);
      case FilterDeleted(:final id):
        await ctrl.remove(id);
        if (mounted && _activeFilterId == id) {
          setState(() => _activeFilterId = null);
        }
    }
  }

  /// The currently-active saved filter, or null when none is selected (or the
  /// selected one no longer exists).
  CustomStreamFilter? _activeFilter(List<CustomStreamFilter> filters) {
    if (_activeFilterId == null) return null;
    for (final f in filters) {
      if (f.id == _activeFilterId) return f;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    final settings = ref.read(settingsProvider);
    // The initial layout follows pickerLayout (default "stremio" = the flat
    // list; "condensed" = the tiered view). The header pill toggles it in-place.
    _flatLayout = settings.getString('pickerLayout') == 'stremio';
    // The language filter starts on when the viewer requires their preferred
    // language and has one set (web `requirePreferredLanguage` seed).
    _langFilter =
        settings.getBool('requirePreferredLanguage') &&
        settings.getStringList('preferredLanguages').isNotEmpty;
  }

  /// The trust filter options for this title, from the opening context plus the
  /// `streamFilterLevel` setting (strict / balanced / off).
  TrustOptions _trustOptions() {
    final level = ref.read(settingsProvider).getString('streamFilterLevel');
    return TrustOptions(
      kind: widget.type == 'series' ? 'series' : 'movie',
      expectedTitle: widget.title,
      expectedYear: widget.year,
      expectedSeason: widget.season,
      expectedEpisode: widget.episode,
      releaseDate: widget.releaseDate,
      isAnime: widget.isAnime,
      strict: level == 'strict',
      disabled: level == 'off',
    );
  }

  /// Whether [s] is the source recorded by playback [e] — matched by info-hash
  /// (torrents) or the original stream url (direct links). Ported from web
  /// `streamMatchesEntry`.

  PickerKey get _key => (
    type: widget.type,
    id: widget.id,
    season: widget.season,
    episode: widget.episode,
  );

  bool get _isDownload =>
      widget.intent == PickerIntent.download ||
      widget.intent == PickerIntent.downloadSeason;

  /// Resolves [stream] to a playable link and shows the outcome. Called on
  /// select; [committed] is set when the user opts to play an uncached source.
  Future<void> _select(
    ScoredStream stream, {
    bool committed = false,
    bool forceDownload = false,
  }) async {
    // Season bulk download: for a torrent source, enqueue every episode of the
    // target season from its file list before falling back to a single resolve.
    if (widget.intent == PickerIntent.downloadSeason &&
        stream.parsed.infoHash != null) {
      if (await _tryDownloadSeason(stream)) {
        if (mounted) {
          ref.read(navControllerProvider.notifier).setView(FrameKind.downloads);
        }
        return;
      }
      if (!mounted) return;
    }

    final t = ref.read(tokensProvider);
    final nav = Navigator.of(context);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      // Block the remote/back key while resolving — otherwise Back pops this
      // spinner and the `finally` pop below then tears down the picker itself.
      builder: (_) => PopScope(
        canPop: false,
        child: Center(child: CircularProgressIndicator(color: t.accent)),
      ),
    );
    ResolveResult result;
    try {
      result = await ref.read(
        resolveStreamProvider((
          stream: stream.parsed,
          committed: committed,
        )).future,
      );
    } finally {
      if (mounted) nav.pop();
    }
    if (!mounted) return;
    if (result is ResolveOk) {
      if (_isDownload || forceDownload) {
        _startDownload(result, stream);
      } else {
        await _playWithPreselect(result, stream);
      }
      return;
    }
    _showOutcome(stream, result);
  }

  /// Lists the torrent's files across the configured debrid services and, on
  /// the first that returns video files, enqueues every episode of the target
  /// season, then switches to the Downloads tab. Ports the `download-season`
  /// branch of the web `use-pick-handler`. Returns false (falling back to a
  /// single download) if no debrid yields a usable season.
  Future<bool> _tryDownloadSeason(ScoredStream stream) async {
    final infoHash = stream.parsed.infoHash;
    if (infoHash == null) return false;
    final debrids = ref.read(debridClientsProvider);
    if (debrids.isEmpty) return false;

    final t = ref.read(tokensProvider);
    final nav = Navigator.of(context);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      // Block the remote/back key while resolving — otherwise Back pops this
      // spinner and the `finally` pop below then tears down the picker itself.
      builder: (_) => PopScope(
        canPop: false,
        child: Center(child: CircularProgressIndicator(color: t.accent)),
      ),
    );
    try {
      for (final d in debrids) {
        final res = await d.listTorrentFiles(infoHash, AbortSignal());
        if (res is! DebridOk<List<DebridFile>>) continue;
        final requests = buildSeasonDownloadRequests(
          files: res.data,
          targetSeason: widget.season ?? 1,
          metaId: widget.id,
          title: widget.title ?? 'Download',
          poster: widget.poster,
          releaseInfo: widget.year?.toString(),
          label: _streamLabel(stream),
        );
        if (requests.isEmpty) continue;
        final engine = ref.read(downloadEngineProvider);
        for (final r in requests) {
          unawaited(engine.enqueue(r));
        }
        return true;
      }
      return false;
    } finally {
      if (mounted) nav.pop();
    }
  }

  /// Enqueues the resolved link into the download engine and switches to the
  /// Downloads tab, where the new item appears live (web `enqueueDownload` +
  /// `setView("downloads")`). The enqueue runs on the app-lifetime engine, so it
  /// continues after this frame is replaced.
  void _startDownload(ResolveOk resolved, ScoredStream stream) {
    unawaited(
      ref
          .read(downloadEngineProvider)
          .enqueue(
            DownloadRequest(
              metaId: widget.id,
              title: widget.title ?? 'Download',
              subtitle: _downloadSubtitle(),
              poster: widget.poster,
              season: widget.season,
              episode: widget.episode,
              streamLabel: _streamLabel(stream),
              url: resolved.data.url,
              headers: resolved.data.headers,
              releaseInfo: widget.year?.toString(),
            ),
          ),
    );
    ref.read(navControllerProvider.notifier).setView(FrameKind.downloads);
  }

  /// The download item's subtitle: the season/episode for a series, else the
  /// release year (web builds the same `S · E` / `releaseInfo` line).
  String? _downloadSubtitle() {
    final s = widget.season, e = widget.episode;
    if (s != null && e != null) {
      return 'S$s · E${e.toString().padLeft(2, '0')}';
    }
    return widget.year?.toString();
  }

  /// The quality/source label stored with the download (web
  /// `[resolution, source].join(" ") || parsedTitle || addonName`).
  String _streamLabel(ScoredStream stream) {
    final p = stream.parsed;
    final parts = <String>[
      p.resolution.label,
      if (p.source != StreamSource.other) p.source.label,
    ].where((e) => e.isNotEmpty).toList();
    if (parts.isNotEmpty) return parts.join(' ');
    return p.parsedTitle.isNotEmpty ? p.parsedTitle : p.addonName;
  }

  /// Opens the fullscreen player on the resolved link, pushed on top of the
  /// picker so Back from the player (via `exitPlayer`) returns to the source
  /// list rather than relaunching instant play.
  /// When the pre-play subtitle step is enabled, let the viewer choose a
  /// subtitle (or off) before the player opens; backing out returns to the
  /// source list without playing. Ports web `subtitlePreselect`.
  Future<void> _playWithPreselect(
    ResolveOk resolved,
    ScoredStream stream,
  ) async {
    if (!ref.read(settingsProvider).getBool('subtitlePreselect')) {
      _openPlayer(resolved, stream);
      return;
    }
    final id = widget.id;
    final res = await showSubtitleSelectStep(
      context,
      query: SubSearchQuery(
        imdbId: id.startsWith('tt') ? id : null,
        type: widget.type == 'series' ? 'series' : 'movie',
        title: widget.title,
        season: widget.season,
        episode: widget.episode,
      ),
      metaName: widget.title ?? '',
    );
    if (!mounted) return;
    if (res == null) return; // backed out — stay on the source list
    _openPlayer(resolved, stream, preselect: res.preselect);
  }

  void _openPlayer(
    ResolveOk resolved,
    ScoredStream stream, {
    SubtitlePreselect? preselect,
  }) {
    final p = stream.parsed;
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': resolved.data.url,
            if (preselect != null) 'subtitlePreselectOff': preselect.off,
            if (preselect?.url != null) 'subtitlePreselectUrl': preselect!.url,
            if (preselect?.lang != null)
              'subtitlePreselectLang': preselect!.lang,
            if (preselect?.title != null)
              'subtitlePreselectTitle': preselect!.title,
            'title': ?widget.title,
            'contentId': widget.id,
            'contentType': widget.type,
            'season': ?widget.season,
            'episode': ?widget.episode,
            if (resolved.data.headers != null) 'headers': resolved.data.headers,
            'notWebReady': resolved.data.notWebReady ?? false,
            // The picked source's identity (not the resolved link) so playback
            // history can mark it as last-played the next time this title's
            // sources are listed.
            'sourceInfoHash': ?p.infoHash,
            'sourceUrl': ?p.stream.url,
            'sourceAddonId': p.stream.addonId,
            // The looser "source profile" (binge-group / resolution / source) so
            // "keep source for next episode" can carry it to the next episode.
            'sourceBingeGroup': ?p.stream.bingeGroup,
            'sourceResolution': p.resolution.name,
            'sourceSourceKind': p.source.name,
            // Extra source identity for the injected-ad fingerprint (fileIdx +
            // release group/size/title feed the ih_/rg_ corpus keys) and the
            // release year for the ad window.
            'sourceFileIdx': ?p.stream.fileIdx,
            'sourceReleaseGroup': ?p.releaseGroupNormalized,
            'sourceSize': ?p.size,
            'sourceParsedTitle': p.parsedTitle,
            'releaseInfo': ?widget.year?.toString(),
          }),
        );
  }

  void _showOutcome(ScoredStream stream, ResolveResult result) {
    final t = ref.read(tokensProvider);
    final (String title, String body, bool offerCommit) = switch (result) {
      ResolveOk() => ('Source ready', '', false),
      ResolveErr(code: 'uncached-not-committed') => (
        'Not cached',
        'This source is not cached on your debrid. Play anyway to download it '
            'first?',
        true,
      ),
      ResolveErr(:final code) => (
        'Can\'t play this source',
        _errorMessage(code),
        false,
      ),
    };

    showDialog<void>(
      context: context,
      builder: (_) => _OutcomeDialog(
        tokens: t,
        title: title,
        body: body,
        offerCommit: offerCommit,
        onCommit: offerCommit
            ? () {
                Navigator.of(context).pop();
                _select(stream, committed: true);
              }
            : null,
      ),
    );
  }

  String _errorMessage(String code) => switch (code) {
    'direct-torrent-disabled' || 'no-debrid-configured' =>
      'This torrent needs a debrid service. Add a Real-Debrid, TorBox, '
          'AllDebrid, Premiumize, or Debrid-Link key in Settings to stream it.',
    'not-cached' || 'all-debrids-failed' =>
      'This source is not cached on your debrid. Try another source.',
    'stub-or-error-video' =>
      'This source looks broken (a stub or error video). Try another.',
    'web-page' => 'This source opens a web page rather than a video.',
    'external-url-only' => 'This source only plays in an external app.',
    'youtube-only' => 'This is a YouTube link.',
    'nzb-needs-external-player' => 'This source needs an external NZB player.',
    'no-source' => 'This source has no playable link.',
    'not-premium' => 'Your debrid subscription is inactive.',
    'unauthorized' => 'Your debrid key is invalid. Update it in Settings.',
    'rate-limited' => 'The debrid service is rate-limiting. Try again shortly.',
    _ => 'Could not resolve this source ($code).',
  };

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final async = ref.watch(streamPickerProvider(_key));
    final showFilename = ref
        .watch(settingsProvider)
        .getBool('pickerShowFilename');

    // Deselect a saved filter that was removed elsewhere (web `stremio-layout`
    // effect that clears a dangling activeFilterId).
    ref.listen(savedStreamFiltersProvider, (_, next) {
      if (_activeFilterId != null &&
          !next.any((f) => f.id == _activeFilterId)) {
        setState(() => _activeFilterId = null);
      }
    });

    // Instant play: from the moment Play is pressed, cover the WHOLE pre-play
    // wait (source fetch + resolve) with the rotated Harbor connecting splash —
    // no "finding sources" list first — then hand straight to the player
    // (already in landscape, so it is seamless). Back/cancel, an empty result,
    // or every candidate failing drops to the manual source list.
    if (widget.autoPlay && !_isDownload && !_autoCancelled && !_autoDone) {
      if (!_autoFired) {
        if (async.hasError) {
          // The fetch failed — show the picker's error state below.
          _autoCancelled = true;
          _exitImmersiveIfEntered();
        } else if (async.hasValue) {
          final candidates = _autoCandidates(async.requireValue);
          if (candidates.isEmpty) {
            _autoCancelled = true;
            _exitImmersiveIfEntered();
          } else {
            _autoFired = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _fireCandidate(candidates, 0);
            });
          }
        }
      }
      if (!_autoCancelled) {
        if (!_immersive) {
          _immersive = true;
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => enterImmersiveLandscape(),
          );
        }
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _cancelAuto();
          },
          child: AutoConnecting(
            tokens: t,
            title: widget.title ?? 'Playing',
            season: widget.season,
            episode: widget.episode,
            backdrop: widget.poster,
            onCancel: _cancelAuto,
          ),
        );
      }
    }

    final g = pageGutter(Idiom.of(context));
    final content = Padding(
      padding: EdgeInsets.fromLTRB(g, 28, g, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(t),
          if (_isDownload) ...[
            const SizedBox(height: 6),
            Text(
              widget.intent == PickerIntent.downloadSeason
                  ? 'Choose a source to save the whole season for offline '
                        'watching.'
                  : 'Choose a source to save it for offline watching.',
              style: TextStyle(color: t.inkMuted, fontSize: 13.5),
            ),
          ],
          const SizedBox(height: 16),
          Expanded(
            child: async.when(
              loading: () => _CinematicLoader(tokens: t),
              error: (_, _) => _message('Could not load sources.', t),
              data: (picker) => _content(picker, t, showFilename),
            ),
          ),
        ],
      ),
    );
    return _wrapWithBackdrop(content, t);
  }

  /// When "Blur stream backdrop" is on, render the title's poster as a blurred,
  /// scrimmed backdrop behind the source list (web `BlurUpBackdrop`). The scrim
  /// keeps every row readable on phone, tablet and TV.
  Widget _wrapWithBackdrop(Widget content, HarborTokens t) {
    final poster = widget.poster;
    if (!ref.watch(settingsProvider).getBool('streamBackdropBlur') ||
        poster == null ||
        poster.isEmpty) {
      return content;
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          key: const ValueKey('stream-backdrop'),
          child: ImageFiltered(
            imageFilter: ui.ImageFilter.blur(sigmaX: 40, sigmaY: 40),
            child: RpdbPosterImage(
              metaId: widget.id,
              rawPoster: poster,
              type: widget.type == 'series' ? 'series' : 'movie',
              tokens: t,
              fallback: () => ColoredBox(color: t.canvas),
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
                  t.canvas.withValues(alpha: 0.86),
                  t.canvas.withValues(alpha: 0.94),
                ],
              ),
            ),
          ),
        ),
        content,
      ],
    );
  }

  Widget _header(HarborTokens t) {
    final phone = Idiom.of(context).isPhone;
    final ep = (widget.season != null && widget.episode != null)
        ? '  ·  S${widget.season} E${widget.episode}'
        : '';
    final title = Text(
      '${widget.title ?? 'Sources'}$ep',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: t.ink,
        fontSize: phone ? 22 : 28,
        fontWeight: FontWeight.w700,
      ),
    );
    // The header carries only the title + a Refresh button, matching Harbor's
    // PickerHeader (Back + Refresh). The layout is chosen in Streaming settings
    // (`pickerLayout`) — there is no on-screen layout toggle in Harbor — and the
    // cached / language / show-all filters live in the Condensed tier strip and
    // the empty-state, not a top toolbar.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: title),
        const SizedBox(width: 12),
        _refreshButton(t),
      ],
    );
  }

  /// The header's Refresh control — re-runs the stream pipeline (web
  /// PickerHeader's Refresh button). A [Focusable] so the TV D-pad can reach it.
  Widget _refreshButton(HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: () => ref.invalidate(streamPickerProvider(_key)),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        color: t.elevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.refresh, size: 17, color: t.inkMuted),
          const SizedBox(width: 8),
          Text(
            'Refresh',
            style: TextStyle(
              color: t.inkMuted,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _content(RankedPicker picker, HarborTokens t, bool showFilename) {
    // Trust filter: hide streams that misrepresent themselves unless Show-all is
    // on or the filter is disabled. The primary pick is dropped if it too is
    // rejected. Ports the web `applyTrust` gate in the pipeline.
    final opts = _trustOptions();
    final filtering = !_showAll && !opts.disabled;
    Set<ParsedStream>? kept;
    if (filtering) {
      kept = applyTrust(
        picker.all.map((s) => s.parsed).toList(),
        opts,
      ).keep.toSet();
    }
    var pool = picker.all;
    if (kept != null) {
      pool = pool.where((s) => kept!.contains(s.parsed)).toList();
    }
    final hiddenByTrust = picker.all.length - pool.length;
    final primary =
        (picker.primary != null &&
            (kept == null || kept.contains(picker.primary!.parsed)))
        ? picker.primary
        : null;

    // How many sources are not cached — gates the Condensed "Cached only" pill
    // (web `uncachedHiddenCount`, over the full result, only when a debrid is
    // configured) and drives its "+N" count.
    final hasDebrid = ref.watch(debridClientsProvider).isNotEmpty;
    final uncachedHiddenCount = hasDebrid
        ? picker.all.where((s) => !s.cached.containsValue(true)).length
        : 0;
    if (_cachedOnly) {
      pool = pool.where((s) => s.cached.containsValue(true)).toList();
    }

    // Facet filtering: the six facet dimensions narrow [pool] further. Each
    // dimension's option counts are computed against the streams passing every
    // OTHER facet (the `except` axis), and a dimension pinned to a single option
    // by a pill/tier drops out of the row automatically. Ports the web
    // `stremio-layout` facet assembly.
    final facetEntries = <FacetRowEntry>[
      // The add-on is chosen from the dropdown selector above the row (web
      // `StremioLayout`'s add-on menu), not as a facet chip.
      for (final dim in facetDims)
        if (dim.key != 'addon')
          () {
            final base = pool
                .where((s) => matchesFacets(s, _facets, except: dim.key))
                .toList();
            return FacetRowEntry(
              dim: dim,
              options: facetOptions(base, dim),
              total: base.length,
              value: _facets[dim.key] ?? 'all',
            );
          }(),
    ];
    final hasFacetRow = facetEntries.any(
      (e) => e.options.length >= 2 || e.value != 'all',
    );
    // A saved custom filter, when active, narrows the list further and — like
    // the facets — hides the primary pick.
    final savedFilters = ref.watch(savedStreamFiltersProvider);
    final activeFilter = _activeFilter(savedFilters);
    var streams = pool.where((s) => matchesFacets(s, _facets)).toList();
    if (activeFilter != null) {
      streams = streams
          .where((s) => matchesCustomFilter(s.parsed, activeFilter))
          .toList();
    }
    // Preferred-language filter: keep only sources with an audio track in a
    // preferred language, but never hide everything (web `langFiltered.length`
    // guard). Unknown-language and Multi sources always pass.
    final prefLangs = ref
        .watch(settingsProvider)
        .getStringList('preferredLanguages');
    // How many sources lack a preferred-language track — gates the Condensed
    // "Preferred language" pill (web `langHiddenCount`, over the full result)
    // and its "+N" count.
    final langHiddenCount = prefLangs.isEmpty
        ? 0
        : picker.all
              .where((s) => !streamMatchesLangs(s.parsed, prefLangs))
              .length;
    if (_langFilter && prefLangs.isNotEmpty) {
      final langFiltered = streams
          .where((s) => streamMatchesLangs(s.parsed, prefLangs))
          .toList();
      if (langFiltered.isNotEmpty) streams = langFiltered;
    }

    // Nothing survives even before faceting, and there is no facet to relax.
    if (pool.isEmpty && !hasFacetRow) {
      // No add-on returned anything — guide the viewer to install one.
      if (picker.all.isEmpty) {
        return _message(
          'No sources found. Install a stream add-on to see results.',
          t,
          actionLabel: 'Install add-ons',
          onAction: () => ref
              .read(navControllerProvider.notifier)
              .setView(FrameKind.addons),
        );
      }
      final trustHid = hiddenByTrust > 0 && !_cachedOnly;
      // The cached-only filter can hide EVERY source (no source is cached),
      // which empties the pool before the filter-pill row is reached — so the
      // "Show all sources" off-switch would otherwise vanish here, stranding
      // the remote. Offer it inline so the filter is always reversible.
      final String? actionLabel;
      final VoidCallback? onAction;
      if (_cachedOnly) {
        actionLabel = 'Show all sources';
        onAction = () => setState(() => _cachedOnly = false);
      } else if (trustHid && !_showAll) {
        // Web's empty-ladder "Show everything anyway" action (forceShowAll).
        actionLabel = 'Show everything anyway';
        onAction = () => setState(() => _showAll = true);
      } else {
        actionLabel = null;
        onAction = null;
      }
      return _message(
        trustHid
            ? '$hiddenByTrust source${hiddenByTrust == 1 ? '' : 's'} hidden '
                  'because the label looks untrustworthy.'
            : 'No sources match the current filter.',
        t,
        actionLabel: actionLabel,
        onAction: onAction,
      );
    }

    // One lead source per quality tier, best first — the Condensed "Switch
    // quality" selector and the source of the hero card (web `byTier` /
    // `populatedTiers`, computed over the FILTERED list so the cached/language
    // pills re-derive the selector instead of emptying it).
    final byTierLocal = <StreamTier, ScoredStream>{};
    for (final s in streams) {
      byTierLocal.putIfAbsent(s.tier, () => s);
    }
    final tiers = <StreamTier>[
      for (final tier in tierOrder)
        if (byTierLocal.containsKey(tier)) tier,
    ];
    // The hero best-source card follows the selected quality tier (web
    // `currentPick`): the lead source of the chosen tier, else the overall
    // best. Selecting a tier SWAPS the hero — it never hides it or filters the
    // list. Falls back to the first ranked source when the raw primary was
    // filtered out by the cached / language pills.
    final effectiveTier = _selectedTier ?? primary?.tier;
    final currentPick =
        (effectiveTier != null ? byTierLocal[effectiveTier] : null) ??
        (streams.isNotEmpty ? streams.first : primary);
    // The Condensed layout always leads with the hero card; the Stremio (flat)
    // layout is a pure add-on-ranked list with no highlighted pick (web
    // `StremioLayout` shows no PrimaryCard).
    final showPrimary = currentPick != null && !_flatLayout;

    // The source played last time this title's sources were listed, marked with
    // a "Last played" pill and focused first (the D-pad lands on it) so the same
    // source is easy to replay. Ports the web last-played match, gated on the
    // `rememberLastStream` setting.
    final entry = ref.watch(settingsProvider).getBool('rememberLastStream')
        ? ref
              .read(playbackHistoryStoreProvider)
              .readEntry(
                widget.id,
                season: widget.season,
                episode: widget.episode,
              )
        : null;
    ScoredStream? previous;
    if (entry != null) {
      for (final s in streams) {
        if (streamMatchesEntry(s, entry)) {
          previous = s;
          break;
        }
      }
    }

    // The Condensed "All sources" drawer is collapsed by default when a
    // best-source card leads the view (the hero + tier strip are enough to act
    // on); it opens by default when there is no card to lead with, or when the
    // row the D-pad should land on (the last-played source) lives inside it —
    // otherwise that focus target would be hidden. A viewer tap overrides.
    final drawerDefault =
        !showPrimary || (previous != null && !identical(currentPick, previous));
    final drawerOpen = _drawerOpen ?? drawerDefault;

    // The Stremio (flat) list order honours the streamSort setting: "addon"
    // (the default) mirrors the add-on's native order, "harbor" keeps Harbor's
    // ranking. The Condensed layout always groups by score tier, so this only
    // reorders the flat list. Ports web `addonOrderMode` / `orderByAddonNative`.
    final flatStreams =
        ref.watch(settingsProvider).getString('streamSort') == 'addon'
        ? orderByAddonNative(streams)
        : streams;

    return CustomScrollView(
      slivers: [
        // The Condensed layout leads with a source-diagnostic line (how many
        // sources were found, how many cached, across how many add-ons); the
        // Stremio flat list omits it (web condensed tree vs StremioLayout).
        if (!_flatLayout && picker.all.isNotEmpty)
          SliverToBoxAdapter(
            child: _SourceDiagnostic(all: picker.all, tokens: t),
          ),
        if (showPrimary)
          SliverToBoxAdapter(
            child: _PrimaryCard(
              stream: currentPick,
              tokens: t,
              metaId: widget.id,
              contentType: widget.type,
              posterUrl: widget.poster,
              metaYear: widget.year,
              // Focus the primary card unless the last-played source is a
              // different row (then that row takes focus).
              autofocus: previous == null || identical(currentPick, previous),
              isPrevious: identical(currentPick, previous),
              showFilename: showFilename,
              download: _isDownload,
              onSelect: _select,
              onDownload: _isDownload
                  ? null
                  : (s) => _select(s, forceDownload: true),
            ),
          ),
        // The cached / preferred-language filter pills live in their own row so
        // they stay mounted no matter how many quality tiers survive the filter.
        // (They used to sit inside the tier strip, which only shows for 2+
        // tiers — so toggling a pill that collapsed the tiers to one unmounted
        // the strip, killed the D-pad focus, and removed the only off-switch.)
        if (!_flatLayout &&
            (uncachedHiddenCount > 0 ||
                (prefLangs.isNotEmpty && langHiddenCount > 0)))
          SliverToBoxAdapter(
            child: _filterPillsRow(
              t,
              uncachedHiddenCount: uncachedHiddenCount,
              langHiddenCount: langHiddenCount,
              prefLangs: prefLangs,
            ),
          ),
        // The "Switch quality" strip is the Condensed layout's quality
        // selector — a rich button per tier (format badge + friendly label +
        // cached/size status) that re-points the hero card; the Stremio flat
        // list has no tier strip (web condensed vs StremioLayout). It only
        // appears when there is more than one quality tier to switch between
        // (web `populatedTiers.length > 1`).
        if (!_flatLayout && tiers.length > 1)
          SliverToBoxAdapter(child: _tierStrip(tiers, byTierLocal, t)),
        // The add-on selector — the flat layout's top-level source filter, a
        // dropdown of every add-on that returned a stream (web StremioLayout).
        if (_flatLayout) SliverToBoxAdapter(child: _addonDropdown(t, pool)),
        if (_flatLayout)
          SliverToBoxAdapter(
            child: FacetMenuRow(
              entries: facetEntries,
              tokens: t,
              onFacet: _setFacet,
              onReset: _resetFilters,
              filters: savedFilters,
              activeFilterId: _activeFilterId,
              onSelectFilter: (id) => setState(() => _activeFilterId = id),
              onNewFilter: _openFilterBuilder,
              onEditFilter: (f) => _openFilterBuilder(initial: f),
            ),
          ),
        if (streams.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Text(
                'No sources match the current filter.',
                textAlign: TextAlign.center,
                style: TextStyle(color: t.inkMuted, fontSize: 15),
              ),
            ),
          )
        else if (_flatLayout)
          _streamSliver(
            flatStreams,
            t,
            autofocusFirst: !showPrimary,
            showFilename: showFilename,
            previous: previous,
          )
        else ...[
          // The full grouped list is tucked behind an "All sources (N)" drawer
          // (web SourceDrawer). The curated Condensed view leads with the
          // diagnostic, best-source card and tier strip; the list expands on
          // demand (or by default when there is no card to lead with).
          SliverToBoxAdapter(
            child: _SourceDrawerToggle(
              count: streams.length,
              addonCount: streams
                  .map((s) => s.parsed.stream.addonId)
                  .toSet()
                  .length,
              open: drawerOpen,
              tokens: t,
              onToggle: () => setState(() => _drawerOpen = !drawerOpen),
            ),
          ),
          if (drawerOpen)
            for (var i = 0; i < tiers.length; i++) ...[
              SliverToBoxAdapter(child: _tierHeader(tiers[i], t)),
              _streamSliver(
                streams.where((s) => s.tier == tiers[i]).toList(),
                t,
                // Focus the very first row when there is no primary card.
                autofocusFirst: !showPrimary && i == 0,
                showFilename: showFilename,
                previous: previous,
              ),
            ],
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );
  }

  Widget _streamSliver(
    List<ScoredStream> streams,
    HarborTokens t, {
    required bool autofocusFirst,
    required bool showFilename,
    ScoredStream? previous,
  }) => SliverList.separated(
    itemCount: streams.length,
    separatorBuilder: (_, _) => const SizedBox(height: 8),
    itemBuilder: (context, i) {
      final s = streams[i];
      final isPrevious = identical(s, previous);
      return _StreamRow(
        stream: s,
        tokens: t,
        // The last-played row takes focus; otherwise the first row does (only
        // when no primary card leads).
        autofocus: previous != null ? isPrevious : (autofocusFirst && i == 0),
        isPrevious: isPrevious,
        showFilename: showFilename,
        // The flat (Stremio) layout shows the add-on description; the condensed
        // layout keeps the filename line.
        showDescription: _flatLayout,
        fullDescription: ref
            .watch(settingsProvider)
            .getBool('fullStreamDescription'),
        download: _isDownload,
        onSelect: _select,
        onDownload: _isDownload ? null : (s) => _select(s, forceDownload: true),
      );
    },
  );

  /// The cached / preferred-language filter pills, in their own row. Kept out of
  /// [_tierStrip] (which only renders for 2+ tiers) so a pill — and its
  /// off-switch — never unmounts when toggling it collapses the tiers to one.
  /// Ports the web `langFilterSlot`.
  Widget _filterPillsRow(
    HarborTokens t, {
    required int uncachedHiddenCount,
    required int langHiddenCount,
    required List<String> prefLangs,
  }) {
    final showCached = uncachedHiddenCount > 0;
    final showLang = prefLangs.isNotEmpty && langHiddenCount > 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Align(
        alignment: AlignmentDirectional.centerEnd,
        child: Wrap(
          alignment: WrapAlignment.end,
          spacing: 8,
          runSpacing: 6,
          children: [
            if (showCached) _cachedFilterPill(t, uncachedHiddenCount),
            if (showLang) _langFilterPill(t, prefLangs, langHiddenCount),
          ],
        ),
      ),
    );
  }

  /// The Condensed "Switch quality" strip (web `TierStrip`): a "SWITCH QUALITY"
  /// eyebrow + a quality-labels disclaimer, then one rich button per quality
  /// tier. Tapping a button re-points the hero card; it does not filter the
  /// list. The cached/language pills sit in their own [_filterPillsRow] above.
  Widget _tierStrip(
    List<StreamTier> tiers,
    Map<StreamTier, ScoredStream> byTier,
    HarborTokens t,
  ) {
    final effective = (_selectedTier != null && tiers.contains(_selectedTier))
        ? _selectedTier
        : tiers.first;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                'SWITCH QUALITY',
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3.2,
                ),
              ),
              const SizedBox(width: 8),
              _qualityDisclaimer(t),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final tier in tiers)
                _tierButton(
                  tier,
                  byTier[tier]!,
                  t,
                  selected: effective == tier,
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// One tier button in the "Switch quality" strip: the lead format badge, the
  /// friendly quality label, and a cached/instant · size status line. Ports the
  /// web `TierStrip` button.
  Widget _tierButton(
    StreamTier tier,
    ScoredStream lead,
    HarborTokens t, {
    required bool selected,
  }) {
    final cached = lead.cached.containsValue(true);
    final instant = lead.parsed.url != null && lead.parsed.infoHash == null;
    final status = instant ? 'Instant' : (cached ? 'Cached' : 'Cache');
    final size = lead.parsed.size != null
        ? _formatBytes(lead.parsed.size!)
        : 'size unknown';
    return Focusable(
      tokens: t,
      borderRadius: 14,
      onPressed: () => setState(() => _selectedTier = tier),
      child: Opacity(
        opacity: cached || instant ? 1 : 0.66,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? t.raised : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? t.ink.withValues(alpha: 0.35) : t.edgeSoft,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              FormatBadge(
                kind: streamLeadBadge(lead, tier),
                size: BadgeSize.lg,
              ),
              const SizedBox(width: 12),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    streamLeadLabel(lead, tier).toUpperCase(),
                    style: TextStyle(
                      color: selected ? t.ink : t.inkMuted,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (instant)
                        Icon(Icons.bolt, size: 11, color: t.accent)
                      else if (cached)
                        Icon(Icons.bolt_outlined, size: 11, color: t.inkMuted),
                      if (instant || cached) const SizedBox(width: 3),
                      Text(
                        '$status · $size',
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// The "quality labels come from add-ons" disclaimer — a focusable info glyph
  /// (so the TV D-pad can open it) that surfaces the web tooltip's caution.
  Widget _qualityDisclaimer(HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: () => showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: t.elevated,
        title: Text(
          'Quality labels come from add-ons',
          style: TextStyle(color: t.ink, fontSize: 16),
        ),
        content: Text(
          "Each row's resolution badge is whatever the add-on claimed. Some "
          'add-ons mislabel files: a 1080p or 4K tag on a brand-new release is '
          'often a CAM or TS rebadged. Harbor pushes obvious mismatches down '
          'the ranking, but if a top result looks suspicious, pick the Theater '
          'Capture tier instead.',
          style: TextStyle(color: t.inkMuted, fontSize: 13.5, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Got it', style: TextStyle(color: t.accent)),
          ),
        ],
      ),
    ),
    child: Icon(Icons.info_outline, size: 14, color: t.inkSubtle),
  );

  /// The Condensed "cached only" filter pill (web `CachedFilterPill`), sitting
  /// in the "Switch quality" header. [hidden] is how many uncached sources it
  /// would reveal.
  Widget _cachedFilterPill(HarborTokens t, int hidden) => _filterPill(
    t,
    on: _cachedOnly,
    icon: Icons.bolt,
    label: _cachedOnly ? 'Cached only · +$hidden' : 'Show all sources',
    onPressed: () => setState(() => _cachedOnly = !_cachedOnly),
  );

  /// The Condensed "preferred language" filter pill (web `LanguageFilterPill`).
  Widget _langFilterPill(HarborTokens t, List<String> prefLangs, int hidden) {
    final label = _abbreviateLangs(prefLangs);
    return _filterPill(
      t,
      on: _langFilter,
      icon: Icons.translate,
      label: _langFilter ? '$label only · +$hidden' : 'Show $label only',
      onPressed: () => setState(() => _langFilter = !_langFilter),
    );
  }

  Widget _filterPill(
    HarborTokens t, {
    required bool on,
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
  }) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onPressed,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: on ? t.accentSoft : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: on ? t.accent : t.inkSubtle),
          const SizedBox(width: 5),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: on ? t.accent : t.inkSubtle,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.4,
            ),
          ),
        ],
      ),
    ),
  );

  /// A short ISO code list for the language pill ("EN", "EN / ES"), ports web
  /// `abbreviateLanguages` at pill granularity.
  String _abbreviateLangs(List<String> langs) => langs
      .map((l) => l.trim())
      .where((l) => l.isNotEmpty)
      .map(
        (l) =>
            _kLangAbbrev[l.toLowerCase()] ??
            (l.length >= 2 ? l.substring(0, 2) : l).toUpperCase(),
      )
      .toSet()
      .take(3)
      .join(' / ');

  Widget _tierHeader(StreamTier tier, HarborTokens t) => Padding(
    padding: const EdgeInsets.fromLTRB(2, 8, 0, 8),
    child: Text(
      tierDisplayName(tier),
      style: TextStyle(
        color: t.inkSubtle,
        fontSize: 14,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
    ),
  );

  Widget _message(
    String text,
    HarborTokens t, {
    String? actionLabel,
    VoidCallback? onAction,
  }) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(color: t.inkMuted, fontSize: 16),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 18),
          Focusable(
            tokens: t,
            borderRadius: 12,
            autofocus: true,
            onPressed: onAction,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
              decoration: BoxDecoration(
                color: t.accentSoft,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.accent),
              ),
              child: Text(
                actionLabel,
                style: TextStyle(
                  color: t.accent,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class _CinematicLoader extends StatelessWidget {
  const _CinematicLoader({required this.tokens});
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(color: tokens.accent, strokeWidth: 2),
        const SizedBox(height: 16),
        Text(
          'Finding the best sources…',
          style: TextStyle(color: tokens.inkMuted, fontSize: 15),
        ),
      ],
    ),
  );
}

/// The Condensed layout's source-diagnostic line — "{N} cached · {M} found
/// across {K} add-ons", tappable to expand a per-add-on breakdown. Ports web
/// `SourceDiagnostic`. Focusable so the D-pad can expand it on TV.
class _SourceDiagnostic extends StatefulWidget {
  const _SourceDiagnostic({required this.all, required this.tokens});

  final List<ScoredStream> all;
  final HarborTokens tokens;

  @override
  State<_SourceDiagnostic> createState() => _SourceDiagnosticState();
}

class _SourceDiagnosticState extends State<_SourceDiagnostic> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final all = widget.all;
    final cached = all
        .where((s) => s.parsed.cached.values.any((v) => v))
        .length;
    final counts = <String, int>{};
    for (final s in all) {
      final name = s.parsed.addonName.isEmpty ? 'Unknown' : s.parsed.addonName;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    final entries = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final k = entries.length;
    final word = k == 1 ? 'source' : 'sources';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Focusable(
            tokens: t,
            scale: 1.0,
            borderRadius: 8,
            onPressed: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$cached cached',
                    style: TextStyle(
                      color: t.inkMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '  ·  ',
                    style: TextStyle(color: t.inkSubtle, fontSize: 12),
                  ),
                  Text(
                    '${all.length} found across $k $word',
                    style: TextStyle(color: t.inkSubtle, fontSize: 12),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 16,
                    color: t.inkSubtle,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 2),
              child: Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  for (final e in entries)
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${e.key} '),
                          TextSpan(
                            text: '${e.value}',
                            style: TextStyle(
                              color: t.inkSubtle.withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                      style: TextStyle(color: t.inkSubtle, fontSize: 11),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// The Condensed layout's "All sources (N)" drawer toggle — a focusable pill
/// that reveals or hides the full grouped source list beneath the best-source
/// card and tier strip. Ports web `SourceDrawer`'s collapsed/expanded header.
class _SourceDrawerToggle extends StatelessWidget {
  const _SourceDrawerToggle({
    required this.count,
    required this.addonCount,
    required this.open,
    required this.tokens,
    required this.onToggle,
  });

  final int count;
  final int addonCount;
  final bool open;
  final HarborTokens tokens;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 8),
      child: Focusable(
        tokens: t,
        borderRadius: 999,
        onPressed: onToggle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Row(
            children: [
              Icon(
                open ? Icons.expand_less : Icons.expand_more,
                size: 20,
                color: t.inkMuted,
              ),
              const SizedBox(width: 10),
              // Label flips like web SourceDrawer ("Show" ⇄ "Hide all sources").
              Text(
                open ? 'Hide all sources' : 'Show all sources',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '$count',
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              // Trailing "N addons" summary (web AddonLogoStack + count).
              Text(
                '$addonCount ${addonCount == 1 ? 'addon' : 'addons'}',
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PrimaryCard extends ConsumerWidget {
  const _PrimaryCard({
    required this.stream,
    required this.tokens,
    required this.autofocus,
    required this.showFilename,
    required this.download,
    required this.onSelect,
    required this.metaId,
    required this.contentType,
    this.posterUrl,
    this.metaYear,
    this.onDownload,
    this.isPrevious = false,
  });

  final ScoredStream stream;
  final HarborTokens tokens;
  final bool autofocus;
  final bool showFilename;
  final bool download;
  final void Function(ScoredStream) onSelect;

  /// The title's id / poster / type — the best-source card shows the title
  /// poster alongside the source, like the web PrimaryCard.
  final String metaId;
  final String contentType;
  final String? posterUrl;
  final int? metaYear;

  /// When set (play mode), a trailing button downloads the best source too.
  final void Function(ScoredStream)? onDownload;

  /// Whether the best source is also the one played last time.
  final bool isPrevious;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final p = stream.parsed;
    // Title: the raw add-on stream name (AIOStreams-style names such as
    // "HD ⭐⭐ ⚡" are shown verbatim), else the torrent filename / first
    // description line, else the parsed title. Ports web `displayTitle`.
    final title = _displayName(p);
    final fname = showFilename ? torrentFilename(p.stream) : '';
    // Year + provenance line reassuring the pick is the right title (web
    // `confirmationLabel`) — upper-cased and tracked like the web card.
    final confirmation = sourceConfirmationLabel(
      p,
      metaYear: metaYear,
      isMovie: contentType != 'series',
    );
    // Known audio languages get a large flag + language name; "Multi" is a chip.
    final langs = p.audioLanguages
        .where((l) => l.trim().isNotEmpty && l.toLowerCase() != 'unknown')
        .toList();
    final summary = _summaryParts(p);
    final showQuality = ref.watch(settingsProvider).getBool('showQualityBadge');
    final badges = showQuality
        ? streamBadges(p, reasons: stream.reasons)
        : const <BadgeKind>[];

    final card = Focusable(
      tokens: t,
      autofocus: autofocus,
      borderRadius: 20,
      onPressed: () => onSelect(stream),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [t.accentSoft, t.surface],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: t.accent.withValues(alpha: 0.5)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _poster(t, badges),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Audio-language row: a large flag + language name each, with
                  // "Multi" as an accent chip (web PrimaryCard language row).
                  if (langs.isNotEmpty)
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        for (final l in langs.take(6))
                          Flag(language: l, tokens: t, size: FlagSize.lg),
                        if (langs.length > 6)
                          Text(
                            '+${langs.length - 6} more',
                            style: TextStyle(
                              color: t.inkSubtle,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    )
                  else
                    _audioNotLabeled(t),
                  if (confirmation != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      confirmation.toUpperCase(),
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 2.4,
                      ),
                    ),
                  ],
                  if (isPrevious) ...[
                    const SizedBox(height: 10),
                    _lastPlayedPill(t),
                  ],
                  const SizedBox(height: 10),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 15.5,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                    ),
                  ),
                  if (fname.isNotEmpty && fname != title)
                    _filenameLine(fname, t),
                  if (summary.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _summaryLine(t, summary),
                  ],
                  if (p.remux ||
                      (p.releaseGroupNormalized?.isNotEmpty ?? false) ||
                      (p.edition?.isNotEmpty ?? false)) ...[
                    const SizedBox(height: 12),
                    _chips(t, p),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _playButton(t),
                      const SizedBox(width: 14),
                      Flexible(
                        child: _PlayProvenance(stream: stream, tokens: t),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: _trailingCluster(
        t,
        card,
        copyUrl: p.stream.url ?? p.stream.externalUrl,
        onDownload: onDownload == null ? null : () => onDownload!(stream),
      ),
    );
  }

  /// The raw add-on stream name, else the torrent filename / first description
  /// line, else the parsed title. Ports web `displayTitle` (movie context).
  String _displayName(ParsedStream p) {
    final raw = (p.stream.name ?? '').trim();
    if (raw.isNotEmpty) return raw;
    final filename = torrentFilename(p.stream);
    if (filename.isNotEmpty) return filename;
    final firstLine = (p.stream.title ?? '')
        .split('\n')
        .map((l) => l.trim())
        .firstWhere((l) => l.isNotEmpty, orElse: () => '');
    if (firstLine.isNotEmpty) return firstLine;
    return p.parsedTitle.isEmpty ? p.addonName : p.parsedTitle;
  }

  /// Size · audio codec · channels · video codec · HDR · seeders — the web
  /// `streamSummaryParts` line under the title.
  List<String> _summaryParts(ParsedStream p) {
    final parts = <String>[];
    if (p.size != null) parts.add(_formatSizeExact(p.size!));
    if (p.audio.codec != AudioCodec.other) parts.add(p.audio.codec.label);
    if (p.audio.channels >= 6) {
      parts.add(
        p.audio.channels == 8
            ? '7.1'
            : p.audio.channels == 7
            ? '6.1'
            : '5.1',
      );
    }
    if (p.codec != VideoCodec.other) parts.add(p.codec.label);
    if (p.hdrFormat != null) parts.add(p.hdrFormat!.label);
    if (p.seeders != null) parts.add('${p.seeders} seeds');
    return parts;
  }

  Widget _summaryLine(HarborTokens t, List<String> parts) => Wrap(
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      for (var i = 0; i < parts.length; i++) ...[
        if (i > 0)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: t.inkSubtle.withValues(alpha: 0.4),
                shape: BoxShape.circle,
              ),
            ),
          ),
        Text(
          parts[i],
          style: TextStyle(
            color: t.inkMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.6,
          ),
        ),
      ],
    ],
  );

  /// The poster/still with the format badges laid over its top-right corner
  /// (web PrimaryCard poster overlay), gated on `showQualityBadge`.
  Widget _poster(HarborTokens t, List<BadgeKind> badges) => ClipRRect(
    borderRadius: BorderRadius.circular(14),
    child: SizedBox(
      width: 116,
      height: 174,
      child: Stack(
        fit: StackFit.expand,
        children: [
          RpdbPosterImage(
            metaId: metaId,
            rawPoster: posterUrl,
            type: contentType == 'series' ? 'series' : 'movie',
            tokens: t,
            fallback: () => ColoredBox(color: t.elevated),
          ),
          if (badges.isNotEmpty) ...[
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 64,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.6),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 6,
              right: 6,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final k in badges)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: FormatBadge(kind: k, size: BadgeSize.sm),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    ),
  );

  Widget _audioNotLabeled(HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: t.surface,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Text(
      'Audio not labeled',
      style: TextStyle(
        color: t.inkSubtle,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.8,
      ),
    ),
  );

  /// REMUX + release-group + edition chips (web PrimaryCard chip row).
  Widget _chips(HarborTokens t, ParsedStream p) => Wrap(
    spacing: 8,
    runSpacing: 6,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      if (p.remux) _chip(t, 'REMUX', fg: t.ink, bg: t.raised, border: t.edge),
      if (p.releaseGroupNormalized?.isNotEmpty ?? false)
        _chip(
          t,
          p.releaseGroupNormalized!,
          fg: t.inkMuted,
          bg: t.surface,
          border: t.edgeSoft,
        ),
      if (p.edition?.isNotEmpty ?? false)
        _chip(
          t,
          editionText(p.edition!).toUpperCase(),
          fg: t.accent,
          bg: t.accentSoft,
          border: t.accent.withValues(alpha: 0.3),
        ),
    ],
  );

  Widget _chip(
    HarborTokens t,
    String text, {
    required Color fg,
    required Color bg,
    required Color border,
  }) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: border),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: fg,
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.6,
      ),
    ),
  );

  /// The big filled Play (or Download) pill (web PrimaryCard primary action).
  Widget _playButton(HarborTokens t) => Container(
    height: 52,
    padding: const EdgeInsets.symmetric(horizontal: 28),
    decoration: BoxDecoration(
      color: download ? t.accent : t.ink,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          download ? Icons.download_rounded : Icons.play_arrow_rounded,
          color: t.canvas,
          size: 24,
        ),
        const SizedBox(width: 8),
        Text(
          download ? 'Download' : 'Play',
          style: TextStyle(
            color: t.canvas,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      ],
    ),
  );

  /// Bytes → a human size like "4.30 GB" (2-decimal GB), matching web
  /// `formatSize` exactly.
  String _formatSizeExact(int bytes) {
    const gb = 1024 * 1024 * 1024;
    const mb = 1024 * 1024;
    if (bytes >= gb) return '${(bytes / gb).toStringAsFixed(2)} GB';
    if (bytes >= mb) return '${(bytes / mb).round()} MB';
    return '$bytes B';
  }
}

/// The primary card's provenance line: how the best source will play — direct
/// from the addon, via a debrid (cached ⚡ or uncached), from peers, or a
/// no-debrid prompt — always crediting the addon that found it. Ports the web
/// `PlayProvenance`.
class _PlayProvenance extends ConsumerWidget {
  const _PlayProvenance({required this.stream, required this.tokens});

  final ScoredStream stream;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final p = stream.parsed;
    final debrids = ref.watch(debridClientsProvider);
    final isCached = stream.cached.values.any((v) => v);
    final addon = _addonChip(t);

    // A direct playable URL straight from the addon.
    if ((stream.url ?? '').isNotEmpty) {
      return _line(t, [_eyebrow(t, 'via', t.inkSubtle), addon]);
    }
    // No debrid configured: either the (engine-gated) peer path, or a prompt.
    if (debrids.isEmpty) {
      if (directStreamAvailable(p)) {
        return _stacked(
          t,
          _status(t, 'Streams from peers', t.inkMuted),
          'found by',
          addon,
        );
      }
      return _stacked(
        t,
        _status(t, 'No debrid configured', t.danger),
        'add one in settings · found by',
        addon,
      );
    }
    // A debrid is configured: name the one that will serve it.
    DebridStore? cached;
    for (final d in debrids) {
      if (stream.cached[d.slug] == true) {
        cached = d;
        break;
      }
    }
    final target = cached ?? debrids.first;
    return _stacked(
      t,
      Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isCached) ...[
            Icon(Icons.bolt, size: 12, color: t.accent),
            const SizedBox(width: 4),
          ],
          _status(
            t,
            isCached ? 'plays via ${target.name}' : 'uncached on debrid',
            t.inkMuted,
          ),
        ],
      ),
      'found by',
      addon,
    );
  }

  Widget _addonChip(HarborTokens t) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      AddonLogo(
        addonId: stream.parsed.stream.addonId,
        addonName: stream.parsed.stream.addonName,
        size: AddonLogoSize.xs,
      ),
      const SizedBox(width: 6),
      Text(
        stream.parsed.stream.addonName,
        style: TextStyle(
          color: t.inkSubtle,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.6,
        ),
      ),
    ],
  );

  Widget _eyebrow(HarborTokens t, String text, Color color) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: color,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 2.4,
    ),
  );

  Widget _status(HarborTokens t, String text, Color color) => Text(
    text.toUpperCase(),
    style: TextStyle(
      color: color,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 2.4,
    ),
  );

  Widget _line(HarborTokens t, List<Widget> children) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < children.length; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        children[i],
      ],
    ],
  );

  Widget _stacked(
    HarborTokens t,
    Widget top,
    String foundPrefix,
    Widget addon,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      top,
      const SizedBox(height: 4),
      Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              foundPrefix.toUpperCase(),
              style: TextStyle(
                color: t.inkSubtle.withValues(alpha: 0.7),
                fontSize: 10,
                fontWeight: FontWeight.w500,
                letterSpacing: 1.6,
              ),
            ),
          ),
          const SizedBox(width: 6),
          addon,
        ],
      ),
    ],
  );
}

class _StreamRow extends StatelessWidget {
  const _StreamRow({
    required this.stream,
    required this.tokens,
    required this.autofocus,
    required this.showFilename,
    required this.download,
    required this.onSelect,
    this.onDownload,
    this.isPrevious = false,
    this.showDescription = false,
    this.fullDescription = true,
  });

  final ScoredStream stream;
  final HarborTokens tokens;
  final bool autofocus;
  final bool showFilename;
  final bool download;
  final void Function(ScoredStream) onSelect;

  /// Whether this is the source played last time — shows a "Last played" pill.
  final bool isPrevious;

  /// The flat (Stremio) layout shows the add-on's raw description line instead
  /// of the filename; [fullDescription] renders it in full, else condensed to
  /// three lines (`fullStreamDescription`, web `StremioRow`).
  final bool showDescription;
  final bool fullDescription;

  /// When set (play mode), a trailing download button saves this source offline
  /// without leaving the list. Null in download-intent mode, where the whole
  /// row already downloads on select.
  final void Function(ScoredStream)? onDownload;

  @override
  Widget build(BuildContext context) {
    final p = stream.parsed;
    final title = p.parsedTitle.isEmpty ? p.addonName : p.parsedTitle;
    final fname = showFilename ? torrentFilename(p.stream) : '';
    // The add-on's raw description (title, else description), for the flat
    // layout; shown only when it adds something beyond the parsed headline.
    final rawDesc = (p.stream.title?.trim().isNotEmpty ?? false)
        ? p.stream.title!.trim()
        : (p.stream.description?.trim() ?? '');
    final showDesc = showDescription && rawDesc.isNotEmpty && rawDesc != title;
    final body = Focusable(
      tokens: tokens,
      autofocus: autofocus,
      borderRadius: 12,
      onPressed: () => onSelect(stream),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: tokens.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: tokens.edgeSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (isPrevious) ...[
                  _lastPlayedPill(tokens),
                  const SizedBox(width: 8),
                ],
                Text(
                  p.addonName,
                  style: TextStyle(color: tokens.inkSubtle, fontSize: 12),
                ),
                if (download) ...[
                  const SizedBox(width: 8),
                  Icon(Icons.download_rounded, color: tokens.accent, size: 18),
                ],
              ],
            ),
            if (showDesc)
              _descriptionLine(rawDesc, fullDescription, tokens)
            else if (fname.isNotEmpty && fname != title)
              _filenameLine(fname, tokens),
            const SizedBox(height: 8),
            _BadgeRow(stream: stream, tokens: tokens),
          ],
        ),
      ),
    );
    return _trailingCluster(
      tokens,
      body,
      copyUrl: p.stream.url ?? p.stream.externalUrl,
      onDownload: onDownload == null ? null : () => onDownload!(stream),
    );
  }
}

/// Wraps [content] with the per-source trailing actions — a copy-link button
/// (direct/external links only, and not on TV where there is nowhere to paste)
/// and, in play mode, a download button — as sibling Focusables so the D-pad
/// Left/Right reaches them. Returns [content] untouched when neither applies.
Widget _trailingCluster(
  HarborTokens tokens,
  Widget content, {
  String? copyUrl,
  VoidCallback? onDownload,
}) {
  final showCopy =
      copyUrl != null && copyUrl.isNotEmpty && kPlatformIsTv != true;
  if (!showCopy && onDownload == null) return content;
  return FocusTraversalGroup(
    policy: ReadingOrderTraversalPolicy(),
    child: IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: content),
          if (showCopy) ...[
            const SizedBox(width: 8),
            _CopyLinkButton(tokens: tokens, url: copyUrl),
          ],
          if (onDownload != null) ...[
            const SizedBox(width: 8),
            _RowDownloadButton(tokens: tokens, onPressed: onDownload),
          ],
        ],
      ),
    ),
  );
}

/// A trailing copy-link button that copies a source's direct URL to the
/// clipboard, flashing a check for ~1.2s. Ported from web `CopyLinkButton`.
class _CopyLinkButton extends StatefulWidget {
  const _CopyLinkButton({required this.tokens, required this.url});

  final HarborTokens tokens;
  final String url;

  @override
  State<_CopyLinkButton> createState() => _CopyLinkButtonState();
}

class _CopyLinkButtonState extends State<_CopyLinkButton> {
  bool _copied = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.url));
    setState(() => _copied = true);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: _copy,
      child: Container(
        width: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Icon(
          _copied ? Icons.check_rounded : Icons.copy_rounded,
          color: _copied ? t.accent : t.inkMuted,
          size: 20,
        ),
      ),
    );
  }
}

/// A trailing per-source download button (play mode) — a focusable action,
/// sibling to the row body so the D-pad Left/Right reaches it, that saves that
/// specific source offline.
class _RowDownloadButton extends StatelessWidget {
  const _RowDownloadButton({required this.tokens, required this.onPressed});

  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Focusable(
    tokens: tokens,
    borderRadius: 12,
    onPressed: onPressed,
    child: Container(
      width: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: Icon(Icons.download_rounded, color: tokens.accent, size: 22),
    ),
  );
}

/// The "Last played" pill marking the source played last time — the source-list
/// counterpart of the web now-playing/last-played marker.
Widget _lastPlayedPill(HarborTokens t) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  decoration: BoxDecoration(
    color: t.accentSoft,
    borderRadius: BorderRadius.circular(999),
  ),
  child: Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(Icons.bolt, size: 12, color: t.accent),
      const SizedBox(width: 3),
      Text(
        'Last played',
        style: TextStyle(
          color: t.accent,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    ],
  ),
);

/// Condenses a multi-line stream description to a preview: the first line
/// truncated to 90 chars, the rest kept. Ported from web `condenseDescription`.
String condenseDescription(String text) {
  if (text.isEmpty) return '';
  final lines = text.split('\n');
  final first = lines.first;
  final head = first.length > 90
      ? '${first.substring(0, 90).trimRight()}…'
      : first;
  return [head, ...lines.skip(1)].join('\n');
}

/// The add-on's raw description beneath a stream title on the flat layout —
/// full (multi-line) when [full], else condensed to three lines
/// (`fullStreamDescription`, web `StremioRow`).
Widget _descriptionLine(String desc, bool full, HarborTokens t) => Padding(
  padding: const EdgeInsets.only(top: 4),
  child: Text(
    full ? desc : condenseDescription(desc),
    maxLines: full ? null : 3,
    overflow: full ? TextOverflow.clip : TextOverflow.ellipsis,
    style: TextStyle(color: t.inkMuted, fontSize: 12.5, height: 1.35),
  ),
);

/// The optional raw-filename line beneath a stream title (`pickerShowFilename`),
/// shown only when it differs from the displayed title.
Widget _filenameLine(String fname, HarborTokens t) => Padding(
  padding: const EdgeInsets.only(top: 4),
  child: Text(
    fname,
    maxLines: 2,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      color: t.inkSubtle,
      fontSize: 11,
      height: 1.3,
      fontFamily: 'monospace',
    ),
  ),
);

/// The quality/size/seeders/cached badges shared by the primary card and rows.
/// Quality is drawn with the real artwork badges ([FormatBadge] via
/// [streamBadges]) exactly like the web picker, gated on `showQualityBadge`;
/// size, seeders, and per-debrid cache stay as text chips.
class _BadgeRow extends ConsumerWidget {
  const _BadgeRow({required this.stream, required this.tokens});

  final ScoredStream stream;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = stream.parsed;
    final showQuality = ref.watch(settingsProvider).getBool('showQualityBadge');
    // The source's audio languages (web shows these flags on every row and the
    // primary card); unknown/unlabelled languages are dropped.
    final langs = p.audioLanguages
        .where((l) => l.trim().isNotEmpty && l.toLowerCase() != 'unknown')
        .toList();
    final badges = <Widget>[
      if (showQuality)
        for (final kind in streamBadges(p, reasons: stream.reasons))
          FormatBadge(kind: kind, size: BadgeSize.sm),
      if (langs.isNotEmpty)
        FlagStack(languages: langs, tokens: tokens, size: FlagSize.md, max: 4),
      if (p.edition != null && p.edition!.isNotEmpty)
        _editionChip(editionText(p.edition!), tokens),
      // The release group (FRAMESTOR/FLUX/…) — a trust/quality signal the web
      // shows on rows and the primary card.
      if (p.releaseGroupNormalized != null &&
          p.releaseGroupNormalized!.isNotEmpty)
        _badge(p.releaseGroupNormalized!, tokens.inkMuted, tokens),
      if (p.size != null)
        _badge(_formatBytes(p.size!), tokens.inkMuted, tokens),
      if (p.seeders != null) _badge('▲ ${p.seeders}', tokens.inkMuted, tokens),
      for (final slug in DebridSlug.values)
        if (p.cached[slug] == true)
          _badge('${slug.label.toUpperCase()} ⚡', tokens.accent, tokens),
    ];
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: badges,
    );
  }

  Widget _badge(String text, Color color, HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: t.raised,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
    ),
  );

  /// The accent-tinted edition pill (Director's Cut, IMAX, Extended, …). Ports
  /// the web `EditionChip`.
  Widget _editionChip(String text, HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: t.accentSoft,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.accent.withValues(alpha: 0.3)),
    ),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(
        color: t.accent,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    ),
  );
}

String _formatBytes(int bytes) {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb) return '${(bytes / gb).toStringAsFixed(1)} GB';
  return '${(bytes / mb).round()} MB';
}

/// The display label for a stream's [edition], normalising the common
/// abbreviated forms. Ports the web `editionText`.
String editionText(String edition) {
  if (RegExp('director', caseSensitive: false).hasMatch(edition)) {
    return "Director's Cut";
  }
  if (RegExp(r'open[\s.]?matte', caseSensitive: false).hasMatch(edition)) {
    return 'Open Matte';
  }
  return edition;
}

/// Whether the local torrent engine could stream [stream] directly from peers.
/// Ports web `directStreamAvailable`. The native default ([NoTorrentEngine])
/// bundles no engine, so this is currently false — direct peer streaming (and
/// the "Streams from peers" provenance) activates only once an engine ships.
bool directStreamAvailable(ParsedStream stream) =>
    const NoTorrentEngine().eligible(stream);

/// The remote-navigable resolve-outcome dialog: a message plus a Close action
/// and, for an uncached source, a "Play anyway" action.
class _OutcomeDialog extends StatelessWidget {
  const _OutcomeDialog({
    required this.tokens,
    required this.title,
    required this.body,
    required this.offerCommit,
    required this.onCommit,
  });

  final HarborTokens tokens;
  final String title;
  final String body;
  final bool offerCommit;
  final VoidCallback? onCommit;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: tokens.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: tokens.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                body,
                style: TextStyle(
                  color: tokens.inkMuted,
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (offerCommit && onCommit != null) ...[
                    _action(
                      'Play anyway',
                      filled: true,
                      autofocus: true,
                      onPressed: onCommit!,
                    ),
                    const SizedBox(width: 12),
                  ],
                  _action(
                    'Close',
                    filled: !offerCommit,
                    autofocus: !offerCommit,
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _action(
    String label, {
    required bool filled,
    required bool autofocus,
    required VoidCallback onPressed,
  }) => Focusable(
    tokens: tokens,
    autofocus: autofocus,
    borderRadius: 10,
    onPressed: onPressed,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
      decoration: BoxDecoration(
        color: filled ? tokens.accent : tokens.raised,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: filled ? tokens.canvas : tokens.ink,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}

/// The add-on selector menu — a focus-trapped, remote-navigable list of "All
/// sources" plus every add-on that returned a stream (logo + name + count).
/// Pops with the chosen add-on name, or [allSentinel] for All. Ports the web
/// StremioLayout add-on dropdown menu.
class _AddonMenu extends StatelessWidget {
  const _AddonMenu({
    required this.tokens,
    required this.names,
    required this.counts,
    required this.ids,
    required this.total,
    required this.selected,
    required this.allSentinel,
  });

  final HarborTokens tokens;
  final List<String> names;
  final Map<String, int> counts;
  final Map<String, String> ids;
  final int total;
  final String? selected;
  final String allSentinel;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Dialog(
      backgroundColor: t.elevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380, maxHeight: 460),
        child: FocusTraversalGroup(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(8),
            children: [
              _row(
                context,
                addonId: null,
                name: 'All sources',
                count: total,
                value: allSentinel,
                active: selected == null,
                autofocus: selected == null,
              ),
              for (final name in names)
                _row(
                  context,
                  addonId: ids[name],
                  name: name,
                  count: counts[name] ?? 0,
                  value: name,
                  active: selected == name,
                  autofocus: selected == name,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(
    BuildContext context, {
    required String? addonId,
    required String name,
    required int count,
    required String value,
    required bool active,
    required bool autofocus,
  }) {
    final t = tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 12,
        autofocus: autofocus,
        onPressed: () => Navigator.of(context).pop(value),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            color: active ? t.raised : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 32,
                height: 32,
                child: addonId == null
                    ? Icon(Icons.grid_view_rounded, size: 16, color: t.inkMuted)
                    : ClipOval(
                        child: AddonLogo(
                          addonId: addonId,
                          addonName: name,
                          size: AddonLogoSize.md,
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: active ? t.ink : t.inkMuted,
                    fontSize: 14,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '$count',
                style: TextStyle(color: t.inkSubtle, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Full-name → ISO-639-1 code for the condensed language pill's short label
/// (falls back to the first two letters). Covers the common preferred tongues.
const Map<String, String> _kLangAbbrev = {
  'english': 'EN',
  'spanish': 'ES',
  'spanish (latin america)': 'ES',
  'french': 'FR',
  'german': 'DE',
  'italian': 'IT',
  'portuguese': 'PT',
  'russian': 'RU',
  'japanese': 'JA',
  'korean': 'KO',
  'chinese': 'ZH',
  'hindi': 'HI',
  'arabic': 'AR',
  'dutch': 'NL',
  'polish': 'PL',
  'turkish': 'TR',
  'swedish': 'SV',
  'norwegian': 'NO',
  'danish': 'DA',
  'finnish': 'FI',
};
