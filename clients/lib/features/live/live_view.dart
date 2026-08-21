import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/iptv_controllers.dart';
import '../../app/iptv_providers.dart';
import '../../app/iptv_source_mutations.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/catchup.dart';
import '../../domain/iptv/channel_headers.dart';
import '../../domain/iptv/epg_resolver.dart';
import '../../domain/iptv/export.dart';
import '../../domain/iptv/group_prefs.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/iptv/playlist.dart';
import '../../domain/iptv/playlist_form.dart';
import '../../domain/iptv/xmltv.dart';
import '../../domain/nav/frame.dart';
import 'channel_pipeline.dart';
import 'epg_match_dialog.dart';
import 'guide_view.dart';
import 'live_channel_card.dart';
import 'live_home_view.dart';
import 'playlist_form_dialog.dart';
import 'sports/sports_rail.dart';
import '../../design/focus/tv_text_field.dart';

/// The Live TV view — an IPTV source's channels in a remote-navigable grid,
/// with a source switcher, group rail, Arabic-aware search, and a now/next EPG
/// strip on each card. Channels are filtered/ordered by the shared channel
/// pipeline (relevance + user pins + hidden groups). Ports the grid surface of
/// `views/live` (`40-debrid-iptv-ai.md`, `10-pages.md`).
class LiveTvView extends ConsumerStatefulWidget {
  const LiveTvView({super.key});

  @override
  ConsumerState<LiveTvView> createState() => _LiveTvViewState();
}

class _LiveTvViewState extends ConsumerState<LiveTvView> {
  int _sourceIndex = 0;
  String? _group; // null = All
  String _query = '';
  LiveViewMode _mode = LiveViewMode.home;

  static const _modeKey = 'harbor.live.viewmode';

  @override
  void initState() {
    super.initState();
    // Restore the last view mode (web `readMode`, default Home).
    _mode = switch (ref.read(kvStoreProvider).getString(_modeKey)) {
      'grid' => LiveViewMode.grid,
      'guide' => LiveViewMode.guide,
      _ => LiveViewMode.home,
    };
  }

  void _setMode(LiveViewMode m) {
    setState(() => _mode = m);
    ref.read(kvStoreProvider).setString(_modeKey, m.name);
  }

  /// The active translator; `build` watches it so a language change repaints.
  Translations get _tr => ref.read(translationsProvider);

  void _play(IptvChannel ch) {
    ref.read(channelStatsVersionProvider.notifier).record(ch);
    final headers = headersFromChannel(ch);
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': ch.url,
            'title': ch.name,
            'isLive': true,
            'contentId': ch.id,
            'contentType': 'tv',
            'headers': ?headers,
          }),
        );
  }

  /// Plays a past programme through the channel's catch-up scheme, falling back
  /// to live if no catch-up url can be built. Ports `handlePlayCatchup`.
  void _playCatchup(IptvChannel ch, EpgProgram program) {
    final now =
        ref.read(nowMsProvider).asData?.value ??
        DateTime.now().millisecondsSinceEpoch;
    final url = buildCatchupUrl(ch, program.startMs, program.endMs, nowMs: now);
    if (url == null) {
      _play(ch);
      return;
    }
    final headers = headersFromChannel(ch);
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': url,
            'title': program.title.isNotEmpty ? program.title : ch.name,
            'isLive': true,
            'contentId': ch.id,
            'contentType': 'tv',
            'headers': ?headers,
          }),
        );
  }

  PlaylistFormValue _formOf(IptvPlaylistSource s) => PlaylistFormValue(
    name: s.name,
    kind: switch (s.kind) {
      IptvSourceKind.xtream => PlaylistKind.xtream,
      IptvSourceKind.epg => PlaylistKind.epg,
      _ => PlaylistKind.m3u,
    },
    url: s.url,
    epgUrl: s.epgUrl ?? '',
    xtream: s.xtream != null
        ? XtreamFormCreds(
            server: s.xtream!.server,
            username: s.xtream!.username,
            password: s.xtream!.password,
          )
        : const XtreamFormCreds(),
  );

  Future<void> _addSource(HarborTokens t) async {
    final value = await showPlaylistForm(
      context: context,
      tokens: t,
      submitLabel: _tr.t('Add source'),
      tr: _tr,
    );
    if (value == null) return;
    await ref.read(iptvSourceMutationsProvider).add(value);
  }

  Future<void> _editSource(HarborTokens t, IptvPlaylistSource source) async {
    final value = await showPlaylistForm(
      context: context,
      tokens: t,
      submitLabel: _tr.t('Save'),
      tr: _tr,
      initial: _formOf(source),
    );
    if (value == null) return;
    await ref.read(iptvSourceMutationsProvider).edit(source.id, value);
  }

  Future<void> _manageSource(
    HarborTokens t,
    List<IptvPlaylistSource> sources,
    int idx,
  ) async {
    final source = sources[idx];
    final playlist = ref.read(iptvPlaylistStoreProvider).cached(source.id);
    final chosen = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: [
        ContextMenuAction(
          value: 'edit',
          label: 'Edit "${source.name}"',
          icon: Icons.edit_outlined,
        ),
        if (playlist != null)
          ContextMenuAction(
            value: 'copy',
            label: _tr.t('Copy as M3U'),
            icon: Icons.copy_outlined,
          ),
        if (idx > 0)
          ContextMenuAction(
            value: 'up',
            label: _tr.t('Move up'),
            icon: Icons.arrow_upward,
          ),
        if (idx < sources.length - 1)
          ContextMenuAction(
            value: 'down',
            label: _tr.t('Move down'),
            icon: Icons.arrow_downward,
          ),
        ContextMenuAction(
          value: 'delete',
          label: 'Delete "${source.name}"',
          icon: Icons.delete_outline,
          danger: true,
        ),
      ],
    );
    final mutations = ref.read(iptvSourceMutationsProvider);
    switch (chosen) {
      case 'edit':
        if (mounted) await _editSource(t, source);
      case 'copy':
        if (playlist != null) {
          await Clipboard.setData(
            ClipboardData(
              text: buildM3u(playlist.channels, epgUrl: playlist.epgUrl),
            ),
          );
        }
      case 'up':
        await mutations.reorder(source.id, -1);
      case 'down':
        await mutations.reorder(source.id, 1);
      case 'delete':
        await mutations.remove(source.id);
        if (mounted) setState(() => _sourceIndex = 0);
    }
  }

  Future<void> _menu(HarborTokens t, IptvChannel ch, String sourceId) async {
    final pinned = ref.read(channelPinsProvider).contains(ch.id);
    final fav = ref.read(favoritesProvider).containsKey(ch.id);
    final group = ch.group ?? _tr.t('Uncategorized');
    final chosen = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: [
        ContextMenuAction(
          value: 'play',
          label: _tr.t('Play'),
          icon: Icons.play_arrow,
        ),
        ContextMenuAction(
          value: 'pin',
          label: pinned ? _tr.t('Unpin') : _tr.t('Pin to top'),
          icon: pinned ? Icons.push_pin : Icons.push_pin_outlined,
        ),
        ContextMenuAction(
          value: 'fav',
          label: fav ? _tr.t('Remove favourite') : _tr.t('Add favourite'),
          icon: fav ? Icons.star : Icons.star_outline,
        ),
        ContextMenuAction(
          value: 'matchEpg',
          label: _tr.t('Match EPG'),
          icon: Icons.event_note_outlined,
        ),
        ContextMenuAction(
          value: 'hide',
          label: 'Hide "$group"',
          icon: Icons.visibility_off_outlined,
        ),
      ],
    );
    switch (chosen) {
      case 'play':
        _play(ch);
      case 'pin':
        await ref.read(channelPinsProvider.notifier).toggle(ch.id);
      case 'fav':
        await ref.read(favoritesProvider.notifier).toggle(ch);
      case 'matchEpg':
        await _matchEpg(t, ch, sourceId);
      case 'hide':
        await ref
            .read(groupPrefsProvider.notifier)
            .toggleHidden(sourceId, group);
    }
  }

  /// Opens the manual EPG-match picker for [ch] and persists the chosen
  /// override (or clears it), so a channel whose guide auto-match missed can be
  /// mapped to the right tvg-id.
  Future<void> _matchEpg(
    HarborTokens t,
    IptvChannel ch,
    String sourceId,
  ) async {
    final candidates = ref
        .read(iptvSourcesProvider)
        .where((s) => s.id == sourceId);
    if (candidates.isEmpty) return;
    final epg = ref.read(iptvEpgProvider(candidates.first)).value;
    if (epg == null || epg.byChannel.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_tr.t('No EPG is loaded for this source.'))),
      );
      return;
    }
    final hasOverride = ref.read(epgOverridesProvider).containsKey(ch.id);
    final res = await showEpgMatchDialog(
      context: context,
      tokens: t,
      channelName: ch.name,
      epg: epg,
      hasOverride: hasOverride,
      tr: _tr,
    );
    if (res == null) return;
    await ref
        .read(epgOverridesProvider.notifier)
        .setOverride(ch.id, res.clear ? null : res.tvgId);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    ref.watch(translationsProvider); // repaint on a language change
    final sources = ref.watch(iptvSourcesProvider);
    if (sources.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.live_tv_outlined, color: t.inkSubtle, size: 46),
            const SizedBox(height: 14),
            Text(
              _tr.t('No IPTV sources yet.'),
              style: TextStyle(color: t.inkMuted, fontSize: 15),
            ),
            const SizedBox(height: 16),
            _AddButton(tokens: t, onTap: () => _addSource(t), tr: _tr),
          ],
        ),
      );
    }
    final idx = _sourceIndex.clamp(0, sources.length - 1);
    final source = sources[idx];
    final playlistAsync = ref.watch(iptvPlaylistProvider(source));

    return playlistAsync.when(
      loading: () => Center(child: CircularProgressIndicator(color: t.accent)),
      error: (e, _) => _Message(
        tokens: t,
        icon: Icons.error_outline,
        text: e is Exception
            ? e.toString().replaceFirst(RegExp(r'^\w+Error: '), '')
            : _tr.t('Could not load this playlist.'),
      ),
      data: (playlist) => _content(t, sources, idx, playlist),
    );
  }

  Widget _content(
    HarborTokens t,
    List<IptvPlaylistSource> sources,
    int idx,
    IptvPlaylist playlist,
  ) {
    final source = sources[idx];
    final settings = ref.watch(settingsProvider);
    final region = settings.region.isEmpty ? 'US' : settings.region;
    final langs = settings.getStringList('preferredLanguages');
    final pins = ref.watch(channelPinsProvider);
    final groupPrefs =
        ref.watch(groupPrefsProvider)[playlist.id] ?? const GroupPrefs();
    final favorites = ref.watch(favoritesProvider);
    ref.watch(channelStatsVersionProvider); // rebuild after a play is recorded
    final statsStore = ref.read(channelStatsStoreProvider);

    final result = buildChannelPipeline(
      playlist: playlist,
      region: region,
      preferredLanguages: langs,
      mode: _mode,
      group: _group,
      query: _query,
      favoriteIds: favorites.keys.toSet(),
      favoriteItems: favorites,
      allPlaylists: {playlist.id: playlist},
      allSources: sources,
      pinnedOrder: pins,
      groupPrefs: groupPrefs,
      playCount: statsStore.playCount,
    );

    // EPG is supplementary — the grid renders channels while it loads/fails.
    final epg = ref.watch(iptvEpgProvider(source)).asData?.value;
    final nowMs =
        ref.watch(nowMsProvider).asData?.value ??
        DateTime.now().millisecondsSinceEpoch;
    final overrides = ref.watch(epgOverridesProvider);
    final offset = ref.watch(iptvEpgOffsetHoursProvider);
    final tvgCounts = computeTvgIdCounts(playlist.channels);

    // The Live view was authored with fixed 24px gutters; make them idiom-aware
    // (tight on a phone, the 1:1 48 on tablet/tv) like every other screen.
    final g = pageGutter(Idiom.of(context));
    final isHome = _mode == LiveViewMode.home;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _header(t, sources, idx, g),
        _search(t, g),
        // The group rail + the standalone sports rail belong to the grid/guide
        // surfaces; Home carries its own curated sports + rails (web hides the
        // group rail when `mode === "home"`).
        if (!isHome) _groupRail(t, result, g),
        if (!isHome) const SportsRail(),
        Expanded(
          child: isHome
              ? LiveHomeView(
                  tokens: t,
                  tr: _tr,
                  source: source,
                  playlist: playlist,
                  epg: epg,
                  nowMs: nowMs,
                  onPlay: _play,
                  onMenu: (ch) => _menu(t, ch, source.id),
                )
              : _mode == LiveViewMode.guide
              ? GuideView(
                  tokens: t,
                  channels: result.visible,
                  epg: epg,
                  tvgCounts: tvgCounts,
                  overrides: overrides,
                  offset: offset,
                  nowMs: nowMs,
                  onPlay: _play,
                  onPlayCatchup: _playCatchup,
                  tr: _tr,
                )
              : _grid(
                  t,
                  result,
                  playlist.id,
                  epg,
                  tvgCounts,
                  overrides,
                  offset,
                  nowMs,
                  g,
                ),
        ),
      ],
    );
  }

  ({EpgProgram? current, EpgProgram? next}) _nowNext(
    IptvChannel ch,
    EpgIndex? epg,
    Map<String, int> counts,
    Map<String, String> overrides,
    double offset,
    int nowMs,
  ) {
    if (epg == null) return (current: null, next: null);
    final programs = epgProgramsForChannel(
      ch,
      epg,
      counts,
      override: overrides[ch.id],
      offsetHours: offset,
    );
    return findCurrent(programs, nowMs);
  }

  Widget _header(
    HarborTokens t,
    List<IptvPlaylistSource> sources,
    int idx,
    double g,
  ) {
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 20, g, 8),
      child: Row(
        children: [
          // Flexible + ellipsis so the title yields space to the mode chips and
          // source icons instead of forcing the header to overflow on a phone.
          Flexible(
            child: Text(
              _tr.tOr('nav.live', 'Live TV'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 26,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 16),
          _Chip(
            tokens: t,
            label: _tr.t('Home'),
            selected: _mode == LiveViewMode.home,
            onTap: () => _setMode(LiveViewMode.home),
          ),
          const SizedBox(width: 8),
          _Chip(
            tokens: t,
            label: _tr.t('Grid'),
            selected: _mode == LiveViewMode.grid,
            onTap: () => _setMode(LiveViewMode.grid),
          ),
          const SizedBox(width: 8),
          _Chip(
            tokens: t,
            label: _tr.t('Guide'),
            selected: _mode == LiveViewMode.guide,
            onTap: () => _setMode(LiveViewMode.guide),
          ),
          const SizedBox(width: 12),
          // Multiview — watch several channels at once in a grid.
          _IconButton(
            tokens: t,
            icon: Icons.grid_view,
            onTap: () => ref
                .read(navControllerProvider.notifier)
                .push(const Frame(FrameKind.multiview)),
          ),
          const SizedBox(width: 6),
          _IconButton(tokens: t, icon: Icons.add, onTap: () => _addSource(t)),
          const SizedBox(width: 6),
          _IconButton(
            tokens: t,
            icon: Icons.more_horiz,
            onTap: () => _manageSource(t, sources, idx),
          ),
          const SizedBox(width: 20),
          if (sources.length > 1)
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var i = 0; i < sources.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _Chip(
                          tokens: t,
                          label: sources[i].name.isEmpty
                              ? 'Source ${i + 1}'
                              : sources[i].name,
                          selected: i == idx,
                          onTap: () => setState(() {
                            _sourceIndex = i;
                            _group = null;
                          }),
                        ),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _search(HarborTokens t, double g) {
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 4, g, 8),
      child: TvTextField(
        onChanged: (v) {
          setState(() => _query = v);
          // Typing a query has nothing to filter on the curated Home — drop to
          // the channel grid so the results show (web `mode === "home"` guard).
          if (v.isNotEmpty && _mode == LiveViewMode.home) {
            _setMode(LiveViewMode.grid);
          }
        },
        style: TextStyle(color: t.ink),
        cursorColor: t.accent,
        decoration: InputDecoration(
          hintText: _tr.t('Search channels'),
          hintStyle: TextStyle(color: t.inkSubtle),
          prefixIcon: Icon(Icons.search, color: t.inkMuted),
          filled: true,
          fillColor: t.raised,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.edgeSoft),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.edgeSoft),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: t.accent, width: 2),
          ),
        ),
      ),
    );
  }

  Widget _groupRail(HarborTokens t, ChannelPipelineResult result, double g) {
    final total = result.counts.values.fold<int>(0, (a, b) => a + b);
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: g),
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _Chip(
              tokens: t,
              label: 'All · $total',
              selected: _group == null,
              onTap: () => setState(() => _group = null),
            ),
          ),
          for (final g in result.sortedGroups)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _Chip(
                tokens: t,
                label: '$g · ${result.counts[g] ?? 0}',
                selected: _group == g,
                onTap: () => setState(() => _group = g),
              ),
            ),
        ],
      ),
    );
  }

  Widget _grid(
    HarborTokens t,
    ChannelPipelineResult result,
    String sourceId,
    EpgIndex? epg,
    Map<String, int> tvgCounts,
    Map<String, String> overrides,
    double offset,
    int nowMs,
    double g,
  ) {
    final channels = result.visible;
    if (channels.isEmpty) {
      return _Message(
        tokens: t,
        icon: Icons.search_off,
        text: _query.trim().isEmpty
            ? _tr.t('No channels in this group.')
            : _tr.t('No channels match "{q}"', {'q': _query}),
      );
    }
    return GridView.builder(
      // Clear the TV overscan crop at the bottom so the last row of channels
      // isn't eaten by the bezel.
      padding: EdgeInsets.fromLTRB(
        g,
        8,
        g,
        24 + overscanInset(Idiom.of(context)).bottom,
      ),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 250,
        mainAxisExtent: 190,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
      ),
      itemCount: channels.length,
      itemBuilder: (context, i) {
        final ch = channels[i];
        final nn = _nowNext(ch, epg, tvgCounts, overrides, offset, nowMs);
        return LiveChannelCard(
          tokens: t,
          channel: ch,
          current: nn.current,
          next: nn.next,
          nowMs: nowMs,
          autofocus: i == 0,
          tr: _tr,
          onPressed: () => _play(ch),
          onLongPress: () => _menu(t, ch, sourceId),
        );
      },
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.tokens,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final HarborTokens tokens;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 20,
      scale: 1.04,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? t.accent : t.raised,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? t.canvas : t.ink,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({
    required this.tokens,
    required this.icon,
    required this.onTap,
  });

  final HarborTokens tokens;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 10,
      scale: 1.06,
      onPressed: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: t.raised,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: t.ink, size: 20),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({
    required this.tokens,
    required this.onTap,
    required this.tr,
  });
  final HarborTokens tokens;
  final VoidCallback onTap;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      scale: 1.05,
      autofocus: true,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
        decoration: BoxDecoration(
          color: t.accent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add, color: t.canvas, size: 18),
            const SizedBox(width: 8),
            Text(
              tr.t('Add source'),
              style: TextStyle(
                color: t.canvas,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.tokens,
    required this.icon,
    required this.text,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: t.inkSubtle, size: 46),
          const SizedBox(height: 14),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.4),
          ),
        ],
      ),
    );
  }
}
