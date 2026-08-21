import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/addons_providers.dart' show searchAddonCatalogsProvider;
import '../../app/ai_providers.dart';
import '../../app/anime_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/iptv_providers.dart' show searchLiveChannelsProvider;
import '../../app/nav_controller.dart';
import '../../app/profiles_providers.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../app/voice_providers.dart';
import '../../design/ai/ai_example_hint.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/ai/ai_search.dart';
import '../../domain/nav/frame.dart';
import '../../domain/catalog/filter_rails.dart';
import '../../domain/catalog/tmdb.dart' show kMovieGenres, kTvGenres;
import '../../domain/i18n/translations.dart';
import '../../domain/iptv/channel_headers.dart';
import '../../domain/iptv/m3u.dart';
import '../../domain/search/search_multi.dart';
import '../../domain/streams/magnet.dart' show isDirectVideoUrl;
import '../../domain/voice/profile_intents.dart';
import '../../domain/voice/speech_recognizer.dart';
import '../shell/profile_switcher.dart';
import '../../design/focus/tv_text_field.dart';

/// Search: a text field over the grouped results — a hero Top Match card plus
/// Movies and Series lists — backed by the merged TMDB + Cinemeta search.
/// Submitting the field runs the query.
class SearchView extends ConsumerStatefulWidget {
  const SearchView({super.key});

  @override
  ConsumerState<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends ConsumerState<SearchView> {
  final _controller = TextEditingController();
  final _searchFocus = FocusNode();

  /// The last query recorded into recents, so each result set records once.
  String? _lastRecorded;

  /// Natural-language AI search vs. the standard catalog search.
  bool _aiMode = false;

  /// The app-scoped voice controller, cached so `dispose` never touches `ref`.
  late final VoiceSearchController _voice;

  /// The top-bar mic's autostart trigger, cached for the same reason.
  late final ValueNotifier<bool> _voiceAutostart;

  /// The active translator; `build` watches it so a language change repaints.
  Translations get _tr => ref.read(translationsProvider);

  @override
  void initState() {
    super.initState();
    _voice = ref.read(voiceSearchControllerProvider);
    // A completed voice capture fills the field and runs the query through the
    // same pipeline as typed input (catalog search, or AI search when on).
    _voice.onFinal = (q) {
      // A spoken profile command ("who's watching", "switch to Kids") is handled
      // hands-free instead of being run as a search query.
      final intent = resolveVoiceProfileIntent(
        q,
        ref.read(profilesProvider).profiles,
      );
      if (intent != null) {
        _voice.reset();
        _handleVoiceProfileIntent(intent);
        return;
      }
      _controller.text = q;
      _controller.selection = TextSelection.collapsed(offset: q.length);
      ref.read(searchQueryProvider.notifier).set(q);
      _voice.reset();
    };
    // If the top-bar mic asked for a capture (before or after this view mounted)
    // begin listening. Register the listener first so a later request is caught,
    // then consume any request that arrived before mount.
    _voiceAutostart = ref.read(voiceAutostartProvider);
    _voiceAutostart.addListener(_onVoiceAutostart);
    if (_voiceAutostart.value) _onVoiceAutostart();
  }

  void _onVoiceAutostart() {
    if (!_voiceAutostart.value) return;
    _voiceAutostart.value = false;
    _voice.start();
  }

  void _handleVoiceProfileIntent(VoiceProfileIntent intent) {
    if (!mounted) return;
    final notifier = ref.read(profilesProvider.notifier);
    final tokens = ref.read(tokensProvider);
    switch (intent) {
      case OpenPickerIntent():
        showProfileSwitcher(context, ref, tokens);
      case SwitchProfileIntent(profile: final p, locked: final locked):
        // Voice must never bypass a lock: a gated profile opens the picker so
        // the PIN is entered by hand; an unlocked one switches straight over.
        if (locked && !notifier.isSessionUnlocked(p.id)) {
          showProfileSwitcher(context, ref, tokens);
        } else {
          notifier.selectProfile(p.id);
        }
    }
  }

  @override
  void dispose() {
    _voiceAutostart.removeListener(_onVoiceAutostart);
    _voice.onFinal = null;
    _voice.cancel();
    _controller.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  /// Clears every recent search and re-homes the remote onto the search field —
  /// otherwise the focus dies on the now-removed "Clear" button (TV gets stuck).
  void _clearRecents() {
    ref.read(recentSearchesProvider.notifier).clear();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _searchFocus.requestFocus(),
    );
  }

  /// Removes one recent query; if it was the last, re-homes focus to the field.
  void _removeRecent(String query) {
    final wasLast = ref.read(recentSearchesProvider).length <= 1;
    ref.read(recentSearchesProvider.notifier).remove(query);
    if (wasLast) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _searchFocus.requestFocus(),
      );
    }
  }

  /// Re-runs a stored recent query, filling the field.
  void _runRecent(String query) {
    _controller.text = query;
    _controller.selection = TextSelection.collapsed(offset: query.length);
    ref.read(searchQueryProvider.notifier).set(query);
  }

  /// Opens a result, closing the search overlay so the pushed page is visible.
  void _leaveSearch() => ref.read(searchOpenProvider.notifier).close();

  void _openMeta(MetaPreview m) {
    _leaveSearch();
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));
  }

  void _openPerson(int id) {
    _leaveSearch();
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.person, {'id': id}));
  }

  /// The readable title of a direct-video URL — its decoded, extension-stripped
  /// last path segment. Ports web `fileTitle`.
  String _urlTitle(String url) {
    try {
      final path = Uri.parse(url).path;
      var name = path.split('/').where((s) => s.isNotEmpty).lastOrNull ?? url;
      name = Uri.decodeComponent(name);
      final dot = name.lastIndexOf('.');
      if (dot > 0) name = name.substring(0, dot);
      return name.replaceAll(RegExp(r'[._]+'), ' ').trim().isEmpty
          ? url
          : name.replaceAll(RegExp(r'[._]+'), ' ').trim();
    } catch (_) {
      return url;
    }
  }

  void _playChannel(IptvChannel ch) {
    final headers = headersFromChannel(ch);
    _leaveSearch();
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

  void _playUrl(String url) {
    final title = _urlTitle(url);
    _leaveSearch();
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': url,
            'title': title,
            'isLive': false,
            'contentId': 'url:$url',
            'contentType': 'movie',
          }),
        );
  }

  /// A play card for a pasted direct-video URL (web `UrlCard`).
  Widget _urlCard(HarborTokens t, String url) {
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 8, g, 48),
      child: Align(
        alignment: Alignment.topLeft,
        child: Focusable(
          tokens: t,
          borderRadius: 16,
          autofocus: true,
          onPressed: () => _playUrl(url),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 560),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: t.edgeSoft),
            ),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.accent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.play_arrow_rounded,
                    color: t.canvas,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _urlTitle(url),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: t.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _tr.t('Play this video URL'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The browse filter a detected [intent] opens (a bare year → the year filter,
  /// a genre name → its genre browse), or null when it is not browsable — the
  /// port of the search-overlay `onIntent`.
  MetaFilter? _intentFilter(SearchIntent? intent) {
    if (intent == null) return null;
    if (intent.kind == 'year' && intent.year != null) {
      return YearFilter('movie', intent.year!);
    }
    if (intent.kind == 'genre' && intent.genre != null) {
      final mt = intent.mediaType ?? 'movie';
      final id = (mt == 'movie' ? kMovieGenres : kTvGenres)[intent.genre!];
      if (id != null) return GenreFilter(mt, intent.genre!, id);
    }
    return null;
  }

  void _openIntent(MetaFilter f) {
    _leaveSearch();
    ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.filter, f.toArgs()));
  }

  /// The AI-search toggle in the search bar (the web sparkle/AI mode switch).
  Widget _aiToggle(HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 14,
    onPressed: () => setState(() => _aiMode = !_aiMode),
    child: Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _aiMode ? t.accentSoft : t.raised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _aiMode ? t.accent : t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.auto_awesome,
            size: 18,
            color: _aiMode ? t.accent : t.inkMuted,
          ),
          const SizedBox(width: 8),
          Text(
            'AI',
            style: TextStyle(
              color: _aiMode ? t.accent : t.inkMuted,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  /// The voice-search mic button. Pressing it starts (or stops) capture; while
  /// listening it fills with the accent to read at a glance on TV.
  Widget _micButton(HarborTokens t, VoiceSearchController voice) =>
      ListenableBuilder(
        listenable: voice,
        builder: (context, _) {
          final active = voice.isListening;
          return Focusable(
            tokens: t,
            borderRadius: 14,
            onPressed: () => active ? voice.stop() : voice.start(),
            child: Container(
              height: 56,
              width: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? t.accentSoft : t.raised,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: active ? t.accent : t.edgeSoft),
              ),
              child: Icon(
                active ? Icons.mic : Icons.mic_none_rounded,
                color: active ? t.accent : t.inkMuted,
              ),
            ),
          );
        },
      );

  /// The voice capture panel shown over the results while a capture is active or
  /// blocked — a real, focusable state for every outcome (never a silent no-op).
  Widget _voicePanel(HarborTokens t, VoiceSearchController voice) {
    final (IconData icon, String title, String body) = switch (voice.status) {
      VoiceStatus.listening => (
        Icons.mic,
        voice.transcript.isEmpty ? _tr.t('Listening…') : voice.transcript,
        _tr.t('Say a title, a person, or describe what you want to watch.'),
      ),
      VoiceStatus.denied => (
        Icons.mic_off_rounded,
        _tr.t('Microphone is off'),
        _tr.t(
          'Harbor needs microphone access to search by voice. Turn it on in '
          'your device settings, then try again.',
        ),
      ),
      VoiceStatus.unavailable => (
        Icons.mic_off_rounded,
        _tr.t('Voice search unavailable'),
        _tr.t("This device doesn't offer speech recognition."),
      ),
      _ => (
        Icons.hearing_disabled_rounded,
        _tr.t("Didn't catch that"),
        _tr.t(
          'The microphone stopped before anything was recognized. Try again.',
        ),
      ),
    };
    final listening = voice.status == VoiceStatus.listening;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: listening ? t.accentSoft : t.raised,
                shape: BoxShape.circle,
                border: Border.all(
                  color: listening ? t.accent : t.edgeSoft,
                  width: 2,
                ),
              ),
              child: Icon(
                icon,
                size: 40,
                color: listening ? t.accent : t.inkMuted,
              ),
            ),
            const SizedBox(height: 22),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.ink,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 14.5, height: 1.4),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!listening)
                  _voiceAction(
                    t,
                    _tr.t('Try again'),
                    () => voice.start(),
                    primary: true,
                  ),
                if (!listening) const SizedBox(width: 12),
                _voiceAction(
                  t,
                  listening ? _tr.t('Stop') : _tr.t('Dismiss'),
                  () => voice.cancel(),
                  primary: listening,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _voiceAction(
    HarborTokens t,
    String label,
    VoidCallback onTap, {
    bool primary = false,
  }) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
      decoration: BoxDecoration(
        color: primary ? t.accent : t.raised,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: primary ? t.accent : t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: primary ? t.canvas : t.inkMuted,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );

  /// The AI-search results: a poster grid of the resolved titles, with distinct
  /// idle / no-key / failure / empty states.
  Widget _aiResults(String query, HarborTokens t) {
    final g = pageGutter(Idiom.of(context));
    if (query.isEmpty) {
      return _centered(
        _tr.t('AI search'),
        _tr.t(
          'Describe a plot, a vibe, or even a specific episode by a scene — '
          'the AI finds matching titles.',
        ),
        t,
      );
    }
    final async = ref.watch(aiSearchProvider(query));
    return async.when(
      loading: () => Center(
        child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
      ),
      error: (e, _) => (e is AiSearchException && e.message == 'no-key')
          ? _centered(
              _tr.t('Add an AI key'),
              _tr.t(
                'Set an OpenRouter or Groq key under Settings to use AI search.',
              ),
              t,
            )
          : _centered(
              _tr.t('AI search failed'),
              _tr.t('The model could not be reached. Try again in a moment.'),
              t,
            ),
      data: (results) {
        if (results.isEmpty) {
          return _centered(
            _tr.t('No matches'),
            _tr.t(
              'The AI could not find titles for that. Try describing it '
              'differently.',
            ),
            t,
          );
        }
        return SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(g, 8, g, 48),
          child: Wrap(
            spacing: 18,
            runSpacing: 22,
            children: [
              for (final r in results)
                FocusablePoster(
                  item: r.meta,
                  tokens: t,
                  onPressed: () => _openMeta(r.meta),
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    ref.watch(translationsProvider); // repaint on a language change
    final query = ref.watch(searchQueryProvider);
    final results = ref.watch(searchResultsProvider);
    // Supplementary Jikan anime hits (web `results.anime`); fills in after the
    // debounced query settles, so the TMDB results never wait on it.
    final animeHits =
        ref.watch(searchAnimeProvider).asData?.value ?? const <MetaPreview>[];
    // Live-TV channel hits (web `results.liveTv`) matched across cached
    // playlists — synchronous + local, so it renders instantly.
    final liveHits = ref.watch(searchLiveChannelsProvider);
    // Installed-addon catalog hits (web `results.addons`), debounced.
    final addonHits =
        ref.watch(searchAddonCatalogsProvider).asData?.value ??
        const <MetaPreview>[];
    final voice = ref.watch(voiceSearchControllerProvider);
    final g = pageGutter(Idiom.of(context));

    return Column(
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 28, g, 12),
          child: Row(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    TvTextField(
                      controller: _controller,
                      focusNode: _searchFocus,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (q) =>
                          ref.read(searchQueryProvider.notifier).set(q.trim()),
                      style: TextStyle(color: t.ink, fontSize: 20),
                      cursorColor: t.accent,
                      decoration: InputDecoration(
                        // In AI mode the rotating example hint below stands in
                        // for the placeholder.
                        hintText: _aiMode
                            ? ''
                            : _tr.t('Search movies, shows, people…'),
                        hintStyle: TextStyle(color: t.inkSubtle, fontSize: 20),
                        prefixIcon: Icon(
                          _aiMode ? Icons.auto_awesome : Icons.search,
                          color: _aiMode ? t.accent : t.inkMuted,
                        ),
                        filled: true,
                        fillColor: t.raised,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 18,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(color: t.accent, width: 2),
                        ),
                      ),
                    ),
                    if (_aiMode)
                      Positioned(
                        left: 52,
                        right: 14,
                        top: 0,
                        bottom: 0,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: ValueListenableBuilder<TextEditingValue>(
                            valueListenable: _controller,
                            builder: (context, value, _) => AiExampleHint(
                              hidden: value.text.trim().isNotEmpty,
                              examples: kSearchExamples,
                              tokens: t,
                              fontSize: 20,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _micButton(t, voice),
              const SizedBox(width: 12),
              _aiToggle(t),
            ],
          ),
        ),
        Expanded(
          child: ListenableBuilder(
            listenable: voice,
            builder: (context, child) {
              if (voice.status != VoiceStatus.idle &&
                  voice.status != VoiceStatus.done) {
                return _voicePanel(t, voice);
              }
              return child!;
            },
            child: _aiMode
                ? _aiResults(query, t)
                : isDirectVideoUrl(query.trim())
                // A pasted direct video URL plays straight from a card (web
                // UrlCard) instead of running a title search.
                ? _urlCard(t, query.trim())
                : results.when(
                    loading: () => Center(
                      child: CircularProgressIndicator(
                        color: t.accent,
                        strokeWidth: 2,
                      ),
                    ),
                    error: (_, _) => Center(
                      child: Text(
                        _tr.t('Search failed.'),
                        style: TextStyle(color: t.inkMuted, fontSize: 16),
                      ),
                    ),
                    data: (r) {
                      if (query.isEmpty) {
                        return _emptyState(t);
                      }
                      // Record a query once it has yielded results (matches the web's
                      // recordRecent-on-results), post-frame to avoid a build mutation.
                      if (!r.isEmpty && query != _lastRecorded) {
                        _lastRecorded = query;
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          ref
                              .read(recentSearchesProvider.notifier)
                              .record(query);
                        });
                      }
                      final intentFilter = _intentFilter(r.intent);
                      if (r.isEmpty &&
                          animeHits.isEmpty &&
                          liveHits.isEmpty &&
                          addonHits.isEmpty &&
                          intentFilter == null) {
                        return _centered(
                          _tr.t('No matches for "{q}"', {'q': query}),
                          _tr.t(
                            "Try a different spelling, a person's name, a year "
                            'like "1972", or a genre like "Horror".',
                          ),
                          t,
                        );
                      }
                      return _Results(
                        results: r,
                        anime: animeHits,
                        live: liveHits,
                        addons: addonHits,
                        tokens: t,
                        tr: _tr,
                        onOpen: _openMeta,
                        onOpenPerson: _openPerson,
                        onPlayChannel: _playChannel,
                        onIntent: intentFilter == null
                            ? null
                            : () => _openIntent(intentFilter),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  /// The idle state: recent-search chips when any exist, else the prompt.
  Widget _emptyState(HarborTokens t) {
    final recent = ref.watch(recentSearchesProvider);
    if (recent.isEmpty) {
      return _centered(_tr.t('Search for movies, shows and people.'), null, t);
    }
    final g = pageGutter(Idiom.of(context));
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(g, 8, g, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 14, left: 4),
            child: Row(
              children: [
                Text(
                  _tr.t('RECENT'),
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2,
                  ),
                ),
                const Spacer(),
                Focusable(
                  tokens: t,
                  borderRadius: 8,
                  onPressed: _clearRecents,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    child: Text(
                      _tr.t('Clear'),
                      style: TextStyle(
                        color: t.inkMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final q in recent)
                  _RecentChip(
                    query: q,
                    tokens: t,
                    onRun: _runRecent,
                    onRemove: _removeRecent,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _centered(String title, String? subtitle, HarborTokens t) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: t.ink,
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 14, height: 1.4),
            ),
          ),
        ],
      ],
    ),
  );
}

/// A recent-search chip: tap the label to re-run it, the × to forget it.
class _RecentChip extends StatelessWidget {
  const _RecentChip({
    required this.query,
    required this.tokens,
    required this.onRun,
    required this.onRemove,
  });

  final String query;
  final HarborTokens tokens;
  final void Function(String) onRun;
  final void Function(String) onRemove;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () => onRun(query),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 9, 10, 9),
        decoration: BoxDecoration(
          color: t.raised,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history, size: 15, color: t.inkSubtle),
            const SizedBox(width: 8),
            Text(
              query,
              style: TextStyle(
                color: t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 6),
            Focusable(
              tokens: t,
              borderRadius: 999,
              onPressed: () => onRemove(query),
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: Icon(Icons.close, size: 15, color: t.inkMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Results extends StatelessWidget {
  const _Results({
    required this.results,
    required this.anime,
    required this.live,
    required this.addons,
    required this.tokens,
    required this.tr,
    required this.onOpen,
    required this.onOpenPerson,
    required this.onPlayChannel,
    this.onIntent,
  });

  final SearchResults results;
  final List<MetaPreview> anime;
  final List<MetaPreview> addons;
  final List<({IptvChannel channel, String playlistName})> live;
  final void Function(IptvChannel) onPlayChannel;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(MetaPreview) onOpen;
  final void Function(int) onOpenPerson;

  /// Opens the browse filter a bare year / genre query resolves to; null when
  /// there is no browsable intent.
  final VoidCallback? onIntent;

  @override
  Widget build(BuildContext context) {
    final intent = results.intent;
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    final phone = idiom.isPhone;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(g, 8, g, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (intent != null && onIntent != null) ...[
            _IntentPrompt(intent: intent, tokens: tokens, onTap: onIntent!),
            const SizedBox(height: 24),
          ],
          if (results.topMatch != null) ...[
            _TopMatchCard(
              match: results.topMatch!,
              tokens: tokens,
              tr: tr,
              onOpen: onOpen,
            ),
            const SizedBox(height: 32),
          ],
          if (results.people.isNotEmpty) ...[
            _PeopleRow(
              people: results.people,
              tokens: tokens,
              onOpen: onOpenPerson,
            ),
            const SizedBox(height: 32),
          ],
          // Two columns side by side on a wide screen; on a phone they stack so
          // each list keeps the full width (a half-width column is too narrow
          // for the poster rows and their meta lines).
          if (phone) ...[
            _MetaList(
              title: tr.t('Movies'),
              items: results.movies,
              tokens: tokens,
              onOpen: onOpen,
            ),
            const SizedBox(height: 32),
            _MetaList(
              title: tr.t('Series'),
              items: results.series,
              tokens: tokens,
              onOpen: onOpen,
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _MetaList(
                    title: tr.t('Movies'),
                    items: results.movies,
                    tokens: tokens,
                    onOpen: onOpen,
                  ),
                ),
                const SizedBox(width: 32),
                Expanded(
                  child: _MetaList(
                    title: tr.t('Series'),
                    items: results.series,
                    tokens: tokens,
                    onOpen: onOpen,
                  ),
                ),
              ],
            ),
          // Jikan anime hits (web AnimeRow) — supplements the TMDB lists with
          // anime-specific results.
          if (anime.isNotEmpty) ...[
            const SizedBox(height: 32),
            _MetaList(
              title: tr.t('Anime'),
              items: anime,
              tokens: tokens,
              onOpen: onOpen,
            ),
          ],
          // Installed-addon catalog hits (web AddonResults).
          if (addons.isNotEmpty) ...[
            const SizedBox(height: 32),
            _MetaList(
              title: tr.t('From your add-ons'),
              items: addons,
              tokens: tokens,
              onOpen: onOpen,
            ),
          ],
          // Live-TV channel hits (web LiveTvRow) — from the cached IPTV
          // playlists; play straight from the card.
          if (live.isNotEmpty) ...[
            const SizedBox(height: 32),
            _LiveHits(hits: live, tokens: tokens, tr: tr, onPlay: onPlayChannel),
          ],
        ],
      ),
    );
  }
}

/// The Live-TV channel results row — a titled horizontal strip of channel cards
/// (logo + name + source), each playing on tap. Ports web `LiveTvRow`.
class _LiveHits extends StatelessWidget {
  const _LiveHits({
    required this.hits,
    required this.tokens,
    required this.tr,
    required this.onPlay,
  });

  final List<({IptvChannel channel, String playlistName})> hits;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(IptvChannel) onPlay;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tr.t('Live TV').toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 128,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: hits.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final ch = hits[i].channel;
              return Focusable(
                tokens: t,
                borderRadius: 12,
                autofocus: i == 0,
                onPressed: () => onPlay(ch),
                child: Container(
                  width: 200,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: t.elevated,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: t.edgeSoft),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: t.surface,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: (ch.logo?.isNotEmpty ?? false)
                            ? Padding(
                                padding: const EdgeInsets.all(4),
                                child: Image.network(
                                  ch.logo!,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, _, _) => Icon(
                                    Icons.live_tv_outlined,
                                    color: t.inkSubtle,
                                    size: 22,
                                  ),
                                ),
                              )
                            : Icon(
                                Icons.live_tv_outlined,
                                color: t.inkSubtle,
                                size: 22,
                              ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              ch.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: t.ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                height: 1.1,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              hits[i].playlistName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: t.inkSubtle,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// The "Browse {year|genre}" prompt shown above the results for a bare-year or
/// genre-name query, opening the corresponding browse filter. Ported from the
/// search-overlay intent button.
class _IntentPrompt extends StatelessWidget {
  const _IntentPrompt({
    required this.intent,
    required this.tokens,
    required this.onTap,
  });

  final SearchIntent intent;
  final HarborTokens tokens;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 16,
      onPressed: onTap,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: t.accentSoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.accent.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                intent.kind == 'year' ? Icons.date_range : Icons.tag,
                size: 16,
                color: t.accent,
              ),
            ),
            const SizedBox(width: 12),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BROWSE',
                  style: TextStyle(
                    color: t.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.8,
                  ),
                ),
                Text(
                  intent.label,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Icon(Icons.subdirectory_arrow_left, size: 16, color: t.inkSubtle),
          ],
        ),
      ),
    );
  }
}

class _PeopleRow extends StatelessWidget {
  const _PeopleRow({
    required this.people,
    required this.tokens,
    required this.onOpen,
  });

  final List<SearchPerson> people;
  final HarborTokens tokens;
  final void Function(int) onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12, left: 4),
          child: Text(
            'PEOPLE',
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
        ),
        SizedBox(
          height: 176,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: people.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, i) =>
                  _PersonCard(person: people[i], tokens: t, onOpen: onOpen),
            ),
          ),
        ),
      ],
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({
    required this.person,
    required this.tokens,
    required this.onOpen,
  });

  final SearchPerson person;
  final HarborTokens tokens;
  final void Function(int) onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final photo = person.profile != null
        ? 'https://image.tmdb.org/t/p/h632${person.profile}'
        : null;
    return SizedBox(
      width: 132,
      child: Focusable(
        tokens: t,
        borderRadius: 16,
        onPressed: () => onOpen(person.id),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipOval(
              child: SizedBox(
                width: 110,
                height: 110,
                child: photo == null
                    ? ColoredBox(
                        color: t.elevated,
                        child: Icon(
                          Icons.person_rounded,
                          size: 40,
                          color: t.inkSubtle,
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: photo,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => ColoredBox(color: t.elevated),
                        errorWidget: (_, _, _) => ColoredBox(
                          color: t.elevated,
                          child: Icon(
                            Icons.person_rounded,
                            size: 40,
                            color: t.inkSubtle,
                          ),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              person.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: t.ink,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              person.knownFor,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkSubtle, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopMatchCard extends StatelessWidget {
  const _TopMatchCard({
    required this.match,
    required this.tokens,
    required this.tr,
    required this.onOpen,
  });

  final SearchTopMatch match;
  final HarborTokens tokens;
  final Translations tr;
  final void Function(MetaPreview) onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final meta = match.meta;
    final phone = Idiom.of(context).isPhone;
    final year = meta.releaseInfo ?? '';
    final rating = (match.voteAverage ?? 0) > 0
        ? match.voteAverage!.toStringAsFixed(1)
        : null;
    final synopsis = (match.overview ?? meta.description ?? '').trim();

    return Focusable(
      tokens: t,
      autofocus: true,
      borderRadius: 24,
      scale: 1.01,
      onPressed: () => onOpen(meta),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Container(
          decoration: BoxDecoration(
            color: t.elevated,
            border: Border.all(color: t.edgeSoft),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Stack(
            children: [
              if (match.backdrop != null)
                Positioned.fill(
                  child: ImageFiltered(
                    imageFilter: ui.ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                    child: Opacity(
                      opacity: 0.32,
                      child: CachedNetworkImage(
                        imageUrl: match.backdrop!,
                        fit: BoxFit.cover,
                        alignment: const Alignment(0, -0.4),
                        errorWidget: (_, _, _) => const SizedBox.shrink(),
                      ),
                    ),
                  ),
                ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        t.canvas.withValues(alpha: 0.95),
                        t.canvas.withValues(alpha: 0.6),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.all(phone ? 18 : 28),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: SizedBox(
                        width: phone ? 96 : 160,
                        height: phone ? 144 : 240,
                        child: _poster(meta, t),
                      ),
                    ),
                    SizedBox(width: phone ? 16 : 28),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TOP MATCH',
                            style: TextStyle(
                              color: t.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 2.4,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            meta.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: t.ink,
                              fontSize: phone ? 24 : 34,
                              height: 1.05,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _metaLine(year, rating, t),
                          if (synopsis.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            Text(
                              synopsis,
                              maxLines: 4,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: t.inkMuted,
                                fontSize: 14.5,
                                height: 1.5,
                              ),
                            ),
                          ],
                          const SizedBox(height: 18),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 18,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: t.accent,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.play_arrow_rounded,
                                      color: t.canvas,
                                      size: 22,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      tr.t('Open'),
                                      style: TextStyle(
                                        color: t.canvas,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
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

  Widget _metaLine(String year, String? rating, HarborTokens t) {
    final parts = <Widget>[
      Text(
        match.kind == 'movie' ? tr.t('Movie') : tr.t('Series'),
        style: TextStyle(
          color: t.inkMuted,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ];
    if (year.isNotEmpty) {
      parts
        ..add(_dot(t))
        ..add(Text(year, style: TextStyle(color: t.inkMuted, fontSize: 14)));
    }
    if (rating != null) {
      parts
        ..add(_dot(t))
        ..add(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.star_rounded, size: 15, color: t.accent),
              const SizedBox(width: 4),
              Text(rating, style: TextStyle(color: t.ink, fontSize: 14)),
            ],
          ),
        );
    }
    // Wrap (rather than a fixed Row) so the type · year · rating line reflows
    // instead of overflowing the narrower text column on a phone.
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: parts,
    );
  }
}

class _MetaList extends StatelessWidget {
  const _MetaList({
    required this.title,
    required this.items,
    required this.tokens,
    required this.onOpen,
  });

  final String title;
  final List<MetaPreview> items;
  final HarborTokens tokens;
  final void Function(MetaPreview) onOpen;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12, left: 4),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
        ),
        for (final m in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: _MetaRow(meta: m, tokens: t, onOpen: onOpen),
          ),
      ],
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.meta,
    required this.tokens,
    required this.onOpen,
  });

  final MetaPreview meta;
  final HarborTokens tokens;
  final void Function(MetaPreview) onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final year = meta.releaseInfo ?? '';
    final rating = meta.imdbRating;
    final description = (meta.description ?? '').trim();

    return Focusable(
      tokens: t,
      borderRadius: 16,
      scale: 1.02,
      onPressed: () => onOpen(meta),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(width: 64, height: 96, child: _poster(meta, t)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    meta.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      if (year.isNotEmpty)
                        Text(
                          year,
                          style: TextStyle(color: t.inkMuted, fontSize: 12.5),
                        ),
                      if (year.isNotEmpty && rating != null) _dot(t),
                      if (rating != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 13, color: t.accent),
                            const SizedBox(width: 3),
                            Text(
                              '$rating',
                              style: TextStyle(color: t.ink, fontSize: 12.5),
                            ),
                          ],
                        ),
                    ],
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.inkSubtle,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _dot(HarborTokens t) => Padding(
  padding: const EdgeInsets.symmetric(horizontal: 8),
  child: Container(
    width: 4,
    height: 4,
    decoration: BoxDecoration(color: t.inkSubtle, shape: BoxShape.circle),
  ),
);

Widget _poster(MetaPreview meta, HarborTokens t) => RpdbPosterImage(
  metaId: meta.id,
  rawPoster: meta.poster,
  type: meta.type,
  tokens: t,
  fallback: () => ColoredBox(
    color: t.surface,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Text(
          meta.name,
          textAlign: TextAlign.center,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: t.inkSubtle, fontSize: 11),
        ),
      ),
    ),
  ),
);
