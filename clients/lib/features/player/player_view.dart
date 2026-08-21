import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chrome_cast/entities.dart';
import 'package:flutter_chrome_cast/enums.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/anilist_providers.dart';
import '../../app/download_providers.dart';
import '../../app/feed_providers.dart';
import '../../app/mal_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../app/sfx_providers.dart';
import '../../design/harbor_loader.dart';
import '../../design/layout/idiom.dart';
import '../../app/simkl_providers.dart';
import '../../app/stremio_auth.dart';
import '../../app/theme_controller.dart';
import '../../app/trakt_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/css_color.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/discover/affinity.dart' show EventKind;
import '../../domain/discover/discover_store.dart' show AffinityStore;
import '../../domain/discover/profile.dart' show profileFromMeta;
import '../../domain/language/language_names.dart';
import '../../domain/library/local_cw.dart';
import '../../domain/library/playback_history.dart';
import '../../domain/anime/anime_detail.dart' show isAnimeId;
import '../../domain/player/audio_track_select.dart';
import '../../domain/player/crop_modes.dart';
import '../../domain/player/mpv_options.dart';
import '../../domain/nav/frame.dart';
import '../../domain/player/adjacent_episodes.dart';
import '../../domain/player/sleep_timer.dart';
import '../../domain/player/motion_interp.dart';
import '../../domain/player/anime4k_apply.dart';
import '../../domain/player/anime4k_modes.dart';
import '../../domain/player/player_bridge.dart' show ScreenshotResult;
import '../../domain/player/player_models.dart';
import '../../domain/player/resolution_label.dart';
import 'airplay_button.dart';
import 'episodes_panel.dart';
import 'speed_picker.dart';
import 'subtitle_picker.dart';
import 'airplay_state.dart';
import 'cast_button.dart';
import 'cast_controller.dart';
import 'now_playing.dart';
import 'pip_service.dart';
import 'seek_bar.dart';
import '../../domain/downloads/download_engine.dart';
import '../../domain/downloads/downloads_store.dart';
import '../../domain/player/local_source.dart';
import '../../domain/player/subtitle_style.dart';
import '../../domain/resume/resume_autosave.dart';
import '../../domain/settings/seek_step.dart';
import '../../domain/simkl/simkl_scrobble.dart';
import '../../domain/skip/ad_fingerprint.dart';
import '../../domain/skip/ad_report_visibility.dart';
import '../../domain/skip/ad_window.dart';
import '../../domain/skip/skip_segment.dart';
import '../../domain/stremio/library_write.dart';
import '../../domain/subtitles/models.dart';
import '../../domain/subtitles/parser.dart';
import '../../domain/trakt/trakt_ids.dart';
import '../../domain/trakt/trakt_scrobbler.dart';
import '../../domain/subtitles/subtitle_search.dart';
import '../../app/iptv_providers.dart';
import 'anime4k_indicator.dart';
import 'flutter_player_bridge.dart';
import 'immersive_orientation.dart';
import 'media_kit_bridge.dart';
import 'video_player_bridge.dart';
import 'player_providers.dart';
import 'sub_sync_bar.dart';
import 'sync_toast.dart';
import 'subtitle_overlay.dart';

/// The fullscreen player, ported from `views/player.tsx` (`docs/50` §4–5). Hosts
/// the engine's video surface plus auto-hiding chrome (title, seek bar,
/// play/pause) and maps the D-pad / media remote to transport actions.
class PlayerView extends ConsumerStatefulWidget {
  const PlayerView({
    super.key,
    required this.url,
    this.title,
    this.headers,
    this.subtitles = const [],
    this.startAtSec,
    this.isLive = false,
    this.notWebReady = false,
    this.contentId,
    this.contentType,
    this.season,
    this.episode,
    this.sourceInfoHash,
    this.sourceUrl,
    this.sourceAddonId,
    this.sourceBingeGroup,
    this.sourceResolution,
    this.sourceSourceKind,
    this.sourceFileIdx,
    this.sourceReleaseGroup,
    this.sourceSize,
    this.sourceParsedTitle,
    this.releaseInfo,
    this.subtitlePreselectOff = false,
    this.subtitlePreselectUrl,
    this.subtitlePreselectLang,
    this.subtitlePreselectTitle,
  });

  final String url;
  final String? title;
  final Map<String, String>? headers;
  final List<SourceSubtitle> subtitles;
  final double? startAtSec;
  final bool isLive;
  final bool notWebReady;

  /// The meta id (`tt…`, `kitsu:…`) this stream plays, for resume keying.
  final String? contentId;

  /// `movie` or `series` — for continue-watching enrichment.
  final String? contentType;
  final int? season;
  final int? episode;

  /// The picked source's identity (its info-hash, original stream url, and
  /// addon), recorded to playback history so the source list can mark it as
  /// last-played next time. Null when playing a local download.
  final String? sourceInfoHash;
  final String? sourceUrl;
  final String? sourceAddonId;

  /// The looser "source profile" (binge-group / resolution / source name)
  /// recorded so "keep source for next episode" can carry it forward.
  final String? sourceBingeGroup;
  final String? sourceResolution;
  final String? sourceSourceKind;

  /// Extra source identity + release year used to fingerprint the source for
  /// the injected-ad corpus and to gate the ad window.
  final int? sourceFileIdx;
  final String? sourceReleaseGroup;
  final int? sourceSize;
  final String? sourceParsedTitle;
  final String? releaseInfo;

  /// The viewer's pre-play subtitle choice (web `subtitlePreselect`): when
  /// [subtitlePreselectOff] no subtitle auto-selects; when a URL is given that
  /// exact track is loaded and selected instead of the auto-pick.
  final bool subtitlePreselectOff;
  final String? subtitlePreselectUrl;
  final String? subtitlePreselectLang;
  final String? subtitlePreselectTitle;

  @override
  ConsumerState<PlayerView> createState() => _PlayerViewState();
}

/// The subtitle-picker label for an embedded/engine [track]: its language (or
/// its label / a `Track <id>` fallback), with Forced / SDH / Default tags.
String subtitleTrackLabel(TrackInfo track) {
  final base = (track.lang != null && track.lang!.isNotEmpty)
      ? languageName(track.lang!)
      : (track.label.isNotEmpty ? track.label : 'Track ${track.id}');
  final tags = <String>[
    if (track.forced) 'Forced',
    if (track.hearingImpaired) 'SDH',
    if (track.isDefault) 'Default',
  ];
  return tags.isEmpty ? base : '$base · ${tags.join(' · ')}';
}

const _mediaSeekSec = 30.0;
// Chrome auto-hide delays, ported from player-utils CHROME_HIDE_MS_*: quick
// while playing, longer while paused, quickest right after a tap-to-resume.
const _chromeHidePlaying = Duration(milliseconds: 1800);
const _chromeHidePaused = Duration(milliseconds: 4500);
const _chromeHideResume = Duration(milliseconds: 1000);

class _PlayerViewState extends ConsumerState<PlayerView> {
  late FlutterPlayerBridge _bridge;

  /// The source being played, kept so the libmpv fallback can re-open it.
  PlayerSource? _source;

  /// Set once the native default engine has been retried on libmpv, so the
  /// fallback fires at most once.
  bool _triedMpvFallback = false;
  late void Function() _unsub;
  final FocusNode _focusNode = FocusNode();

  /// The play/pause control's focus node — on a TV the D-pad lands here when the
  /// chrome wakes, so the remote can immediately move between the controls.
  final FocusNode _playPauseFocus = FocusNode(debugLabel: 'playerPlayPause');

  /// Whether this is the ten-foot (TV) idiom, where the D-pad must drive focus
  /// between the on-screen controls instead of hijacking every key for
  /// seek/volume/play.
  bool get _isTv => kPlatformIsTv == true;
  final NowPlayingService _nowPlaying = NowPlayingService();
  PlayerSnapshot _snap = PlayerSnapshot.empty;
  PlayerStatus _lastStatus = PlayerStatus.idle;

  /// The last (status, duration) pushed to the OS now-playing center, so it
  /// updates on real state changes rather than every frame.
  String _npKey = '';

  /// Chromecast: the session subscription, whether a receiver is playing this
  /// title, and the receiver's name (shown in the casting overlay).
  StreamSubscription<GoogleCastSession?>? _castSub;
  bool _casting = false;
  bool _castPaused = false;
  String _castDevice = '';

  /// The previewed second while the user drags the seek bar (null when not
  /// scrubbing) — the time label tracks it.
  double? _scrubSec;

  /// The A–B repeat marks; the player loops between them.
  bool _chromeVisible = true;

  /// The playback-stats overlay toggle (`playerStats`, the "i" hotkey).
  bool _showStats = false;

  /// Whether the live subtitle-sync bar is showing (opened from the subtitle
  /// menu). Its buttons nudge [_subDelay] while the video plays.
  bool _showSyncBar = false;

  /// Whether the two-pane subtitle picker overlay is open, and whether a
  /// subtitle search is running (drives the picker's loading state).
  bool _subtitleMenuOpen = false;
  bool _searchingSubs = false;

  /// Whether the in-player episode panel (the "Up Next" drawer, "e" key) is open.
  bool _episodePanelOpen = false;

  /// Whether the playback-speed picker overlay is open.
  bool _speedMenuOpen = false;

  /// Auto-next-episode guards (ported from `use-auto-next-episode` /
  /// `use-started-near-end`): whether playback began near the end (so finishing
  /// it must not immediately advance), whether that was captured yet, and the
  /// source URL auto-next has already fired for (fire once per episode).
  bool _startedNearEnd = false;
  bool _startedNearEndCaptured = false;
  String? _autoNextFiredUrl;

  /// Set when the viewer dismisses the next-episode countdown, which hides the
  /// pill and suppresses the auto-advance for the rest of the episode.
  bool _autoNextCancelled = false;

  /// Sleep timer: the 1s ticker for a minutes deadline, the live remaining time
  /// (for the transport countdown), the url a sleep episode-end already fired
  /// for (once per episode), and the url a sleep timer paused (suppresses the
  /// auto-advance for that episode).
  Timer? _sleepTicker;
  Duration? _sleepRemaining;
  String? _sleepEndFiredUrl;
  String? _sleepPausedUrl;

  /// The audio-track-set signature last auto-selected against, so the language
  /// preference is applied once per track set (not on every position tick).
  String? _autoAudioKey;

  /// The subtitle-track-set signature the subtitles-off default was applied to,
  /// so an embedded sub is cleared once on load (never fighting a later manual
  /// enable, which clientv2 keeps until the next media).
  String? _subsOffKey;

  /// Set when the user taps to resume, so the next hide uses the shorter resume
  /// delay (consumed by [_scheduleHide]).
  bool _resumeHide = false;

  /// Captured up front so the finished-write is safe from the teardown save,
  /// where the widget's own `ref` is no longer usable.
  late final ManualWatchedController _manualWatched;
  late final RecentlyPlayedController _recentlyPlayed;
  late final LocalCwStore _localCw;
  late final PlaybackHistoryStore _playbackHistory;
  late final AffinityStore _affinityStore;

  /// The `id|kind` affinity signals already taught this session (once each).
  final Set<String> _taughtAffinity = {};

  /// Anime ids already marked "watching" on MyAnimeList this session, and the
  /// `id|episode` pairs whose progress has been pushed — each fires once.
  final Set<String> _malMarkedWatching = {};
  final Set<String> _malSyncedEpisodes = {};

  /// The same one-shot guards for the AniList progress sync.
  final Set<String> _anilistMarkedWatching = {};
  final Set<String> _anilistSyncedEpisodes = {};
  Timer? _hideTimer;
  Timer? _autosaveTimer;
  ResumeAutosave? _autosave;

  /// Pushes progress to the signed-in Stremio account (null when signed out or
  /// the id isn't cloud-writable). Held for the whole playback session.
  StremioCwWriter? _cwWriter;

  /// Scrobbles playback to the connected Trakt account (null when Trakt is not
  /// connected or the id doesn't map to a Trakt target). Per playback session.
  TraktScrobbler? _scrobbler;

  /// Scrobbles playback to the connected Simkl account (null when Simkl is not
  /// connected or the id can't be scrobbled). Per playback session.
  SimklScrobbler? _simklScrobbler;

  /// True once teardown has begun, so the final save writes a terminal cloud
  /// position (credits reset for a finished movie) even though the status may
  /// still read "playing".
  bool _disposing = false;
  List<SubResult> _availableSubs = const [];
  int _subIndex = -1; // -1 = off

  /// Parsed cues for the selected external subtitle, drawn by [SubtitleOverlay]
  /// on the default engine (the advanced engine renders subs itself). Empty when
  /// off or on the advanced engine.
  List<SubCue> _externalCues = const [];
  int _cuesToken = 0;

  /// The default (platform-video) engine renders no external subtitles, so it
  /// needs the [SubtitleOverlay]; the advanced (libmpv) engine draws its own.
  bool get _defaultEngine => _bridge is! MediaKitBridge;
  Meta? _meta;

  // The pending resume position (seconds) while the resume prompt is shown.
  double? _pendingResumeSec;

  // The volume HUD flash overlay.
  bool _volumeHudVisible = false;
  Timer? _volumeHudTimer;

  // The aspect/crop cycle: the current mode index and Zoom level.
  int _cropIndex = 0;
  double _zoom = 0;

  // The current subtitle timing offset (seconds), stepped by z/x.
  double _subDelay = 0;

  /// Audio/video sync offset (seconds) and whether the shared sync bar is
  /// currently editing it (vs. the subtitle delay).
  double _audioDelay = 0;
  bool _syncBarIsAudio = false;

  // A transient centered pill (aspect change, playback speed) with its icon.
  String? _hudPill;
  IconData _hudPillIcon = Icons.aspect_ratio;
  Timer? _hudPillTimer;

  // Skip-intro / recap / outro / ad.
  List<SkipSegment> _skipSegments = const [];
  bool _skipFetched = false;
  bool _skipFetching = false;
  String? _autoSkippedKey;
  final Set<String> _dismissedSkips = {};

  @override
  void initState() {
    super.initState();
    enterImmersiveLandscape();
    _manualWatched = ref.read(manualWatchedProvider.notifier);
    _recentlyPlayed = ref.read(recentlyPlayedProvider.notifier);
    _localCw = ref.read(localCwStoreProvider);
    _playbackHistory = ref.read(playbackHistoryStoreProvider);
    _affinityStore = ref.read(affinityStoreProvider);
    var startAt = widget.startAtSec;
    if (widget.contentId != null) {
      final store = ref.read(resumeStoreProvider);
      _autosave = ResumeAutosave(
        store,
        id: widget.contentId!,
        season: widget.season,
        episode: widget.episode,
      );
      if (!widget.isLive && !widget.contentId!.startsWith('iptv:')) {
        _cwWriter = ref.read(stremioCwSyncProvider).session(widget.contentId!);
        _initScrobbler();
        _initSimklScrobbler();
      }
      final s = ref.read(settingsProvider);
      if (s.getBool('resumePlayback') && !widget.isLive) {
        final ms = store.readResumeMs(
          widget.contentId!,
          widget.season,
          widget.episode,
        );
        final resumeSec = ms / 1000;
        // resumePrompt (> 30s): start at 0 and prompt Resume / Start Over
        // instead of auto-resuming. Ported from use-bridge-load.
        if (resumeSec > 30 && s.getBool('resumePrompt')) {
          _pendingResumeSec = resumeSec;
        } else if (ms > 5000) {
          startAt = resumeSec;
        }
      }
    }

    final source = PlayerSource(
      url: widget.url,
      headers: widget.headers,
      subtitles: widget.subtitles,
      startAtSec: startAt,
      isLive: widget.isLive,
      notWebReady: widget.notWebReady,
    );
    _source = source;
    _nowPlaying.onCommand = _handleRemoteCommand;
    _nowPlaying.start();
    _attachBridge(ref.read(playerBridgeFactoryProvider)(source));
    if (_bridge.capabilities().chromecast) {
      _castSub = ref
          .read(castControllerProvider)
          .sessionStream
          .listen(_onCastSession);
    }
    if (widget.contentId != null && widget.contentType != null) {
      ref
          .read(
            metaProvider((
              type: widget.contentType!,
              id: widget.contentId!,
            )).future,
          )
          .then((m) {
            // Rebuild so the episode-navigation controls appear once the
            // series' episode list is known.
            if (mounted) setState(() => _meta = m);
          })
          .catchError((_) => null);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadBridge(source);
    });
    _scheduleHide();
    _autosaveTimer = Timer.periodic(
      const Duration(milliseconds: ResumeAutosave.tickMs),
      (_) => _saveResume(force: false),
    );
    // Resume the transport countdown for a minutes sleep armed on an earlier
    // episode (the timer lives in a provider, so it survives this remount).
    _syncSleepTicker();
  }

  /// Wires [bridge] as the active engine: AB-loop clock listener + the snapshot
  /// subscription. Called for the initial engine and again on the libmpv
  /// fallback.
  void _attachBridge(FlutterPlayerBridge bridge) {
    _bridge = bridge;
    _unsub = _bridge.subscribe(_onSnapshot);
  }

  /// Configures the engine's render/audio options from settings and loads
  /// [source], then plays (unless a resume prompt is pending) and autoloads
  /// subtitles. Reused by the initial open and the libmpv fallback.
  Future<void> _loadBridge(PlayerSource source) async {
    final settings0 = ref.read(settingsProvider);
    final normalizeAudio = settings0.getBool('audioNormalize');
    final audioProfile = settings0.getString('audioProfile');
    final crop = cropModeById(settings0.getString('cropMode'));
    _cropIndex = kCropModes.indexOf(crop);
    final hwdec = settings0.getString('mpvHwdec');
    // The compiled render options, with frame-interpolation ("motion smoothing")
    // merged last so the `playerMotionInterp` toggle overrides the quality
    // preset's interpolation choice — the web applies it in a later effect.
    final mpvOptions = <String, String>{
      ...compileMpvOptions(settings0),
      ...motionInterpProps(settings0.getBool('playerMotionInterp')),
    };
    // Configure hardware decoding + the compiled mpv options (advanced engine)
    // before the media loads.
    _bridge.setHwdec(hwdec);
    _bridge.setMpvOptions(mpvOptions);
    await _bridge.load(source);
    // Loudness normalizer + shaping profile (advanced engine) applied once the
    // media loads; both share the mpv audio-filter chain.
    _bridge.setAudioNormalize(normalizeAudio);
    _bridge.setAudioProfile(audioProfile);
    // Default picture shape (aspect ratio) from the saved crop mode.
    _applyCrop(crop);
    // Anime4K upscaling shaders (advanced engine only) for the current
    // override/mode; re-applied as the source resolution becomes known.
    _applyAnime4k();
    // With a pending resume prompt, stay paused until the user chooses.
    if (_pendingResumeSec == null) await _bridge.play();
    await _autoloadSubtitles();
  }

  /// The engine snapshot listener. When the native default engine (AVPlayer /
  /// ExoPlayer) reports a fatal error — most often a container/codec it cannot
  /// open (MKV, HEVC profiles, …) — retry once on libmpv, which plays far more.
  /// Gated to the real [VideoPlayerBridge] so a fake test bridge never trips it.
  void _onSnapshot(PlayerSnapshot s) {
    if (!mounted) return;
    if (s.status == PlayerStatus.error &&
        !_triedMpvFallback &&
        _bridge is VideoPlayerBridge) {
      _fallbackToMpv();
      return;
    }
    setState(() => _snap = s);
    _syncNowPlaying(s);
    // Let Android auto-enter PiP on Home/recents only while actually playing.
    if (Platform.isAndroid) {
      _pip.setPlaying(s.status == PlayerStatus.playing);
    }
    if (s.status == PlayerStatus.playing) {
      if (_chromeVisible) _scheduleHide();
    } else if (s.status == PlayerStatus.paused && _chromeVisible) {
      // By default the paused controls linger (the longer paused delay); with
      // keyboardPauseShowsControls off, pausing hides them at once.
      if (ref.read(settingsProvider).getBool('keyboardPauseShowsControls')) {
        _scheduleHide();
      } else {
        _hideTimer?.cancel();
        setState(() => _chromeVisible = false);
      }
    }
    _captureStartedNearEnd(s);
    _maybeSleepOnEnd(s); // before auto-next, so a sleep can suppress it
    _maybeAutoNext(s);
    _onStatus(s.status);
    _maybeAutoSelectAudio(s);
    _maybeReapplyAnime4k(s);
    _maybeApplySubsOff(s);
    _maybeFetchSkip();
    _evaluateAutoSkip();
  }

  /// Tears down the failed native engine and re-opens [_source] on libmpv (the
  /// codec-breadth fallback). Fires at most once per player.
  void _fallbackToMpv() {
    final source = _source;
    if (source == null) return;
    _triedMpvFallback = true;
    _unsub();
    _bridge.destroy();
    // Show the loading state during the switch, not the error.
    setState(() => _snap = const PlayerSnapshot(status: PlayerStatus.loading));
    _attachBridge(MediaKitBridge());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadBridge(source);
    });
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _volumeHudTimer?.cancel();
    _hudPillTimer?.cancel();
    _autosaveTimer?.cancel();
    // Stop the countdown ticker; the armed sleep mode itself lives in the
    // provider and survives to the next episode.
    _sleepTicker?.cancel();
    // The player is gone — never auto-enter PiP for it after this.
    if (Platform.isAndroid) _pip.setPlaying(false);
    _disposing = true;
    _saveResume(force: true); // force a final save before teardown
    _scrobbler?.finalize(_snap.durationSec);
    _simklScrobbler?.finalize(_snap.durationSec);
    // Surface the just-recorded playback to the Home hide-watched filter.
    _recentlyPlayed.refresh();
    _nowPlaying.clear();
    exitImmersiveLandscape();
    _castSub?.cancel();
    _unsub();
    _bridge.destroy();
    _focusNode.dispose();
    _playPauseFocus.dispose();
    super.dispose();
  }

  /// Pushes now-playing metadata to the OS media session when the playback state
  /// or duration changes (position is interpolated by the OS from the rate).
  void _syncNowPlaying(PlayerSnapshot s) {
    final key = '${s.status}/${s.durationSec.round()}';
    if (key == _npKey) return;
    _npKey = key;
    _pushNowPlaying();
  }

  void _pushNowPlaying({double? positionOverride}) {
    final s = _snap;
    if (s.status == PlayerStatus.idle || s.status == PlayerStatus.loading) {
      return;
    }
    _nowPlaying.update(
      NowPlayingInfo(
        title: widget.title ?? '',
        subtitle: widget.season != null && widget.episode != null
            ? 'S${widget.season} · E${widget.episode}'
            : null,
        durationSec: s.durationSec,
        positionSec: positionOverride ?? _bridge.clock.positionSec,
        playing: s.status == PlayerStatus.playing,
      ),
    );
  }

  /// Dispatches an OS media-session transport command to the player.
  void _handleRemoteCommand(RemoteCommandEvent event) {
    switch (event.command) {
      case RemoteCommand.play:
        _bridge.play();
      case RemoteCommand.pause:
        _bridge.pause();
      case RemoteCommand.toggle:
        _togglePlay();
      case RemoteCommand.seekForward:
        _seekBy(10);
      case RemoteCommand.seekBackward:
        _seekBy(-10);
      case RemoteCommand.next:
        final nav = _episodeNav();
        if (nav.next != null) {
          _goToEpisode(nav.next!);
        }
      case RemoteCommand.previous:
        final nav = _episodeNav();
        if (nav.prev != null) {
          _goToEpisode(nav.prev!);
        }
      case RemoteCommand.seekTo:
        final pos = event.positionSec;
        if (pos != null) {
          _bridge.seek(pos);
          _pushNowPlaying(positionOverride: pos);
        }
    }
  }

  /// Reacts to Cast session changes: hand playback to a newly-connected receiver,
  /// or resume locally when it disconnects.
  void _onCastSession(GoogleCastSession? session) {
    if (!mounted) return;
    final connected =
        session?.connectionState == GoogleCastConnectState.connected;
    if (connected && !_casting) {
      _startCasting(session!);
    } else if (!connected && _casting) {
      _resumeLocal();
    }
  }

  void _startCasting(GoogleCastSession session) {
    final atSec = _bridge.clock.positionSec;
    _bridge.pause();
    ref
        .read(castControllerProvider)
        .loadSource(
          PlayerSource(
            url: widget.url,
            headers: widget.headers,
            subtitles: widget.subtitles,
            isLive: widget.isLive,
          ),
          title: widget.title,
          startAtSec: atSec,
        );
    setState(() {
      _casting = true;
      _castPaused = false;
      _castDevice = session.device?.friendlyName ?? '';
    });
    _wakeChrome();
  }

  void _resumeLocal() {
    if (!mounted) return;
    setState(() => _casting = false);
    _bridge.play();
    _wakeChrome();
  }

  void _toggleCastPlay() {
    final cast = ref.read(castControllerProvider);
    if (_castPaused) {
      cast.play();
    } else {
      cast.pause();
    }
    setState(() => _castPaused = !_castPaused);
  }

  void _onStatus(PlayerStatus status) {
    // Force a save when leaving the playing state (pause/ended/error).
    if (_lastStatus == PlayerStatus.playing && status != PlayerStatus.playing) {
      _saveResume(force: true);
    }
    final scrobbleStatus = _scrobbleStatus(status);
    _scrobbler?.onStatus(scrobbleStatus, _snap.durationSec);
    _simklScrobbler?.onStatus(scrobbleStatus, _snap.durationSec);
    _lastStatus = status;
  }

  void _saveResume({required bool force}) {
    final save = _autosave;
    if (save == null) return;
    if (!force && _snap.status != PlayerStatus.playing) return;
    final pos = _bridge.clock.positionSec;
    final dur = _snap.durationSec;
    save.maybeSave(positionSec: pos, durationSec: dur, force: force);
    _saveContinueWatching(pos, dur);
    _saveStremioCw(pos, dur, force: force);
    _scrobbler?.tick(dur);
    _simklScrobbler?.tick(dur);
    _maybeMarkWatched(save, pos, dur);
    _teachAffinity(save, pos, dur);
    _maybeSyncMalAnime(save, pos, dur);
    _maybeSyncAnilistAnime(save, pos, dur);
  }

  /// Pushes anime watch state to MyAnimeList (`malAutoSync`): mark the title
  /// "watching" once it is under way, and set the episode's progress once it
  /// finishes. Fire-and-forget, deduped per session. Ported from the anime-sync
  /// calls in `use-resume-autosave.ts`.
  void _maybeSyncMalAnime(ResumeAutosave save, double pos, double dur) {
    final id = widget.contentId;
    if (id == null || pos <= 0 || !isAnimeId(id)) return;
    if (!ref.read(settingsProvider).getBool('malAutoSync')) return;
    final sync = ref.read(malAnimeSyncProvider);
    if (_malMarkedWatching.add(id)) {
      unawaited(sync.markWatching(id, widget.title ?? ''));
    }
    final finished = save.isFinished(
      positionSec: pos,
      durationSec: dur,
      ended: _snap.status == PlayerStatus.ended,
    );
    if (!finished) return;
    final episode = widget.episode ?? 1;
    if (_malSyncedEpisodes.add('$id|$episode')) {
      unawaited(
        sync.syncProgress(
          harborId: id,
          episode: episode,
          title: widget.title ?? '',
        ),
      );
    }
  }

  /// The AniList counterpart of [_maybeSyncMalAnime], gated on `anilistAutoSync`.
  void _maybeSyncAnilistAnime(ResumeAutosave save, double pos, double dur) {
    final id = widget.contentId;
    if (id == null || pos <= 0 || !isAnimeId(id)) return;
    if (!ref.read(settingsProvider).getBool('anilistAutoSync')) return;
    final sync = ref.read(anilistAnimeSyncProvider);
    if (_anilistMarkedWatching.add(id)) {
      unawaited(sync.markWatching(id, widget.title ?? ''));
    }
    final finished = save.isFinished(
      positionSec: pos,
      durationSec: dur,
      ended: _snap.status == PlayerStatus.ended,
    );
    if (!finished) return;
    final episode = widget.episode ?? 1;
    if (_anilistSyncedEpisodes.add('$id|$episode')) {
      unawaited(
        sync.syncProgress(
          harborId: id,
          episode: episode,
          title: widget.title ?? '',
        ),
      );
    }
  }

  /// Feeds the taste affinity from playback: a `play` signal once a title is
  /// under way, upgraded to a stronger `watched` when it finishes. Ported from
  /// the `trackEvent(play|watched)` teach in `use-resume-autosave.ts`.
  void _teachAffinity(ResumeAutosave save, double pos, double dur) {
    final id = widget.contentId;
    final meta = _meta;
    if (id == null || id.startsWith('iptv:') || meta == null || pos <= 0) {
      return;
    }
    final finished = save.isFinished(
      positionSec: pos,
      durationSec: dur,
      ended: _snap.status == PlayerStatus.ended,
    );
    final kind = finished ? EventKind.watched : EventKind.play;
    if (!_taughtAffinity.add('$id|${kind.wire}')) return;
    _affinityStore.trackEvent(
      id,
      kind,
      meta: profileFromMeta(MetaPreview(meta.json)),
    );
  }

  /// Builds the Trakt scrobbler for this session when connected and the id maps
  /// to a Trakt target (movies + IMDb/TMDB series episodes; anime and
  /// unrecognized ids are skipped).
  void _initScrobbler() {
    if (!ref.read(traktConnectedProvider)) return;
    final id = widget.contentId!;
    final episodeRef = (widget.season != null && widget.episode != null)
        ? TraktEpisodeRef(season: widget.season!, episode: widget.episode!)
        : null;
    final target = stremioIdToTraktTarget(id, episode: episodeRef).target;
    if (target == null) return;
    final client = ref.read(traktClientProvider);
    _scrobbler = TraktScrobbler(
      pauseOnPause: ref
          .read(settingsProvider)
          .getBool('pauseListStatusOnPause'),
      positionSec: () => _bridge.clock.positionSec,
      send: (action, progress) {
        switch (action) {
          case 'start':
            client.scrobbleStart(target, progress);
          case 'pause':
            client.scrobblePause(target, progress);
          default:
            client.scrobbleStop(target, progress);
        }
      },
    );
  }

  /// Builds the Simkl scrobbler for this session when connected and the id is
  /// scrobblable (movies, IMDb/TMDB episodes, and anime episodes).
  void _initSimklScrobbler() {
    if (!ref.read(simklConnectedProvider)) return;
    // Web gates scrobbling on the Simkl "Scrobble to SIMKL" preference.
    if (!ref.read(settingsProvider).getBool('simklScrobbleEnabled')) return;
    final id = widget.contentId!;
    // Nothing to scrobble if the id never builds a body (verify with a probe).
    if (buildSimklScrobbleBody(
          id,
          season: widget.season,
          episode: widget.episode,
          progress: 0,
        ) ==
        null) {
      return;
    }
    final client = ref.read(simklClientProvider);
    _simklScrobbler = SimklScrobbler(
      pauseOnPause: ref
          .read(settingsProvider)
          .getBool('pauseListStatusOnPause'),
      positionSec: () => _bridge.clock.positionSec,
      send: (action, progress) {
        final body = buildSimklScrobbleBody(
          id,
          season: widget.season,
          episode: widget.episode,
          progress: progress,
        );
        if (body != null) client.scrobble(action, body);
      },
    );
  }

  String _scrobbleStatus(PlayerStatus s) => switch (s) {
    PlayerStatus.playing => 'playing',
    PlayerStatus.paused => 'paused',
    PlayerStatus.ended => 'ended',
    PlayerStatus.loading => 'loading',
    _ => 'other',
  };

  /// Pushes the current position to the Stremio account's continue-watching
  /// (when signed in). A mid-play tick (`force` false) is throttled to the 30s
  /// cloud cadence inside the writer; pause/ended/teardown force it through, and
  /// a finished movie resets its cloud `timeOffset` (the credits reset).
  void _saveStremioCw(double posSec, double durSec, {required bool force}) {
    final w = _cwWriter;
    if (w == null) return;
    if (posSec < cwMinPositionSec) return;
    final type =
        widget.contentType ?? (widget.season != null ? 'series' : 'movie');
    final isEpisode = widget.season != null && widget.episode != null;
    final terminal =
        _disposing ||
        _snap.status == PlayerStatus.ended ||
        _snap.status == PlayerStatus.error;
    w.write(
      CwWriteInput(
        canonicalId: w.canonicalId,
        metaName: _meta?.name ?? widget.title ?? '',
        metaType: type,
        metaPoster: _meta?.poster,
        positionSec: posSec,
        durationSec: durSec,
        isTerminal: terminal,
        statusError: _snap.status == PlayerStatus.error,
        isEpisode: isEpisode,
        season: widget.season,
        episode: widget.episode,
      ),
      force: force,
    );
  }

  /// Marks a finished series episode watched — mirrors the resume autosave,
  /// which records manual-watched for a series episode (only) once playback
  /// passes the finished ratio or ends. Movies are never auto-marked; they are
  /// marked only from the detail view's watched button.
  void _maybeMarkWatched(ResumeAutosave save, double pos, double dur) {
    final id = widget.contentId;
    if (id == null || id.startsWith('iptv:')) return;
    final season = widget.season;
    final episode = widget.episode;
    final type = widget.contentType ?? (season != null ? 'series' : 'movie');
    if (type != 'series' || season == null || episode == null) return;
    final finished = save.isFinished(
      positionSec: pos,
      durationSec: dur,
      ended: _snap.status == PlayerStatus.ended,
    );
    if (!finished) return;
    _manualWatched.mark(id, season, episode);
  }

  String _skipKey(SkipSegment s) =>
      '${s.kind.name}:${s.startSec.round()}:${s.endSec.round()}';

  /// Fetches skip segments once the media duration is known.
  void _maybeFetchSkip() {
    if (_skipFetched || _skipFetching || widget.isLive) return;
    final dur = _snap.durationSec;
    final id = widget.contentId;
    if (dur <= 0 || id == null) return;
    _skipFetching = true;
    final imdbId = id.startsWith('tt') ? id : null;
    _fetchAdSegments(id, imdbId)
        .then(
          (adSegments) => ref
              .read(skipSegmentsFetcherProvider)
              .fetch(
                metaId: id,
                imdbId: imdbId,
                season: widget.season,
                episode: widget.episode,
                durationSec: dur,
                chapters: _snap.chapters,
                adSegments: adSegments,
              ),
        )
        .then((segs) {
          _skipFetched = true;
          _skipFetching = false;
          if (mounted) setState(() => _skipSegments = segs);
        })
        .catchError((_) {
          _skipFetched = true;
          _skipFetching = false;
        });
  }

  /// The community-marked injected-ad segments for the current source, fetched
  /// when ad-skip is enabled or the release is recent enough to be in the ad
  /// window (web `useAdSegments`). Returns empty when neither applies.
  Future<List<SkipSegment>> _fetchAdSegments(String id, String? imdbId) async {
    final s = ref.read(settingsProvider);
    final enabled =
        s.getBool('adSkipEnabled') ||
        withinAdWindow(releaseInfo: widget.releaseInfo);
    if (!enabled) return const [];
    final source = adSourceKey(
      infoHash: widget.sourceInfoHash,
      fileIdx: widget.sourceFileIdx,
      releaseGroup: widget.sourceReleaseGroup,
      size: widget.sourceSize,
      parsedTitle: widget.sourceParsedTitle,
      url: widget.sourceUrl ?? widget.url,
    );
    return ref
        .read(adCorpusProvider)
        .segmentsFor(
          content: adContentKey(id, imdbId),
          source: source,
          fresh: true,
        );
  }

  /// Auto-skips the active segment when its toggle is on (once per segment).
  void _evaluateAutoSkip() {
    if (_skipSegments.isEmpty) return;
    final seg = activeSegment(_skipSegments, _bridge.clock.positionSec);
    if (seg == null) return;
    final s = ref.read(settingsProvider);
    final want =
        (seg.kind == SkipKind.intro && s.getBool('autoSkipIntro')) ||
        (seg.kind == SkipKind.recap && s.getBool('autoSkipRecap')) ||
        (seg.kind == SkipKind.outro && s.getBool('autoSkipOutro')) ||
        (seg.kind == SkipKind.ad && s.getBool('autoSkipAd'));
    if (!want) return;
    final key = _skipKey(seg);
    if (_autoSkippedKey == key) return;
    _autoSkippedKey = key;
    _bridge.seek(seg.endSec);
  }

  String _skipLabel(SkipKind kind) => switch (kind) {
    SkipKind.ad => 'Skip injected ad?',
    SkipKind.intro => 'Skip Intro',
    SkipKind.recap => 'Skip Recap',
    SkipKind.outro => 'Skip Credits',
  };

  /// The corpus fingerprint source key for the playing stream.
  String _adSourceKey() => adSourceKey(
    infoHash: widget.sourceInfoHash,
    fileIdx: widget.sourceFileIdx,
    releaseGroup: widget.sourceReleaseGroup,
    size: widget.sourceSize,
    parsedTitle: widget.sourceParsedTitle,
    url: widget.sourceUrl ?? widget.url,
  );

  /// The "Report ad" button — offered per web `shouldShowAdReport`, hidden while
  /// a skip pill occupies the slot or the chrome is dismissed.
  Widget _adReportButton(HarborTokens t) {
    final s = ref.watch(settingsProvider);
    final source = _adSourceKey();
    final isDirect = widget.isLive || source.startsWith('u_');
    final show = shouldShowAdReport(
      enabled: s.getBool('adSkipEnabled'),
      alwaysShow: s.getBool('adReportAlwaysShow'),
      isDirectStream: isDirect,
      recentRelease: withinAdWindow(releaseInfo: widget.releaseInfo),
    );
    if (!show || !_chromeVisible) return const SizedBox.shrink();
    if (activeSegment(_skipSegments, _bridge.clock.positionSec) != null) {
      return const SizedBox.shrink();
    }
    return Positioned(
      right: 40,
      bottom: 56,
      child: _PlayerButton(
        tokens: t,
        filled: false,
        onPressed: _openAdReportModal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.flag_outlined, size: 16, color: t.ink),
            const SizedBox(width: 6),
            Text(
              'Report ad',
              style: TextStyle(
                color: t.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openAdReportModal() async {
    final id = widget.contentId ?? '';
    final content = adContentKey(id, id.startsWith('tt') ? id : null);
    final source = _adSourceKey();
    if (content.isEmpty || !adSourceReportable(source)) return;
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.72),
      builder: (ctx) => _AdReportSheet(
        tokens: ref.read(tokensProvider),
        positionSec: () => _bridge.clock.positionSec,
        onSubmit: (ranges) => ref
            .read(adReportSubmitterProvider)
            .submit(content: content, source: source, ranges: ranges),
      ),
    );
  }

  /// The skip pill (a "Skip …" button) when a segment is active and shown.
  /// Ported from `SkipPillContainer`/`SkipPill`.
  Widget _skipPill(HarborTokens t) {
    final s = ref.watch(settingsProvider);
    final seg = visibleSkipSegment(
      _skipSegments,
      _bridge.clock.positionSec,
      showButton: s.getBool('showSkipButton'),
      hideSec: s.getInt('skipButtonHideSec'),
      dismissed: (x) => _dismissedSkips.contains(_skipKey(x)),
    );
    if (seg == null) return const SizedBox.shrink();
    final key = _skipKey(seg);
    return Positioned(
      right: 40,
      bottom: 56,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _PlayerButton(
            tokens: t,
            onPressed: () => _bridge.seek(seg.endSec),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.skip_next, color: t.canvas, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    _skipLabel(seg.kind),
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          _PlayerButton(
            tokens: t,
            filled: false,
            onPressed: () => setState(() => _dismissedSkips.add(key)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Icon(Icons.close, color: t.ink, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  /// The skip segment whose pill is currently on screen, or null. Shared with
  /// [_skipPill] so the render and the remote's OK act on the same gating.
  SkipSegment? _activeSkipSegment() {
    final s = ref.read(settingsProvider);
    return visibleSkipSegment(
      _skipSegments,
      _bridge.clock.positionSec,
      showButton: s.getBool('showSkipButton'),
      hideSec: s.getInt('skipButtonHideSec'),
      dismissed: (seg) => _dismissedSkips.contains(_skipKey(seg)),
    );
  }

  void _resolveResume(bool resume) {
    final sec = _pendingResumeSec;
    if (sec == null) return;
    if (resume) _bridge.seek(sec);
    _bridge.play();
    setState(() => _pendingResumeSec = null);
    _scheduleHide();
  }

  /// The player's top-bar title block: the primary line (with a live quality
  /// badge) over an optional secondary line. For a series the secondary is
  /// `S# · E#`; when `playerTitleSeriesFirst` is on and a subtitle exists, the
  /// two swap so the show name leads (web `title-info` control's swap).
  Widget _titleInfo(double titleScale) {
    final title = widget.title ?? '';
    final subtitle = (widget.season != null && widget.episode != null)
        ? 'S${widget.season} · E${widget.episode}'
        : null;
    final seriesFirst = ref
        .watch(settingsProvider)
        .getBool('playerTitleSeriesFirst');
    final swap = seriesFirst && subtitle != null;
    final primary = swap ? subtitle : title;
    final secondary = swap ? title : subtitle;
    final qual = realQualityLabel(_snap.videoWidth, _snap.videoHeight);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                primary,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: (20 * titleScale).roundToDouble(),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (qual != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  qual,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ],
          ],
        ),
        if (secondary != null && secondary.isNotEmpty)
          Text(
            secondary,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white70,
              fontSize: (13 * titleScale).roundToDouble(),
            ),
          ),
      ],
    );
  }

  /// The resume prompt — pick Resume or Start Over — ported from `ResumePrompt`.
  Widget _resumePrompt(HarborTokens t) {
    final sec = _pendingResumeSec;
    if (sec == null) return const SizedBox.shrink();
    final dur = _snap.durationSec;
    final pct = dur > 0 ? ((sec / dur) * 100).round().clamp(0, 100) : 0;
    return Positioned.fill(
      child: ColoredBox(
        color: const Color(0xCC000000),
        child: Center(
          child: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (widget.title != null)
                  Text(
                    widget.title!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const SizedBox(height: 10),
                Text(
                  '${_fmt(sec)} of ${_fmt(dur)} watched ($pct%).',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: pct / 100,
                    minHeight: 4,
                    backgroundColor: Colors.white.withValues(alpha: 0.2),
                    valueColor: AlwaysStoppedAnimation(t.accent),
                  ),
                ),
                const SizedBox(height: 22),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _PlayerButton(
                      tokens: t,
                      autofocus: true,
                      onPressed: () => _resolveResume(true),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 13,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.play_arrow, color: t.canvas, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Resume from ${_fmt(sec)}',
                              style: TextStyle(
                                color: t.canvas,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    _PlayerButton(
                      tokens: t,
                      filled: false,
                      onPressed: () => _resolveResume(false),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 13,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.restart_alt, color: t.ink, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              'Start Over',
                              style: TextStyle(
                                color: t.ink,
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
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
      ),
    );
  }

  /// Persists a local continue-watching entry alongside the resume position.
  void _saveContinueWatching(double posSec, double durSec) {
    final id = widget.contentId;
    if (id == null || id.startsWith('iptv:')) return;
    if (posSec < ResumeAutosave.minPositionSec) return;
    if (durSec > 0 && durSec < ResumeAutosave.stubMaxSec) return;
    final type =
        widget.contentType ?? (widget.season != null ? 'series' : 'movie');
    _localCw.save(
      LocalCwEntry(
        id: id,
        type: type,
        name: _meta?.name ?? widget.title ?? '',
        poster: _meta?.poster,
        background: _meta?.background,
        season: widget.season,
        episode: widget.episode,
        positionMs: (posSec * 1000).round(),
        durationMs: (durSec * 1000).round(),
        t: DateTime.now().millisecondsSinceEpoch,
      ),
    );
    // Record the playback so the title counts as watched for the Home
    // hide-watched filter (title-keyed) and the played source can be marked as
    // last-played in the picker (identity-keyed). A local download carries no
    // source identity, so it writes thin and preserves any richer prior entry.
    final name = _meta?.name ?? widget.title ?? '';
    _playbackHistory.save(
      id,
      infoHash: widget.sourceInfoHash,
      addonId: widget.sourceAddonId,
      url: widget.sourceUrl,
      title: name,
      parsedTitle: name,
      bingeGroup: widget.sourceBingeGroup,
      resolution: widget.sourceResolution,
      source: widget.sourceSourceKind,
      season: widget.season,
      episode: widget.episode,
    );
    // Lock this source for the season when "Lock to season server" is on, so
    // the rest of the season replays from the same release (web
    // saveSeasonLock). Skipped for anime and for a local download (no source).
    final hasSource =
        widget.sourceInfoHash != null ||
        widget.sourceUrl != null ||
        widget.sourceAddonId != null;
    if (hasSource &&
        type == 'series' &&
        widget.season != null &&
        !RegExp(r'^(kitsu|mal|anilist|anidb):').hasMatch(id) &&
        ref.read(settingsProvider).getBool('seasonSourceLock')) {
      ref
          .read(seasonLockStoreProvider)
          .save(
            id,
            infoHash: widget.sourceInfoHash,
            addonId: widget.sourceAddonId,
            url: widget.sourceUrl,
            title: name,
            parsedTitle: name,
            bingeGroup: widget.sourceBingeGroup,
            resolution: widget.sourceResolution,
            source: widget.sourceSourceKind,
            season: widget.season,
          );
    }
  }

  /// Auto-selects the audio track by the user's language preference once per
  /// track set: `preferredAudioLangs` (falling back to `preferredLanguages`),
  /// Japanese stripped for non-anime, commentary/`trackBlockWords` excluded.
  void _maybeAutoSelectAudio(PlayerSnapshot s) {
    if (s.audioTracks.isEmpty) return;
    final key = s.audioTracks.map((t) => t.id).join(',');
    if (_autoAudioKey == key) return;
    _autoAudioKey = key;

    final settings = ref.read(settingsProvider);
    final isAnime = isAnimeContent(widget.contentId, _meta?.genres ?? const []);
    final langs = audioLangPreference(
      preferredAudio: settings.getStringList('preferredAudioLangs'),
      preferredLanguages: settings.getStringList('preferredLanguages'),
      isAnime: isAnime,
    );
    final want = autoSelectAudioTrack(
      tracks: s.audioTracks,
      langs: langs,
      blockWords: normalizeBlockWords(
        settings.getStringList('trackBlockWords'),
      ),
    );
    if (want == null) return;
    final current = s.audioTracks.where((t) => t.selected);
    if (current.isEmpty || current.first.id != want.id) {
      _bridge.setAudioTrack(want.id);
    }
  }

  /// Clears an auto-enabled embedded subtitle track once per track set when
  /// `subtitlesOffByDefault` is on, ported from the subs-off effect in
  /// use-track-autoload. External subtitles are handled by the autoloader.
  void _maybeApplySubsOff(PlayerSnapshot s) {
    if (s.subtitleTracks.isEmpty) return;
    final key = s.subtitleTracks.map((t) => t.id).join(',');
    if (_subsOffKey == key) return;
    _subsOffKey = key;
    if (!ref.read(settingsProvider).getBool('subtitlesOffByDefault')) return;
    if (s.subtitleTracks.any((t) => t.selected)) {
      _bridge.setSubtitleTrack(null);
    }
  }

  Future<void> _autoloadSubtitles() async {
    final id = widget.contentId;
    if (id == null || !id.startsWith('tt')) return;
    final settings = ref.read(settingsProvider);
    final subProv = settings.getMap('subProvidersEnabled');
    final prefLangs = settings.getStringList('preferredSubLangs');
    // A pre-play subtitle choice overrides the auto-pick: "off" auto-selects
    // nothing; a chosen track is loaded and selected instead.
    final preUrl = widget.subtitlePreselectUrl;
    final hasPreselect = widget.subtitlePreselectOff || preUrl != null;
    final result = await ref
        .read(subtitleAutoloaderProvider)
        .run(
          bridge: _bridge,
          query: SubSearchQuery(
            imdbId: id,
            type: widget.season != null ? 'series' : 'movie',
            season: widget.season,
            episode: widget.episode,
          ),
          addons: ref.read(activeAddonsProvider),
          providers: SubProviders(
            opensubtitles: subProv['opensubtitles'] != false,
            addons: subProv['addons'] != false,
            wyzie: subProv['wyzie'] == true,
          ),
          preferredLangs: prefLangs.isEmpty ? const ['English'] : prefLangs,
          // Suppress the auto-pick when the viewer pre-chose (off or a track).
          subtitlesOffByDefault:
              hasPreselect || settings.getBool('subtitlesOffByDefault'),
        );
    var available = result.available;
    var index = result.selectedIndex ?? -1;
    if (preUrl != null) {
      await _bridge.addSubtitle(
        preUrl,
        lang: widget.subtitlePreselectLang,
        title: widget.subtitlePreselectTitle,
        select: true,
      );
      final chosen = SubResult(
        id: preUrl,
        url: preUrl,
        lang: widget.subtitlePreselectLang ?? '',
        source: SubSource.addon,
        title: widget.subtitlePreselectTitle,
      );
      available = [chosen, ...available.where((r) => r.url != preUrl)];
      index = 0;
    }
    if (!mounted) return;
    setState(() {
      _availableSubs = available;
      _subIndex = index;
    });
  }

  /// Searches the enabled subtitle providers for this title and merges any new
  /// results into [_availableSubs] — the native counterpart of the web subtitle
  /// menu's search section, so the viewer can add subtitles even when none
  /// auto-loaded. Returns the count of newly-added tracks.
  Future<int> _searchSubtitles() async {
    final settings = ref.read(settingsProvider);
    final subProv = settings.getMap('subProvidersEnabled');
    final id = widget.contentId;
    final results = await ref
        .read(subtitleSearcherProvider)
        .search(
          SubSearchQuery(
            imdbId: id != null && id.startsWith('tt') ? id : null,
            type: widget.season != null ? 'series' : 'movie',
            title: widget.title,
            season: widget.season,
            episode: widget.episode,
          ),
          providers: SubProviders(
            opensubtitles: subProv['opensubtitles'] != false,
            addons: subProv['addons'] != false,
            wyzie: subProv['wyzie'] == true,
          ),
          addons: ref.read(activeAddonsProvider),
          preferredLangs: settings.getStringList('preferredSubLangs'),
        );
    if (!mounted) return 0;
    final have = _availableSubs.map((s) => s.url).toSet();
    final fresh = [
      for (final r in results)
        if (!have.contains(r.url)) r,
    ];
    if (fresh.isEmpty) return 0;
    setState(() => _availableSubs = [..._availableSubs, ...fresh]);
    return fresh.length;
  }

  /// Cycles the active subtitle: off → each available track → off.
  void _cycleSubtitle() {
    if (_availableSubs.isEmpty) return;
    final next = _subIndex + 1;
    _applySubtitle(next >= _availableSubs.length ? -1 : next);
  }

  /// Selects subtitle track [index] (-1 = off), applying it to the engine.
  void _applySubtitle(int index) {
    if (index < 0 || index >= _availableSubs.length) {
      _subIndex = -1;
      _bridge.setSubtitleTrack(null);
      _cuesToken++; // cancel any in-flight fetch
      _externalCues = const [];
    } else {
      _subIndex = index;
      final r = _availableSubs[index];
      if (_defaultEngine) {
        // The default engine can't render external subtitles, so fetch, parse,
        // and draw them in an overlay instead.
        _externalCues = const [];
        _loadExternalCues(r.url);
      } else {
        _bridge.addSubtitle(r.url, lang: r.lang, title: r.title, select: true);
        _cuesToken++;
        _externalCues = const [];
      }
    }
    setState(() {});
    _wakeChrome();
  }

  /// Fetches and parses an external subtitle for the default-engine overlay,
  /// guarding against a stale fetch overwriting a newer selection.
  Future<void> _loadExternalCues(String url) async {
    final token = ++_cuesToken;
    try {
      final res = await ref.read(bytesTransportProvider).getBytes(url);
      final cues = parseSubtitle(decodeSubtitleBytes(res.bytes));
      if (!mounted || token != _cuesToken) return;
      setState(() => _externalCues = cues);
    } catch (_) {
      // Best-effort: leave the overlay empty on a fetch/parse failure.
    }
  }

  /// Opens a focus-trapped picker of the available subtitle tracks (plus Off) —
  /// the native counterpart of the web subtitle menu.
  /// Opens the subtitle picker: Off, the embedded/engine tracks, any external
  /// (searched) subtitles, "Search subtitles", and Subtitle sync. The previous
  /// menu listed only external search results, so an embedded-subtitle title
  /// with nothing searched showed only "Search subtitles". Values are encoded:
  /// `off` / `search` / `sync`, `trk:<id>` for an engine track, `ext:<i>` for an
  /// external result.
  /// Opens the full subtitle picker (the two-pane [SubtitlePicker] overlay).
  void _openSubtitles() {
    _wakeChrome();
    setState(() => _subtitleMenuOpen = true);
  }

  /// The unified subtitle options for the picker: the engine tracks (embedded +
  /// engine-added externals) plus external search results not yet added to the
  /// engine (de-duped by url so an added external isn't listed twice).
  List<SubtitleVariant> _subtitleVariants() {
    final engine = _snap.subtitleTracks;
    final engineUrls = {
      for (final tr in engine)
        if (tr.url != null && tr.url!.isNotEmpty) tr.url!,
    };
    return [
      for (final tr in engine)
        SubtitleVariant(
          key: 'trk:${tr.id}',
          lang: tr.lang ?? '',
          title: (tr.title?.isNotEmpty ?? false)
              ? tr.title!
              : (tr.externalFilename ?? ''),
          external: tr.external,
          codec: tr.codec,
          forced: tr.forced,
          hearingImpaired: tr.hearingImpaired,
          isDefault: tr.isDefault,
        ),
      for (final (i, s) in _availableSubs.indexed)
        if (!engineUrls.contains(s.url))
          SubtitleVariant(
            key: 'ext:$i',
            lang: s.lang,
            title: s.release ?? s.title ?? '',
            external: true,
            codec: s.format,
            forced: s.forced,
            hearingImpaired: s.hearingImpaired,
          ),
    ];
  }

  /// The selected variant key: a selected engine track, else the external
  /// overlay selection, else null (off).
  String? _selectedSubtitleKey() {
    for (final tr in _snap.subtitleTracks) {
      if (tr.selected) return 'trk:${tr.id}';
    }
    if (_subIndex >= 0) return 'ext:$_subIndex';
    return null;
  }

  void _onSubtitleSelect(String key) {
    if (key.startsWith('trk:')) {
      _selectEmbeddedSubtitle(key.substring(4));
    } else if (key.startsWith('ext:')) {
      _applySubtitle(int.parse(key.substring(4)));
    }
  }

  /// Runs a subtitle search from the picker, driving its loading state.
  Future<void> _runSubtitleSearch() async {
    if (_searchingSubs) return;
    setState(() => _searchingSubs = true);
    await _searchSubtitles();
    if (!mounted) return;
    setState(() => _searchingSubs = false);
  }

  /// Selects an embedded/engine subtitle [id], clearing any external overlay.
  void _selectEmbeddedSubtitle(String id) {
    _subIndex = -1;
    _cuesToken++;
    _externalCues = const [];
    _bridge.setSubtitleTrack(id);
    setState(() {});
    _wakeChrome();
  }

  /// Opens a focus-trapped picker of the media's audio tracks — the native
  /// counterpart of the web audio-track menu.
  Future<void> _openAudioMenu() async {
    final tracks = _snap.audioTracks;
    if (tracks.isEmpty) return;
    _wakeChrome();
    const syncValue = '__audio_sync__';
    final result = await showContextMenu<String>(
      context: context,
      tokens: ref.read(tokensProvider),
      actions: [
        ContextMenuAction(
          value: syncValue,
          label: _audioDelay == 0
              ? 'Audio sync'
              : 'Audio sync · ${_audioDelay > 0 ? '+' : ''}'
                    '${_audioDelay.toStringAsFixed(2)}s',
          icon: Icons.timer_outlined,
        ),
        for (final tr in tracks)
          ContextMenuAction(
            value: tr.id,
            label: tr.label.isNotEmpty ? tr.label : languageName(tr.lang ?? ''),
            icon: tr.selected ? Icons.check : Icons.audiotrack_outlined,
          ),
      ],
    );
    if (result == null) return;
    if (result == syncValue) {
      setState(() {
        _syncBarIsAudio = true;
        _showSyncBar = true;
      });
      return;
    }
    _bridge.setAudioTrack(result);
  }

  /// Opens a focus-trapped playback-speed picker (`playerSpeedUp`/`Down` also
  /// step it). Remote-reachable counterpart of the bracket-key speed control.
  /// Opens the playback-speed picker (curated speeds + the viewer's custom set),
  /// the remote-navigable counterpart of the web speed menu.
  void _openSpeedMenu() {
    _wakeChrome();
    setState(() => _speedMenuOpen = true);
  }

  /// Applies a speed from the picker and flashes the pill.
  void _applySpeed(double rate) {
    _bridge.setRate(rate);
    _flashPill('${_speedText(rate)}×', Icons.speed);
    setState(() => _speedMenuOpen = false);
    _wakeChrome();
  }

  /// Adds a custom playback speed to the `customPlaybackSpeeds` setting (kept
  /// sorted + de-duped), so it joins the picker list on every title.
  void _addCustomSpeed(double rate) {
    final s = ref.read(settingsProvider);
    final next = {...s.getDoubleList('customPlaybackSpeeds'), rate}.toList()
      ..sort();
    ref.read(settingsProvider.notifier).setValue('customPlaybackSpeeds', next);
  }

  /// Removes a custom playback speed from the setting.
  void _removeCustomSpeed(double rate) {
    final s = ref.read(settingsProvider);
    final next = s
        .getDoubleList('customPlaybackSpeeds')
        .where((v) => (v - rate).abs() > 0.001)
        .toList();
    ref.read(settingsProvider.notifier).setValue('customPlaybackSpeeds', next);
  }

  /// A compact speed label: `1`, `1.5`, `0.75` (no trailing zeros).
  String _speedText(double sp) =>
      sp == sp.roundToDouble() ? sp.toStringAsFixed(0) : '$sp';

  /// Opens a focus-trapped aspect / crop picker (mpv engine only; the "v" key
  /// also cycles it). Remote-reachable counterpart of the web aspect menu.
  Future<void> _openAspectMenu() async {
    _wakeChrome();
    final current = kCropModes[_cropIndex];
    final result = await showContextMenu<String>(
      context: context,
      tokens: ref.read(tokensProvider),
      actions: [
        for (final m in kCropModes)
          ContextMenuAction(
            value: m.id,
            label: m.label,
            icon: m.id == current.id
                ? Icons.check
                : Icons.aspect_ratio_outlined,
          ),
      ],
    );
    if (result == null) return;
    final idx = kCropModes.indexWhere((m) => m.id == result);
    if (idx < 0) return;
    setState(() => _cropIndex = idx);
    _applyCrop(kCropModes[idx], flash: true, zoomLevel: _zoom);
    ref
        .read(settingsProvider.notifier)
        .setValue('cropMode', kCropModes[idx].id);
    _wakeChrome();
  }

  /// Opens a focus-trapped Anime4K upscaling picker (mpv engine only; requires
  /// the shader pack to be installed). Auto/Off + the six modes, mirroring the
  /// web anime4k menu; persists the override and re-applies the shader chain.
  Future<void> _openAnime4kMenu() async {
    _wakeChrome();
    final current = anime4kChoice(ref.read(settingsProvider));
    final result = await showContextMenu<String>(
      context: context,
      tokens: ref.read(tokensProvider),
      actions: [
        ContextMenuAction(
          value: 'auto',
          label: 'Auto',
          icon: current == 'auto' ? Icons.check : Icons.auto_awesome,
        ),
        ContextMenuAction(
          value: 'off',
          label: 'Off',
          icon: current == 'off' ? Icons.check : Icons.block_outlined,
        ),
        for (final m in kAnime4kModes)
          ContextMenuAction(
            value: m.mode.id,
            label: m.label,
            icon: current == m.mode.id
                ? Icons.check
                : Icons.auto_awesome_outlined,
          ),
      ],
    );
    if (result == null) return;
    _setAnime4kChoice(result);
    _flashPill(_anime4kPillLabel(result), Icons.auto_awesome);
    _wakeChrome();
  }

  String _anime4kPillLabel(String choice) {
    if (choice == 'off') return 'Anime4K off';
    if (choice == 'auto') return 'Anime4K auto';
    final m = kAnime4kModes.firstWhere(
      (e) => e.mode.id == choice,
      orElse: () => kAnime4kModes.first,
    );
    return 'Anime4K ${m.label.replaceFirst('Mode ', '')}';
  }

  /// Saves the current video frame (no subtitles) as a PNG under the screenshots
  /// directory (`playerScreenshot`, the "p" hotkey). Only the mpv engine can
  /// grab a frame; the default engine reports it as unsupported.
  Future<void> _takeScreenshot() async {
    _wakeChrome();
    String two(int n) => n.toString().padLeft(2, '0');
    final now = DateTime.now();
    final stamp =
        '${now.year}${two(now.month)}${two(now.day)}_'
        '${two(now.hour)}${two(now.minute)}${two(now.second)}';
    ScreenshotResult r;
    try {
      final dir = await ref.read(screenshotsDirProvider)();
      r = await _bridge.screenshot('$dir/Harbor_$stamp.png');
    } catch (e) {
      r = ScreenshotResult(ok: false, error: e.toString());
    }
    if (!mounted) return;
    _flashPill(
      r.ok ? 'Screenshot saved' : 'Screenshot unavailable',
      Icons.photo_camera,
    );
  }

  /// The episodes adjacent to the one now playing, from the series' Cinemeta
  /// video list (empty for movies or before the meta loads).
  ({EpisodeRef? prev, EpisodeRef? next}) _episodeNav() {
    final id = widget.contentId;
    final s = widget.season, e = widget.episode;
    if (widget.contentType != 'series' ||
        id == null ||
        s == null ||
        e == null) {
      return (prev: null, next: null);
    }
    return adjacentEpisodes(_meta?.videos ?? const <VideoRef>[], s, e);
  }

  /// Navigates to [ep] by opening the play-picker for that episode (the web
  /// `goToEpisode`, minus the deferred auto-play). Leaving the player saves the
  /// current episode's resume position and stops playback via dispose.
  void _goToEpisode(EpisodeRef ep) {
    final id = widget.contentId;
    if (id == null) return;
    final info = _meta?.releaseInfo;
    final yearMatch = info == null ? null : RegExp(r'\d{4}').firstMatch(info);
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.picker, {
            'type': 'series',
            'id': id,
            'season': ep.season,
            'episode': ep.episode,
            'title': ?(_meta?.name ?? widget.title),
            'year': ?(yearMatch != null
                ? int.parse(yearMatch.group(0)!)
                : null),
            'isAnime': isAnimeContent(id, _meta?.genres ?? const []),
          }),
        );
  }

  /// Whether the episode panel applies — a series whose meta carries more than
  /// one numbered episode to browse. Gates the "Episodes" control and "e" key.
  bool get _hasEpisodePanel {
    if (widget.contentType != 'series') return false;
    var count = 0;
    for (final v in _meta?.videos ?? const <VideoRef>[]) {
      if (v.season != null && v.episode != null) {
        if (++count > 1) return true;
      }
    }
    return false;
  }

  /// Opens or closes the in-player episode panel, waking the chrome so it is
  /// visible behind the drawer's dimmed backdrop.
  void _toggleEpisodePanel() {
    _wakeChrome();
    setState(() => _episodePanelOpen = !_episodePanelOpen);
  }

  /// Restarts the current episode from the beginning (the panel's "Restart"
  /// action on the now-playing row), then closes the panel.
  void _restartCurrent() {
    _bridge.seek(0);
    _pushNowPlaying(positionOverride: 0);
    setState(() => _episodePanelOpen = false);
    _wakeChrome();
  }

  /// Whether "pick another source" applies — real VOD content (not live/IPTV)
  /// with a content id the picker can re-resolve streams for.
  bool get _canPickAnother {
    final id = widget.contentId;
    return id != null && !widget.isLive && !id.startsWith('iptv:');
  }

  /// Reopens the play picker for the *current* title/episode so the viewer can
  /// switch to a different source. The player disposes (saving its resume
  /// position), and the next source resumes from there. clientv2's frame model
  /// reopens the picker rather than the web's in-place overlay, consistent with
  /// the episode-nav flow.
  void _pickAnother() {
    final id = widget.contentId;
    if (id == null) return;
    final info = _meta?.releaseInfo;
    final yearMatch = info == null ? null : RegExp(r'\d{4}').firstMatch(info);
    final type =
        widget.contentType ?? (widget.season != null ? 'series' : 'movie');
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.picker, {
            'type': type,
            'id': id,
            'season': ?widget.season,
            'episode': ?widget.episode,
            'title': ?(_meta?.name ?? widget.title),
            'year': ?(yearMatch != null
                ? int.parse(yearMatch.group(0)!)
                : null),
            'isAnime': isAnimeContent(id, _meta?.genres ?? const []),
          }),
        );
  }

  /// The series video for [season]/[episode] from the loaded meta, or null.
  VideoRef? _videoFor(int season, int episode) {
    for (final v in _meta?.videos ?? const <VideoRef>[]) {
      if (v.season == season && v.episode == episode) return v;
    }
    return null;
  }

  /// The next-episode countdown card shown over the last `nextEpisodeLead`
  /// seconds of a series episode (ported from the web `UpNextCard` /
  /// `SkipPillContainer` synthetic outro): a live "Up next in Ns" with the next
  /// episode's still, a Play-now action, and a dismiss that cancels the advance.
  /// Suppressed when a real outro skip segment exists, or once dismissed.
  Widget _nextEpisodePill(HarborTokens t) {
    if (_autoNextCancelled) return const SizedBox.shrink();
    final next = _episodeNav().next;
    if (next == null) return const SizedBox.shrink();
    final dur = _snap.durationSec;
    if (dur <= 0) return const SizedBox.shrink();
    final leadSec = nextEpisodeLead(
      ref.watch(settingsProvider).getInt('nextEpisodeLeadSec'),
      dur,
    );
    if (leadSec <= 0) return const SizedBox.shrink();
    // A real outro skip segment supersedes the synthetic countdown.
    if (_skipSegments.any((seg) => seg.kind == SkipKind.outro)) {
      return const SizedBox.shrink();
    }
    final video = _videoFor(next.season, next.episode);
    final title = video?.title?.trim();
    return Positioned(
      right: 28,
      bottom: 108,
      child: ValueListenableBuilder<double>(
        valueListenable: _bridge.clock.position,
        builder: (context, pos, _) {
          final remaining = dur - pos;
          if (remaining > leadSec || remaining < 0.5) {
            return const SizedBox.shrink();
          }
          return _NextEpisodeCard(
            tokens: t,
            still: video?.thumbnail,
            epLabel: 'S${next.season} · E${next.episode}',
            title: (title != null && title.isNotEmpty) ? title : null,
            seconds: remaining.ceil().clamp(0, leadSec),
            onPlay: () => _goToEpisode(next),
            onCancel: () => setState(() => _autoNextCancelled = true),
          );
        },
      ),
    );
  }

  /// Captures once, on the first playing tick with a real position, whether the
  /// episode began at or past 80% (a resume near the end), which suppresses the
  /// immediate auto-advance. Ports `use-started-near-end`.
  void _captureStartedNearEnd(PlayerSnapshot s) {
    if (_startedNearEndCaptured) return;
    if (s.status != PlayerStatus.playing || s.durationSec <= 0) return;
    final pos = _bridge.clock.positionSec;
    if (pos <= 0) return;
    _startedNearEndCaptured = true;
    _startedNearEnd = pos / s.durationSec >= 0.8;
  }

  /// Auto-advances to the next episode when the current one ends, ported from
  /// `use-auto-next-episode`: gated on the `autoPlayNextEpisode` setting, a real
  /// (non-stub) duration, not having started near the end, and firing once per
  /// episode.
  void _maybeAutoNext(PlayerSnapshot s) {
    if (_autoNextFiredUrl == widget.url) return;
    // A sleep timer that fired at this episode's end paused playback — do not
    // auto-advance past it.
    if (_sleepPausedUrl == widget.url) return;
    if (_autoNextCancelled) return;
    if (!ref.read(settingsProvider).getBool('autoPlayNextEpisode')) return;
    final next = _episodeNav().next;
    if (next == null) return;
    final dur = s.durationSec;
    if (dur < 150) return; // STUB_MAX_SEC: never auto-next on stubs/clips
    if (_startedNearEnd) return;
    final pos = _bridge.clock.positionSec;
    final naturalEnd = s.status == PlayerStatus.ended;
    final errorAtEnd = s.errorCode != null && pos >= dur - 2;
    final reachedEnd = s.status != PlayerStatus.playing && pos >= dur - 1;
    if (!naturalEnd && !errorAtEnd && !reachedEnd) return;
    _autoNextFiredUrl = widget.url;
    _goToEpisode(next);
  }

  /// Advances the sleep timer at this episode's end (ported from the episode
  /// branch of `use-sleep-timer`). Runs before [_maybeAutoNext] so that when an
  /// end-of-episode sleep fires it can pause and suppress the auto-advance. A
  /// no-op unless a sleep timer is armed, so the default path is unchanged.
  void _maybeSleepOnEnd(PlayerSnapshot s) {
    if (ref.read(sleepTimerProvider) is SleepOff) return;
    if (_sleepEndFiredUrl == widget.url) return;
    final dur = s.durationSec;
    if (dur <= 0) return;
    final pos = _bridge.clock.positionSec;
    final ended = s.status == PlayerStatus.ended && pos >= dur - 2;
    if (!ended) return;
    _sleepEndFiredUrl = widget.url;
    if (ref.read(sleepTimerProvider.notifier).onEpisodeEnded()) {
      _sleepPausedUrl = widget.url;
      _bridge.pause();
      setState(() {});
    }
  }

  /// Starts/stops the 1s ticker that fires a minutes sleep and drives the
  /// transport countdown. Called on load and whenever the sleep mode changes.
  void _syncSleepTicker() {
    final armed = ref.read(sleepTimerProvider) is SleepMinutes;
    if (armed && _sleepTicker == null) {
      _sleepTick(); // fire once now (catches a deadline already past)
      _sleepTicker = Timer.periodic(const Duration(seconds: 1), (_) {
        _sleepTick();
      });
    } else if (!armed && _sleepTicker != null) {
      _sleepTicker!.cancel();
      _sleepTicker = null;
      if (_sleepRemaining != null) setState(() => _sleepRemaining = null);
    }
  }

  void _sleepTick() {
    final m = ref.read(sleepTimerProvider);
    if (m is! SleepMinutes) {
      _syncSleepTicker();
      return;
    }
    final remaining = m.firesAt.difference(DateTime.now());
    if (remaining.inMilliseconds <= 0) {
      _bridge.pause();
      ref.read(sleepTimerProvider.notifier).cancel();
      _syncSleepTicker();
    } else {
      setState(() => _sleepRemaining = remaining);
    }
  }

  /// Arms/cancels a sleep preset from the picker (the minutes deadline is
  /// computed here so the domain stays clock-free), then re-syncs the ticker.
  void _setSleepPreset(SleepPreset p) {
    final ctrl = ref.read(sleepTimerProvider.notifier);
    if (p.minutes != null) {
      ctrl.startMinutes(p.minutes!);
    } else if (p.id == 'ep') {
      ctrl.endEpisode();
    } else {
      ctrl.endNextEpisode();
    }
    _sleepEndFiredUrl = null; // let the new timer fire for this episode
    _syncSleepTicker();
    _wakeChrome();
  }

  void _cancelSleep() {
    ref.read(sleepTimerProvider.notifier).cancel();
    _syncSleepTicker();
    _wakeChrome();
  }

  /// The armed sleep preset id (`'30'` / `'ep'` / `'ep2'` / a custom minutes
  /// value), or null when no sleep is armed — drives the picker's selected row.
  String? _sleepModeId(SleepMode m) => switch (m) {
    SleepMinutes(:final total) => '$total',
    SleepEndEpisode() => 'ep',
    SleepEndNextEpisode() => 'ep2',
    SleepOff() => null,
  };

  /// Formats a remaining sleep [d] as `m:ss` (or `h:mm:ss` past an hour).
  String _fmtRemaining(Duration d) {
    final s = d.inSeconds;
    final h = s ~/ 3600;
    final m = (s % 3600) ~/ 60;
    final ss = (s % 60).toString().padLeft(2, '0');
    return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$ss' : '$m:$ss';
  }

  void _addCustomSleep(int minutes) {
    final s = ref.read(settingsProvider);
    final next = {
      ...s.getDoubleList('customSleepMinutes').map((e) => e.toInt()),
      minutes,
    }.toList()..sort();
    ref.read(settingsProvider.notifier).setValue('customSleepMinutes', next);
  }

  void _removeCustomSleep(int minutes) {
    final s = ref.read(settingsProvider);
    final next = s
        .getDoubleList('customSleepMinutes')
        .map((e) => e.toInt())
        .where((v) => v != minutes)
        .toList();
    ref.read(settingsProvider.notifier).setValue('customSleepMinutes', next);
  }

  /// The transport download control — the native counterpart of the web player's
  /// download button. Mirrors the current title's download state from the shared
  /// engine: idle → enqueue the playing stream; downloading → pause; paused →
  /// resume; done → open the Downloads tab.
  Widget _downloadButton(HarborTokens t) {
    final engine = ref.watch(downloadEngineProvider);
    final metaKey = widget.contentId ?? widget.url;
    return ValueListenableBuilder<List<DownloadItem>>(
      valueListenable: engine.items,
      builder: (_, items, _) {
        DownloadItem? dl;
        for (final i in items) {
          if (i.metaId == metaKey &&
              i.season == widget.season &&
              i.episode == widget.episode) {
            dl = i;
            break;
          }
        }
        final (
          IconData icon,
          VoidCallback onPressed,
          bool lit,
        ) = switch (dl?.status) {
          DownloadStatus.downloading => (
            Icons.pause,
            () => engine.pause(dl!.id),
            true,
          ),
          DownloadStatus.paused => (
            Icons.play_arrow,
            () => engine.resume(dl!.id),
            true,
          ),
          DownloadStatus.done => (
            Icons.download_done,
            () => ref
                .read(navControllerProvider.notifier)
                .setView(FrameKind.downloads),
            true,
          ),
          _ => (Icons.download_outlined, _startPlayerDownload, false),
        };
        return _PlayerIconButton(
          tokens: t,
          icon: icon,
          color: lit ? t.accent : Colors.white,
          tooltip: 'Download',
          onPressed: onPressed,
        );
      },
    );
  }

  /// Enqueues the currently-playing stream for offline download, straight from
  /// the resolved url/headers (web `start()` — no re-resolution, no picker).
  void _startPlayerDownload() {
    final s = widget.season, e = widget.episode;
    final subtitle = (s != null && e != null)
        ? 'S$s · E${e.toString().padLeft(2, '0')}'
        : _meta?.releaseInfo;
    unawaited(
      ref
          .read(downloadEngineProvider)
          .enqueue(
            DownloadRequest(
              metaId: widget.contentId ?? widget.url,
              title: _meta?.name ?? widget.title ?? 'Download',
              subtitle: subtitle,
              poster: _meta?.poster,
              season: s,
              episode: e,
              url: widget.url,
              headers: widget.headers,
              releaseInfo: _meta?.releaseInfo,
            ),
          ),
    );
    _wakeChrome();
  }

  /// The active subtitle's language label, or null when subtitles are off —
  /// covers both an external (searched) selection and a selected engine track.
  String? get _activeSubtitleLabel {
    if (_subIndex >= 0 && _subIndex < _availableSubs.length) {
      return languageName(_availableSubs[_subIndex].lang);
    }
    for (final track in _snap.subtitleTracks) {
      if (track.selected) {
        return (track.lang != null && track.lang!.isNotEmpty)
            ? languageName(track.lang!)
            : (track.label.isNotEmpty ? track.label : null);
      }
    }
    return null;
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    final Duration delay;
    if (_snap.status == PlayerStatus.playing) {
      delay = _resumeHide ? _chromeHideResume : _chromeHidePlaying;
      _resumeHide = false;
    } else if (_snap.status == PlayerStatus.paused) {
      delay = _chromeHidePaused;
    } else {
      return; // loading / error / idle: no auto-hide
    }
    _hideTimer = Timer(delay, () {
      if (!mounted) return;
      // An open overlay (subtitle/speed/episodes picker or the sync bar) owns
      // the remote — hiding the chrome here would pull focus out of it and leave
      // the viewer stuck. Re-arm instead, so the chrome still auto-hides once
      // the overlay is dismissed.
      if (_overlayOwnsRemote) {
        _scheduleHide();
        return;
      }
      setState(() => _chromeVisible = false);
      // On a TV, pull focus off the (now hidden) controls back to the player
      // root so the next D-pad press wakes the chrome instead of activating an
      // invisible button.
      if (_isTv) _focusNode.requestFocus();
    });
  }

  /// True while a remote-owning overlay is up; the chrome auto-hide must not
  /// fire (and steal focus) underneath it.
  bool get _overlayOwnsRemote =>
      _subtitleMenuOpen || _episodePanelOpen || _speedMenuOpen || _showSyncBar;

  void _wakeChrome() {
    if (!_chromeVisible) setState(() => _chromeVisible = true);
    _scheduleHide();
    // On a TV, land the remote on the play/pause control when the chrome first
    // wakes (only when focus still sits on the player root — never steal it from
    // a control the viewer has already navigated to), so the D-pad can move
    // between the on-screen controls.
    if (_isTv && _focusNode.hasPrimaryFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _chromeVisible && _focusNode.hasPrimaryFocus) {
          _playPauseFocus.requestFocus();
        }
      });
    }
  }

  void _togglePlay() {
    if (_snap.status == PlayerStatus.playing) {
      _bridge.pause();
    } else {
      _resumeHide = true; // resuming: let the chrome clear quickly
      _bridge.play();
    }
    _wakeChrome();
  }

  /// Asks the Android Activity to enter Picture-in-Picture; playback keeps
  /// running in the floating window. A no-op where PiP is unavailable.
  final PipService _pip = const PipService();
  Future<void> _enterPip() => _pip.enterPip();

  /// The user's configured arrow-key seek step (sanitized to an allowed value,
  /// falling back to 10s), ported from the source's `seekBack/ForwardStepSec`.
  double _seekStep(String settingKey) => sanitizeSeekStep(
    ref.read(settingsProvider).getInt(settingKey),
    10,
  ).toDouble();

  /// A ±[seek-step] skip control for the transport row, its icon reflecting the
  /// configured number of seconds. Ports the web player's skip buttons.
  Widget _skipButton(HarborTokens t, {required bool back}) {
    final step = _seekStep(back ? 'seekBackStepSec' : 'seekForwardStepSec');
    final n = step.round();
    final icon = back
        ? switch (n) {
            5 => Icons.replay_5,
            10 => Icons.replay_10,
            30 => Icons.replay_30,
            _ => Icons.replay,
          }
        : switch (n) {
            5 => Icons.forward_5,
            10 => Icons.forward_10,
            30 => Icons.forward_30,
            _ => Icons.fast_forward,
          };
    return _PlayerIconButton(
      tokens: t,
      icon: icon,
      iconSize: 30,
      tooltip: back ? 'Back ${n}s' : 'Forward ${n}s',
      onPressed: () => _seekBy(back ? -step : step),
    );
  }

  void _seekBy(double deltaSec) {
    final pos = _bridge.clock.positionSec + deltaSec;
    final dur = _snap.durationSec;
    final target = pos < 0 ? 0.0 : (dur > 0 && pos > dur ? dur : pos);
    _bridge.seek(target);
    _pushNowPlaying(positionOverride: target);
    _wakeChrome();
  }

  void _nudgeVolume(double delta) {
    final prev = _snap.volume;
    final next = (prev + delta).clamp(0.0, 1.0);
    _bridge.setVolume(next);
    // Volume-change tone (web `SFX.volumeChange`), gated on playerVolumeSfx and
    // skipped on a clamped no-op at the 0/1 boundary.
    if (next != prev &&
        ref.read(settingsProvider).getBool('playerVolumeSfx')) {
      ref.read(sfxServiceProvider).volumeChange(delta > 0);
    }
    _wakeChrome();
    _flashVolumeHud();
  }

  void _flashVolumeHud() {
    if (!ref.read(settingsProvider).getBool('playerVolumeHud')) return;
    setState(() => _volumeHudVisible = true);
    _volumeHudTimer?.cancel();
    _volumeHudTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _volumeHudVisible = false);
    });
  }

  /// The volume HUD flash overlay (icon + percentage + fill), positioned per
  /// `playerVolumeHudPosition`. Ported from `VolumeIndicator`.
  /// Applies a crop mode's picture shape to the advanced engine, optionally
  /// flashing its label — the native port of `use-video-fill`'s `apply`.
  // The source width the Anime4K chain was last resolved against, so the
  // resolution gate (downgrade a double mode when not upscaling) re-runs only
  // when the decoded dimensions actually change.
  int _anime4kWidth = -1;

  /// Whether an Anime4K shader chain is currently running (drives the badge).
  bool _anime4kActive = false;

  /// The display width in physical pixels, mirroring the web hook's
  /// `screen.width * devicePixelRatio`.
  int _displayWidthPx() {
    final mq = MediaQuery.maybeOf(context);
    if (mq == null) return 0;
    return (mq.size.width * mq.devicePixelRatio).round();
  }

  /// Applies (or clears) the Anime4K shader chain for the current override,
  /// source and resolution — the port of `use-anime4k`'s effect. A no-op on the
  /// default engine, whose bridge ignores shaders.
  void _applyAnime4k() {
    if (_defaultEngine) return;
    final settings = ref.read(settingsProvider);
    _anime4kWidth = _snap.videoWidth;
    final shaders = anime4kShadersFor(
      settings,
      choice: anime4kChoice(settings),
      id: widget.contentId,
      genres: _meta?.genres ?? const [],
      srcWidth: _snap.videoWidth,
      displayWidth: _displayWidthPx(),
    );
    _bridge.setAnime4kShaders(shaders);
    final active = shaders.isNotEmpty;
    if (active != _anime4kActive && mounted) {
      setState(() => _anime4kActive = active);
    } else {
      _anime4kActive = active;
    }
  }

  void _maybeReapplyAnime4k(PlayerSnapshot s) {
    if (_defaultEngine) return;
    if (s.videoWidth != _anime4kWidth && s.videoWidth > 0) _applyAnime4k();
  }

  /// Switches the Anime4K override (`auto`/`off`/a mode id) from the player
  /// menu, persisting it and re-applying — mirroring the hook's `setMode`.
  void _setAnime4kChoice(String choice) {
    ref
        .read(settingsProvider.notifier)
        .setValue('playerAnime4kOverride', choice);
    _applyAnime4k();
  }

  /// The floating Anime4K badge overlay (`playerAnime4kIndicator`), shown while
  /// shaders run on the mpv engine and faded with the chrome. Suppressed while a
  /// top-anchored volume HUD is showing (mirroring the web `topVolumeShowing`).
  Widget _anime4kIndicatorOverlay(HarborTokens t) {
    final settings = ref.read(settingsProvider);
    final active =
        _anime4kActive &&
        !_defaultEngine &&
        settings.getBool('playerAnime4kIndicator');
    if (!active) return const SizedBox.shrink();
    final volTop =
        _volumeHudVisible &&
        settings.getString('playerVolumeHudPosition') != 'center';
    final mode = anime4kDisplayChoice(
      settings,
      id: widget.contentId,
      genres: _meta?.genres ?? const [],
    );
    return Positioned(
      top: 52,
      left: 0,
      right: 0,
      child: Align(
        alignment: Alignment.topCenter,
        child: Anime4kIndicator(
          tokens: t,
          active: active,
          visible: _chromeVisible && !volTop,
          modeLabel: (mode == 'auto' || mode == 'off') ? null : mode,
        ),
      ),
    );
  }

  void _applyCrop(CropMode mode, {bool flash = false, double zoomLevel = 0}) {
    _bridge.setPanscan(mode.panscan);
    _bridge.setAspectOverride(mode.aspect);
    _bridge.setVideoZoom(mode.id == 'zoom' ? zoomLevel : 0);
    _bridge.setStretch(mode.stretch);
    if (flash) {
      // Zoom shows its magnification (2^level, mpv's log2 zoom); others their
      // label — mirroring use-video-fill's apply().
      _flashPill(
        mode.id == 'zoom' && zoomLevel > 0
            ? 'Zoom ${(math.pow(2, zoomLevel) * 100).round()}%'
            : mode.label,
        Icons.aspect_ratio,
      );
    }
  }

  void _flashPill(String label, IconData icon) {
    setState(() {
      _hudPill = label;
      _hudPillIcon = icon;
    });
    _hudPillTimer?.cancel();
    _hudPillTimer = Timer(const Duration(milliseconds: 1200), () {
      if (mounted) setState(() => _hudPill = null);
    });
  }

  /// Steps the playback speed by [delta], clamped to 0.25–3× in 0.25 steps —
  /// the `playerSpeedUp`/`Down` hotkeys. Flashes the new rate.
  void _stepSpeed(double delta) {
    final r = ((_snap.rate + delta) * 100).roundToDouble() / 100;
    final clamped = r.clamp(0.25, 3.0);
    _bridge.setRate(clamped);
    _wakeChrome();
    final text = clamped == clamped.roundToDouble()
        ? '${clamped.toStringAsFixed(0)}×'
        : '$clamped×';
    _flashPill(text, Icons.speed);
  }

  void _toggleMute() {
    _bridge.setMuted(!_snap.muted);
    // Web `playerMute` always plays the up-tone (SFX.volumeChange(true)).
    if (ref.read(settingsProvider).getBool('playerVolumeSfx')) {
      ref.read(sfxServiceProvider).volumeChange(true);
    }
    _flashVolumeHud();
  }

  /// Nudges the subtitle timing offset by [delta] seconds (the
  /// `playerSubDelayDown`/`Up` hotkeys), applies it to the engine, and flashes
  /// the value. Positive shifts subtitles later.
  void _stepSubDelay(double delta) {
    _applySubDelay(_subDelay + delta);
    _wakeChrome();
    final sign = _subDelay > 0 ? '+' : '';
    _flashPill(
      'Subtitles $sign${_subDelay.toStringAsFixed(2)}s',
      Icons.subtitles,
    );
  }

  /// Sets the absolute subtitle-timing offset (seconds) on both engines and
  /// repaints the default engine's cue overlay. Shared by the `playerSubDelay`
  /// hotkeys and the live [SubSyncBar].
  void _applySubDelay(double sec) {
    final v = (sec * 100).roundToDouble() / 100;
    setState(() => _subDelay = v);
    _bridge.setSubDelay(v);
  }

  /// Applies an audio/video sync offset live (the shared sync bar's audio mode).
  void _applyAudioDelay(double sec) {
    final v = (sec * 100).roundToDouble() / 100;
    setState(() => _audioDelay = v);
    _bridge.setAudioDelay(v);
  }

  /// Advances to the next crop mode (the `playerCrop` hotkey), applying it,
  /// flashing the pill, and persisting the choice — mirrors `videoFill.cycle`.
  void _cycleCrop() {
    _cropIndex = (_cropIndex + 1) % kCropModes.length;
    final mode = kCropModes[_cropIndex];
    if (mode.id != 'zoom') _zoom = 0;
    _applyCrop(mode, flash: true, zoomLevel: _zoom);
    ref.read(settingsProvider.notifier).setValue('cropMode', mode.id);
  }

  /// Steps the Zoom mode's magnification (the `playerPanscanUp`/`Down`
  /// hotkeys), switching into Zoom first — mirrors `videoFill.step`.
  void _stepZoom(double delta) {
    final zoomIdx = kCropModes.indexWhere((m) => m.id == 'zoom');
    if (_cropIndex != zoomIdx) {
      _cropIndex = zoomIdx;
      ref.read(settingsProvider.notifier).setValue('cropMode', 'zoom');
    }
    _zoom = (((_zoom + delta) * 100).round() / 100).clamp(0.0, 1.0);
    _applyCrop(kCropModes[zoomIdx], flash: true, zoomLevel: _zoom);
  }

  Widget _pillHud(HarborTokens t) {
    final pill = _hudPill;
    if (pill == null) return const SizedBox.shrink();
    return Positioned.fill(
      child: IgnorePointer(
        child: Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: const EdgeInsets.only(top: 44),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.82),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(_hudPillIcon, color: Colors.white, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    pill,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _volumeHud(HarborTokens t) {
    if (!_volumeHudVisible) return const SizedBox.shrink();
    final vol = _snap.volume.clamp(0.0, 1.0);
    final muted = _snap.muted || vol <= 0;
    final pct = (muted ? 0.0 : vol * 100).round();
    final icon = muted
        ? Icons.volume_off
        : (vol < 0.5 ? Icons.volume_down : Icons.volume_up);

    final align = switch (ref
        .read(settingsProvider)
        .getString('playerVolumeHudPosition')) {
      'center' => Alignment.center,
      'top-left' => Alignment.topLeft,
      'top-right' => Alignment.topRight,
      _ => Alignment.topCenter, // 'top' (default)
    };

    return Positioned.fill(
      child: IgnorePointer(
        child: Padding(
          padding: const EdgeInsets.all(36),
          child: Align(
            alignment: align,
            child: Container(
              width: 256,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.82),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              ),
              child: Row(
                children: [
                  Icon(icon, color: Colors.white, size: 24),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'VOLUME',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.58),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.6,
                              ),
                            ),
                            Text(
                              muted ? 'Muted' : '$pct%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                fontFeatures: [FontFeature.tabularFigures()],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: muted ? 0 : vol,
                            minHeight: 8,
                            backgroundColor: Colors.white.withValues(
                              alpha: 0.15,
                            ),
                            valueColor: const AlwaysStoppedAnimation(
                              Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _leave() => ref.read(navControllerProvider.notifier).exitPlayer();

  /// Leaves the player, first asking for confirmation when playerConfirmLeave is
  /// on (ported from the Esc/Back handler in use-keyboard-shortcuts).
  void _close() {
    if (ref.read(settingsProvider).getBool('playerConfirmLeave')) {
      _confirmLeave();
    } else {
      _leave();
    }
  }

  void _confirmLeave() {
    final t = ref.read(tokensProvider);
    showDialog<void>(
      context: context,
      builder: (_) => _LeaveConfirmDialog(
        tokens: t,
        onLeave: () {
          Navigator.of(context).pop();
          _leave();
        },
        onLeaveDontAsk: () {
          Navigator.of(context).pop();
          ref
              .read(settingsProvider.notifier)
              .setValue('playerConfirmLeave', false);
          _leave();
        },
        onCancel: () => Navigator.of(context).pop(),
      ),
    );
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final key = event.logicalKey;
    // While the subtitle picker is open it owns the remote: Back/Escape closes
    // it, and every other key falls through to the picker's focus traversal and
    // controls instead of driving playback.
    if (_subtitleMenuOpen) {
      if (key == LogicalKeyboardKey.escape ||
          key == LogicalKeyboardKey.goBack ||
          key == LogicalKeyboardKey.browserBack) {
        setState(() => _subtitleMenuOpen = false);
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    }
    // The episode panel likewise owns the remote while open: Back/Escape closes
    // it, everything else falls through to the panel's own focus traversal.
    if (_episodePanelOpen) {
      if (key == LogicalKeyboardKey.escape ||
          key == LogicalKeyboardKey.goBack ||
          key == LogicalKeyboardKey.browserBack) {
        setState(() => _episodePanelOpen = false);
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    }
    // The speed picker owns the remote while open, same as the panels above.
    if (_speedMenuOpen) {
      if (key == LogicalKeyboardKey.escape ||
          key == LogicalKeyboardKey.goBack ||
          key == LogicalKeyboardKey.browserBack) {
        setState(() => _speedMenuOpen = false);
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    }
    // The live sub/audio-sync bar owns the remote while open: Back/Escape closes
    // only the bar (not the whole player), and every other key falls through to
    // the bar's own focus traversal so its ± / Done / Close controls stay usable.
    if (_showSyncBar) {
      if (key == LogicalKeyboardKey.escape ||
          key == LogicalKeyboardKey.goBack ||
          key == LogicalKeyboardKey.browserBack) {
        setState(() => _showSyncBar = false);
        return KeyEventResult.handled;
      }
      return KeyEventResult.ignored;
    }
    // When chrome is hidden, the first press only wakes it (except Back).
    final wakeOnly =
        !_chromeVisible &&
        key != LogicalKeyboardKey.escape &&
        key != LogicalKeyboardKey.goBack &&
        key != LogicalKeyboardKey.browserBack;

    if (key == LogicalKeyboardKey.escape ||
        key == LogicalKeyboardKey.goBack ||
        key == LogicalKeyboardKey.browserBack) {
      _close();
      return KeyEventResult.handled;
    }
    if (wakeOnly) {
      // A skip-intro/recap/outro prompt is the one on-screen action while the
      // chrome is asleep, so on a TV let OK act on it directly rather than only
      // waking the chrome — a single press skips, matching the prompt.
      if (_isTv &&
          (key == LogicalKeyboardKey.select ||
              key == LogicalKeyboardKey.enter ||
              key == LogicalKeyboardKey.gameButtonA)) {
        final seg = _activeSkipSegment();
        if (seg != null) {
          _bridge.seek(seg.endSec);
          return KeyEventResult.handled;
        }
      }
      _wakeChrome();
      return KeyEventResult.handled;
    }
    // On a TV, once the chrome is up the D-pad must navigate BETWEEN the
    // on-screen controls (focus traversal) and OK activates the focused one — so
    // let the directional + activate keys fall through to the focus system
    // instead of hijacking them for seek/volume/play (the bug where skip /
    // subtitle / etc. could not be selected). The chrome stays awake while the
    // remote moves; media-transport and letter shortcuts below still work.
    if (_isTv && _chromeVisible) {
      if (key == LogicalKeyboardKey.arrowUp ||
          key == LogicalKeyboardKey.arrowDown ||
          key == LogicalKeyboardKey.arrowLeft ||
          key == LogicalKeyboardKey.arrowRight ||
          key == LogicalKeyboardKey.select ||
          key == LogicalKeyboardKey.enter ||
          key == LogicalKeyboardKey.gameButtonA ||
          key == LogicalKeyboardKey.space) {
        _scheduleHide();
        return KeyEventResult.ignored;
      }
    }
    if (key == LogicalKeyboardKey.select ||
        key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.space ||
        key == LogicalKeyboardKey.gameButtonA ||
        key == LogicalKeyboardKey.mediaPlayPause) {
      _togglePlay();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.arrowLeft) {
      _seekBy(-_seekStep('seekBackStepSec'));
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.arrowRight) {
      _seekBy(_seekStep('seekForwardStepSec'));
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.mediaRewind) {
      _seekBy(-_mediaSeekSec);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.mediaFastForward) {
      _seekBy(_mediaSeekSec);
      return KeyEventResult.handled;
    }
    // playerSeekBack30 / playerSeekForward30 ("," / "."). With Shift they become
    // playerFrameBack / playerFrameForward — Shift+"," / Shift+"." arrive either
    // as the shifted key ("<" / ">") or as ","/"." with the Shift modifier held.
    if (key == LogicalKeyboardKey.comma || key == LogicalKeyboardKey.less) {
      if (key == LogicalKeyboardKey.less ||
          HardwareKeyboard.instance.isShiftPressed) {
        _bridge.frameStep(-1);
      } else {
        _seekBy(-_mediaSeekSec);
      }
      _wakeChrome();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.period || key == LogicalKeyboardKey.greater) {
      if (key == LogicalKeyboardKey.greater ||
          HardwareKeyboard.instance.isShiftPressed) {
        _bridge.frameStep(1);
      } else {
        _seekBy(_mediaSeekSec);
      }
      _wakeChrome();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.arrowUp) {
      _nudgeVolume(0.1);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.arrowDown) {
      _nudgeVolume(-0.1);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.keyC || key == LogicalKeyboardKey.keyS) {
      _cycleSubtitle();
      return KeyEventResult.handled;
    }
    // "t": open the subtitle-track picker.
    if (key == LogicalKeyboardKey.keyT) {
      _openSubtitles();
      return KeyEventResult.handled;
    }
    // "a": open the audio-track picker.
    if (key == LogicalKeyboardKey.keyA) {
      _openAudioMenu();
      return KeyEventResult.handled;
    }
    // playerSubDelayDown/Up ("z"/"x"): nudge subtitle timing (finer with Shift).
    if (key == LogicalKeyboardKey.keyZ || key == LogicalKeyboardKey.keyX) {
      final step = HardwareKeyboard.instance.isShiftPressed ? 0.05 : 0.1;
      _stepSubDelay(key == LogicalKeyboardKey.keyZ ? -step : step);
      return KeyEventResult.handled;
    }
    // playerCrop (default binding "v"): cycle aspect / crop modes.
    if (key == LogicalKeyboardKey.keyV) {
      _cycleCrop();
      return KeyEventResult.handled;
    }
    // playerPanscanUp/Down ("="/"-"): step the Zoom mode magnification.
    if (key == LogicalKeyboardKey.equal || key == LogicalKeyboardKey.add) {
      _stepZoom(0.1);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.minus ||
        key == LogicalKeyboardKey.numpadSubtract) {
      _stepZoom(-0.1);
      return KeyEventResult.handled;
    }
    // playerMute ("m").
    if (key == LogicalKeyboardKey.keyM) {
      _toggleMute();
      return KeyEventResult.handled;
    }
    // playerSpeedUp/Down ("]"/"[").
    if (key == LogicalKeyboardKey.bracketRight) {
      _stepSpeed(0.25);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.bracketLeft) {
      _stepSpeed(-0.25);
      return KeyEventResult.handled;
    }
    // playerStart/End ("Home"/"End"): jump to the start or near the end.
    if (key == LogicalKeyboardKey.home) {
      _bridge.seek(0);
      _wakeChrome();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.end) {
      if (_snap.durationSec > 0) _bridge.seek(_snap.durationSec - 0.5);
      _wakeChrome();
      return KeyEventResult.handled;
    }
    // playerStats ("i"): toggle the playback-stats overlay.
    if (key == LogicalKeyboardKey.keyI) {
      setState(() => _showStats = !_showStats);
      return KeyEventResult.handled;
    }
    // playerScreenshot ("p"): save the current frame as a PNG.
    if (key == LogicalKeyboardKey.keyP) {
      _takeScreenshot();
      return KeyEventResult.handled;
    }
    // playerNextEpisode / playerPrevEpisode ("n" / "b").
    if (key == LogicalKeyboardKey.keyN) {
      final next = _episodeNav().next;
      if (next != null) _goToEpisode(next);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.keyB) {
      final prev = _episodeNav().prev;
      if (prev != null) _goToEpisode(prev);
      return KeyEventResult.handled;
    }
    // playerStreamSwitcher ("w"): reopen the play picker for the current title
    // to switch source (only where sources are switchable — not live / IPTV).
    if (key == LogicalKeyboardKey.keyW && _canPickAnother) {
      _pickAnother();
      return KeyEventResult.handled;
    }
    // playerEpisodePanel ("e"): open the "Up Next" episode drawer (series only).
    if (key == LogicalKeyboardKey.keyE && _hasEpisodePanel) {
      _toggleEpisodePanel();
      return KeyEventResult.handled;
    }
    // playerPip ("u"): pop the video into a Picture-in-Picture window. Only where
    // the OS supports it (Android 8+); a no-op elsewhere, so the key falls
    // through rather than being swallowed.
    if (key == LogicalKeyboardKey.keyU &&
        Platform.isAndroid &&
        _bridge.capabilities().pictureInPicture) {
      _enterPip();
      return KeyEventResult.handled;
    }
    // playerSleep ("l"): toggle a sleep timer that pauses at the end of this
    // episode (VOD only, matching the web hotkey).
    if (key == LogicalKeyboardKey.keyL && !widget.isLive) {
      _toggleSleepEndEpisode();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  /// Toggles the end-of-episode sleep timer (the "l" hotkey): arms it when no
  /// sleep is set, cancels any armed sleep otherwise, flashing the change.
  void _toggleSleepEndEpisode() {
    final tr = ref.read(translationsProvider);
    if (ref.read(sleepTimerProvider) is SleepOff) {
      _setSleepPreset(const SleepPreset(id: 'ep', label: 'End of episode'));
      _flashPill(tr.t('Sleep at end of episode'), Icons.bedtime_outlined);
    } else {
      _cancelSleep();
      _flashPill(tr.t('Sleep off'), Icons.bedtime_off_outlined);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _onKey,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _chromeVisible ? _togglePlay : _wakeChrome,
        child: ColoredBox(
          color: const Color(0xFF000000),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: _bridge.buildView(
                  subtitleStyleFrom(ref.watch(settingsProvider)),
                ),
              ),
              if (_defaultEngine && _externalCues.isNotEmpty)
                Positioned.fill(
                  child: IgnorePointer(
                    child: SubtitleOverlay(
                      cues: _externalCues,
                      position: _bridge.clock.position,
                      offsetSec: _subDelay,
                      style: subtitleStyleFrom(ref.watch(settingsProvider)),
                    ),
                  ),
                ),
              // The sailboat loading animation (web `HarborLoader`): the big
              // captioned boat while the title loads, a small one for mid-play
              // buffering.
              if (_snap.status == PlayerStatus.loading)
                Center(
                  child: HarborLoader(
                    size: HarborLoaderSize.lg,
                    caption: ref.watch(translationsProvider).t('Loading'),
                  ),
                )
              else if (_snap.buffering)
                const Center(child: HarborLoader(size: HarborLoaderSize.sm)),
              if (_snap.status == PlayerStatus.error) _errorState(t),
              // While casting, a receiver plays this title — cover the local
              // (paused) video with the casting surface.
              if (_casting) _castOverlay(t),
              AnimatedOpacity(
                opacity: _chromeVisible ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: IgnorePointer(
                  ignoring: !_chromeVisible,
                  // On a TV, map the remote's OK keys to Activate so the focused
                  // on-screen control fires (Material only binds Enter/Space),
                  // and group the controls for directional D-pad traversal.
                  child: _isTv
                      ? FocusTraversalGroup(
                          child: Shortcuts(
                            shortcuts: const {
                              SingleActivator(LogicalKeyboardKey.select):
                                  ActivateIntent(),
                              SingleActivator(LogicalKeyboardKey.gameButtonA):
                                  ActivateIntent(),
                            },
                            child: _chrome(t),
                          ),
                        )
                      : _chrome(t),
                ),
              ),
              // The skip pill shows during a segment, over the chrome.
              _skipPill(t),
              // The injected-ad report button (when the feature is on).
              _adReportButton(t),
              // The volume HUD flashes on volume change.
              _volumeHud(t),
              // The pill flashes on aspect/crop and speed changes.
              _pillHud(t),
              // The playback-stats overlay (toggled with "i").
              if (_showStats) _statsOverlay(t),
              // The Anime4K activity badge while upscaling shaders run.
              _anime4kIndicatorOverlay(t),
              // The next-episode countdown card during a series episode's outro.
              _nextEpisodePill(t),
              // The resume prompt sits over everything until acknowledged.
              _resumePrompt(t),
              // The live sync bar — subtitle timing (from the subtitle menu) or
              // audio/video sync (from the audio menu), sharing one control.
              if (_showSyncBar)
                SubSyncBar(
                  initialDelay: _syncBarIsAudio ? _audioDelay : _subDelay,
                  tokens: t,
                  onDelay: _syncBarIsAudio ? _applyAudioDelay : _applySubDelay,
                  onClose: () => setState(() => _showSyncBar = false),
                ),
              // The full two-pane subtitle picker (over everything, remote-owned).
              if (_subtitleMenuOpen)
                SubtitlePicker(
                  tokens: t,
                  tr: ref.watch(translationsProvider),
                  variants: _subtitleVariants(),
                  selectedKey: _selectedSubtitleKey(),
                  delayActive: _subDelay != 0,
                  searching: _searchingSubs,
                  // Picking a track (or Off) applies it and closes the picker,
                  // so the result is immediately visible over the video.
                  onSelect: (key) {
                    _onSubtitleSelect(key);
                    setState(() => _subtitleMenuOpen = false);
                  },
                  onOff: () {
                    _applySubtitle(-1);
                    setState(() => _subtitleMenuOpen = false);
                  },
                  onSync: () => setState(() {
                    _syncBarIsAudio = false;
                    _showSyncBar = true;
                  }),
                  onSearch: _runSubtitleSearch,
                  onClose: () => setState(() => _subtitleMenuOpen = false),
                ),
              // The "Up Next" episode drawer (over everything, remote-owned).
              if (_episodePanelOpen && _hasEpisodePanel)
                EpisodesPanel(
                  tokens: t,
                  metaId: widget.contentId ?? '',
                  seriesName: _meta?.name ?? widget.title ?? '',
                  videos: _meta?.videos ?? const <VideoRef>[],
                  currentSeason: widget.season,
                  currentEpisode: widget.episode,
                  onPlay: (ep) {
                    setState(() => _episodePanelOpen = false);
                    _goToEpisode(ep);
                  },
                  onRestart: _restartCurrent,
                  onClose: () => setState(() => _episodePanelOpen = false),
                ),
              // The playback-speed picker (curated + custom speeds, remote-owned).
              if (_speedMenuOpen)
                SpeedPicker(
                  tokens: t,
                  tr: ref.watch(translationsProvider),
                  current: _snap.rate,
                  custom: ref
                      .watch(settingsProvider)
                      .getDoubleList('customPlaybackSpeeds'),
                  onSelect: _applySpeed,
                  onAddCustom: _addCustomSpeed,
                  onRemoveCustom: _removeCustomSpeed,
                  // The sleep section shows for VOD (not live channels).
                  showSleep: !widget.isLive,
                  sleepSelectedId: _sleepModeId(ref.watch(sleepTimerProvider)),
                  sleepActiveLabel: _sleepRemaining == null
                      ? null
                      : _fmtRemaining(_sleepRemaining!),
                  sleepCustom: ref
                      .watch(settingsProvider)
                      .getDoubleList('customSleepMinutes')
                      .map((e) => e.toInt())
                      .toList(),
                  onSleepPreset: _setSleepPreset,
                  onAddSleepCustom: _addCustomSleep,
                  onRemoveSleepCustom: _removeCustomSleep,
                  onSleepCancel: _cancelSleep,
                  onClose: () => setState(() => _speedMenuOpen = false),
                ),
              // The anime tracker-sync status pill.
              const SyncToast(),
            ],
          ),
        ),
      ),
    );
  }

  /// The playback-stats overlay (`playerStats`): the live engine and media
  /// telemetry the snapshot carries — engine, resolution, HDR, decode path,
  /// position/duration, buffer ahead, speed, volume, and the active tracks.
  /// Read-only and non-interactive, dismissed by pressing "i" again.
  Widget _statsOverlay(HarborTokens t) {
    final s = _snap;
    final caps = _bridge.capabilities();
    TrackInfo? selected(List<TrackInfo> tracks) {
      for (final tr in tracks) {
        if (tr.selected) return tr;
      }
      return null;
    }

    final audio = selected(s.audioTracks);
    final sub = selected(s.subtitleTracks);
    String audioLabel() {
      if (audio == null) return s.noAudio ? 'none' : '—';
      final parts = <String>[
        if (audio.lang != null && audio.lang!.isNotEmpty) audio.lang!,
        if (audio.codec != null && audio.codec!.isNotEmpty) audio.codec!,
        if (audio.channels != null && audio.channels!.isNotEmpty)
          audio.channels!,
      ];
      return parts.isEmpty ? audio.label : parts.join(' · ');
    }

    final rows = <(String, String)>[
      ('Engine', _defaultEngine ? 'Default (native)' : 'mpv (media_kit)'),
      if (s.videoWidth > 0 && s.videoHeight > 0)
        ('Resolution', '${s.videoWidth} × ${s.videoHeight}'),
      if (realQualityLabel(s.videoWidth, s.videoHeight) case final q?)
        ('Quality', q),
      if (s.hdrGamma.isNotEmpty) ('HDR', s.hdrGamma.toUpperCase()),
      ('Decode', caps.hardwareDecode ? 'Hardware' : 'Software'),
      ('Speed', '${s.rate.toStringAsFixed(2)}×'),
      ('Volume', s.muted ? 'Muted' : '${(s.volume * 100).round()}%'),
      ('Audio', audioLabel()),
      ('Subtitles', sub == null ? 'Off' : (sub.lang ?? sub.label)),
      if (s.subDelaySec != 0)
        ('Sub delay', '${(s.subDelaySec * 1000).round()} ms'),
      if (s.audioDelaySec != 0)
        ('Audio delay', '${(s.audioDelaySec * 1000).round()} ms'),
    ];

    Widget line(String k, String v) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              k,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );

    return Positioned(
      top: 28,
      left: 28,
      child: IgnorePointer(
        child: Container(
          width: 272,
          padding: const EdgeInsets.fromLTRB(16, 14, 18, 14),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Playback stats',
                  style: TextStyle(
                    color: t.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              for (final (k, v) in rows) line(k, v),
              // Live position / buffer, refreshed off the playback clock.
              ValueListenableBuilder<double>(
                valueListenable: _bridge.clock.position,
                builder: (context, pos, _) {
                  final dur = s.durationSec;
                  final ahead = (s.bufferedSec - pos).clamp(0, double.infinity);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      line(
                        'Position',
                        dur > 0 ? '${_fmt(pos)} / ${_fmt(dur)}' : _fmt(pos),
                      ),
                      line('Buffer', '+${ahead.toStringAsFixed(1)}s'),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _errorState(HarborTokens t) => Center(
    child: Padding(
      padding: const EdgeInsets.all(48),
      child: Text(
        _snap.errorMessage ?? 'Playback failed.',
        textAlign: TextAlign.center,
        style: TextStyle(color: t.danger, fontSize: 16),
      ),
    ),
  );

  /// The full-screen "Casting to …" surface shown over the video while a
  /// Chromecast session plays this title — device name, controls, and stop.
  Widget _castOverlay(HarborTokens t) {
    return Positioned.fill(
      child: ColoredBox(
        color: t.canvas,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cast_connected_rounded, size: 64, color: t.accent),
              const SizedBox(height: 20),
              Text(
                'Casting to ${_castDevice.isEmpty ? 'a device' : _castDevice}',
                style: TextStyle(color: t.inkMuted, fontSize: 14),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Text(
                  widget.title ?? '',
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 28),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _PlayerIconButton(
                    tokens: t,
                    icon: _castPaused ? Icons.play_arrow : Icons.pause,
                    iconSize: 44,
                    color: t.ink,
                    tooltip: _castPaused ? 'Play' : 'Pause',
                    onPressed: _toggleCastPlay,
                  ),
                  const SizedBox(width: 24),
                  Focusable(
                    tokens: t,
                    scale: 1.0,
                    borderRadius: 999,
                    onPressed: () =>
                        ref.read(castControllerProvider).disconnect(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: t.edge),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.stop_rounded, size: 18, color: t.ink),
                          const SizedBox(width: 8),
                          Text(
                            'Stop casting',
                            style: TextStyle(
                              color: t.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
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

  /// The "AirPlaying · device" pill, shown while a route is engaged (empty
  /// otherwise). The picker button itself turns accent-colored when active.
  Widget _airPlayIndicator(HarborTokens t) {
    final st =
        ref.watch(airPlayStateProvider).asData?.value ?? AirPlayState.inactive;
    if (!st.active || st.deviceName.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: t.accent.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.accent.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.airplay_rounded, size: 14, color: t.accent),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 160),
              child: Text(
                st.deviceName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chrome(HarborTokens t) {
    const shadow = Color(0xCC000000);
    // The title font follows the playerTitleScale SizeSlider (0.8–1.6), matching
    // `Math.round(19 * scale)` in the web transport title.
    final titleScale = ref
        .watch(settingsProvider)
        .getDouble('playerTitleScale')
        .clamp(0.8, 1.6);
    return Column(
      children: [
        DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [shadow, Colors.transparent],
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              child: Row(
                children: [
                  _PlayerIconButton(
                    tokens: t,
                    icon: Icons.arrow_back,
                    tooltip: 'Back',
                    onPressed: _close,
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: _titleInfo(titleScale)),
                  // Casting: ONE control listing every target the platform
                  // supports. Where the platform is a Cast sender, CastControl's
                  // picker also offers AirPlay (on Apple); an AirPlay-only
                  // platform uses the native route picker as the control. The
                  // "AirPlaying · <device>" pill is a status indicator, not a
                  // second button.
                  if (_bridge.capabilities().airplay ||
                      _bridge.capabilities().chromecast) ...[
                    const SizedBox(width: 8),
                    if (_bridge.capabilities().airplay) _airPlayIndicator(t),
                    if (_bridge.capabilities().chromecast)
                      CastControl(
                        includeAirplay: _bridge.capabilities().airplay,
                      )
                    else
                      AirPlayButton(tint: Colors.white, activeTint: t.accent),
                  ],
                ],
              ),
            ),
          ),
        ),
        const Spacer(),
        DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [shadow, Colors.transparent],
            ),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _seekBar(t),
                  const SizedBox(height: 8),
                  Builder(
                    builder: (context) {
                      final nav = _episodeNav();
                      return Row(
                        children: [
                          // Previous episode ("b") — series only, when one exists.
                          if (nav.prev != null)
                            _PlayerIconButton(
                              tokens: t,
                              icon: Icons.skip_previous,
                              tooltip: 'Previous episode',
                              onPressed: () => _goToEpisode(nav.prev!),
                            ),
                          // Skip back by the configured step (also Left).
                          _skipButton(t, back: true),
                          _PlayerIconButton(
                            tokens: t,
                            focusNode: _playPauseFocus,
                            iconSize: 40,
                            icon: _snap.status == PlayerStatus.playing
                                ? Icons.pause
                                : Icons.play_arrow,
                            tooltip: _snap.status == PlayerStatus.playing
                                ? 'Pause'
                                : 'Play',
                            onPressed: _togglePlay,
                          ),
                          // Skip forward by the configured step (also Right).
                          _skipButton(t, back: false),
                          // Next episode ("n") — series only, when one exists.
                          if (nav.next != null)
                            _PlayerIconButton(
                              tokens: t,
                              icon: Icons.skip_next,
                              tooltip: 'Next episode',
                              onPressed: () => _goToEpisode(nav.next!),
                            ),
                          // The secondary controls sit flush-right on a wide TV
                          // (the min-width constraint fills the row and end-aligns
                          // them) but scroll horizontally instead of overflowing
                          // on a narrow phone — leftmost-first, so the primary
                          // controls stay on screen and the branded focus targets
                          // never clip. The D-pad scrolls the focused one in view.
                          Expanded(
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                return SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  child: ConstrainedBox(
                                    constraints: BoxConstraints(
                                      minWidth: constraints.maxWidth,
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        // Episodes ("Up Next") panel — browse and
                                        // jump between this series' episodes without
                                        // leaving playback. Also the "e" key.
                                        // Multi-episode series only.
                                        if (_hasEpisodePanel) ...[
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.video_library_outlined,
                                            tooltip: 'Episodes',
                                            onPressed: _toggleEpisodePanel,
                                          ),
                                          const SizedBox(width: 12),
                                        ],
                                        // Pick another source — reopens the picker for this
                                        // title so the viewer can switch streams.
                                        if (_canPickAnother) ...[
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.swap_horiz,
                                            tooltip: 'Pick another source',
                                            onPressed: _pickAnother,
                                          ),
                                          const SizedBox(width: 12),
                                        ],
                                        // Audio track picker (remote-reachable; also the "a" key).
                                        if (_snap.audioTracks.length > 1) ...[
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.multitrack_audio,
                                            tooltip: 'Audio track',
                                            onPressed: _openAudioMenu,
                                          ),
                                          const SizedBox(width: 12),
                                        ],
                                        // Subtitle menu — lists the embedded/engine tracks,
                                        // any searched subtitles, Off, Search and Sync. Always
                                        // available on VOD (the web hides it only for a live
                                        // channel with no tracks at all). Icon-only when off;
                                        // shows the active language when a track is on.
                                        if (!(widget.isLive &&
                                            _availableSubs.isEmpty &&
                                            _snap.subtitleTracks.isEmpty)) ...[
                                          if (_activeSubtitleLabel != null)
                                            _PlayerIconButton(
                                              tokens: t,
                                              icon: Icons.closed_caption,
                                              label: _activeSubtitleLabel!,
                                              labelColor: t.accent,
                                              tooltip: 'Subtitles',
                                              onPressed: _openSubtitles,
                                            )
                                          else
                                            _PlayerIconButton(
                                              tokens: t,
                                              icon:
                                                  Icons.closed_caption_outlined,
                                              tooltip: 'Subtitles',
                                              onPressed: _openSubtitles,
                                            ),
                                          const SizedBox(width: 12),
                                        ],
                                        // Speed & sleep picker (remote-reachable; also "[" /
                                        // "]"). Shows the sleep countdown when a minutes timer
                                        // is armed, else the rate, else a plain speed icon.
                                        if (_sleepRemaining != null)
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.timer_outlined,
                                            label: _fmtRemaining(
                                              _sleepRemaining!,
                                            ),
                                            labelColor: t.accent,
                                            tooltip: 'Playback speed',
                                            onPressed: _openSpeedMenu,
                                          )
                                        else if (_snap.rate == 1.0)
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.speed,
                                            tooltip: 'Playback speed',
                                            onPressed: _openSpeedMenu,
                                          )
                                        else
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.speed,
                                            label: '${_speedText(_snap.rate)}×',
                                            labelColor: t.accent,
                                            tooltip: 'Playback speed',
                                            onPressed: _openSpeedMenu,
                                          ),
                                        const SizedBox(width: 12),
                                        // Aspect / crop picker — mpv engine only, matching the
                                        // web aspect menu (the default engine has no crop control).
                                        if (!_defaultEngine) ...[
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons.aspect_ratio,
                                            tooltip: 'Aspect ratio',
                                            onPressed: _openAspectMenu,
                                          ),
                                          const SizedBox(width: 12),
                                          // Anime4K upscaling — mpv only, once the shader pack
                                          // is installed (the web anime4kAvailable gate).
                                          if (ref
                                              .read(settingsProvider)
                                              .getString('playerAnime4kFolder')
                                              .isNotEmpty) ...[
                                            Builder(
                                              builder: (context) {
                                                final choice =
                                                    anime4kDisplayChoice(
                                                      ref.read(
                                                        settingsProvider,
                                                      ),
                                                      id: widget.contentId,
                                                      genres:
                                                          _meta?.genres ??
                                                          const [],
                                                    );
                                                final active =
                                                    choice != 'auto' &&
                                                    choice != 'off';
                                                return _PlayerIconButton(
                                                  tokens: t,
                                                  icon: Icons.auto_awesome,
                                                  color: active
                                                      ? t.accent
                                                      : Colors.white,
                                                  tooltip: 'Anime4K upscaling',
                                                  onPressed: _openAnime4kMenu,
                                                );
                                              },
                                            ),
                                            const SizedBox(width: 12),
                                          ],
                                        ],
                                        // Download the currently-playing stream straight to
                                        // the device (web's player download control). Hidden
                                        // on live and when already playing a local download.
                                        if (!widget.isLive &&
                                            !isLocalMediaUrl(widget.url)) ...[
                                          _downloadButton(t),
                                          const SizedBox(width: 12),
                                        ],
                                        // Picture-in-Picture — shrink the player into a
                                        // floating window so playback continues while
                                        // another app is used. Android handheld only
                                        // (Activity-level PiP, so it works on either engine;
                                        // iOS PiP needs the native player and TVs have no PiP).
                                        if (Platform.isAndroid && !_isTv) ...[
                                          _PlayerIconButton(
                                            tokens: t,
                                            icon: Icons
                                                .picture_in_picture_alt_outlined,
                                            tooltip: 'Picture in picture',
                                            onPressed: _enterPip,
                                          ),
                                          const SizedBox(width: 12),
                                        ],
                                        _clockLabel(t),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _seekBar(HarborTokens t) {
    final s = ref.watch(settingsProvider);
    final colorHex = s.getString('seekBarColor');
    // Empty = Harbor's default gold, matching web's `accent || '#f0c674'`.
    const defaultGold = Color(0xFFF0C674);
    final accent = colorHex.isEmpty
        ? defaultGold
        : (parseCssColor(colorHex) ?? defaultGold);
    return PlayerSeekBar(
      position: _bridge.clock.position,
      buffered: _bridge.clock.buffered,
      durationSec: _snap.durationSec,
      accent: accent,
      barHeight: s.getInt('seekBarHeight').toDouble().clamp(3.0, 14.0),
      fillEnabled: s.getBool('seekBarFill'),
      fillOpacity: s.getDouble('seekBarFillOpacity').clamp(0.05, 1.0),
      dotShape: s.getString('seekDotShape').isEmpty
          ? 'circle'
          : s.getString('seekDotShape'),
      dotSize: s.getInt('seekDotSize').toDouble(),
      dotImage: s.getString('seekDotImage').isEmpty
          ? null
          : s.getString('seekDotImage'),
      barStyle: s.getString('seekBarStyle').isEmpty
          ? 'flat'
          : s.getString('seekBarStyle'),
      barImage: s.getString('seekBarImage').isEmpty
          ? null
          : s.getString('seekBarImage'),
      onSeek: (sec) {
        _bridge.seek(sec);
        _pushNowPlaying(positionOverride: sec);
        _wakeChrome();
      },
      onScrub: (sec) {
        setState(() => _scrubSec = sec);
        if (sec != null) _wakeChrome();
      },
    );
  }

  Widget _clockLabel(HarborTokens t) => ValueListenableBuilder<double>(
    valueListenable: _bridge.clock.position,
    builder: (context, pos, _) => Text(
      '${_fmt(_scrubSec ?? pos)} / ${_fmt(_snap.durationSec)}',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontFeatures: [FontFeature.tabularFigures()],
      ),
    ),
  );

  String _fmt(double sec) {
    final s = sec.round();
    final h = s ~/ 3600;
    final m = (s % 3600) ~/ 60;
    final ss = s % 60;
    final mm = m.toString().padLeft(2, '0');
    final sss = ss.toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$sss' : '$mm:$sss';
  }
}

/// A focusable pill button used by the player overlays (skip pill, etc.).
class _AdRange {
  _AdRange(this.start, this.end);
  double start;
  double end;
}

enum _AdReportStatus { idle, sending, sent, error }

/// The injected-ad report dialog: mark one or more ad ranges (using the live
/// playback position) and submit them for review. Ports web `AdReportModal`.
class _AdReportSheet extends StatefulWidget {
  const _AdReportSheet({
    required this.tokens,
    required this.positionSec,
    required this.onSubmit,
  });

  final HarborTokens tokens;
  final double Function() positionSec;
  final Future<bool> Function(List<({double startSec, double endSec})> ranges)
  onSubmit;

  @override
  State<_AdReportSheet> createState() => _AdReportSheetState();
}

class _AdReportSheetState extends State<_AdReportSheet> {
  late final List<_AdRange> _ranges;
  _AdReportStatus _status = _AdReportStatus.idle;

  @override
  void initState() {
    super.initState();
    final pos = widget.positionSec();
    _ranges = [_AdRange(pos.roundToDouble(), (pos + 30).roundToDouble())];
  }

  String _fmt(double sec) {
    final s = sec.round().clamp(0, 1 << 30);
    final h = s ~/ 3600;
    final mm = ((s % 3600) ~/ 60).toString().padLeft(2, '0');
    final ss = (s % 60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
  }

  bool get _valid =>
      _ranges.isNotEmpty && _ranges.every((r) => r.end > r.start);

  Future<void> _send() async {
    if (!_valid || _status == _AdReportStatus.sending) return;
    setState(() => _status = _AdReportStatus.sending);
    final ok = await widget.onSubmit([
      for (final r in _ranges) (startSec: r.start, endSec: r.end),
    ]);
    if (!mounted) return;
    setState(() => _status = ok ? _AdReportStatus.sent : _AdReportStatus.error);
    if (ok) {
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Report an injected ad',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Mark the ad range(s) with the live position. Reports are sent '
                'for review before they ever skip for anyone.',
                style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 16),
              for (var i = 0; i < _ranges.length; i++) _rangeRow(t, i),
              const SizedBox(height: 4),
              _PlayerButton(
                tokens: t,
                filled: false,
                onPressed: () {
                  final pos = widget.positionSec();
                  setState(
                    () => _ranges.add(
                      _AdRange(pos.roundToDouble(), (pos + 30).roundToDouble()),
                    ),
                  );
                },
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add, size: 16, color: t.ink),
                    const SizedBox(width: 6),
                    Text(
                      'Mark another range',
                      style: TextStyle(color: t.ink, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  if (_status == _AdReportStatus.error)
                    Expanded(
                      child: Text(
                        "Couldn't send — try again.",
                        style: TextStyle(color: t.danger, fontSize: 12.5),
                      ),
                    )
                  else if (_status == _AdReportStatus.sent)
                    Expanded(
                      child: Text(
                        'Sent for review. Thanks!',
                        style: TextStyle(color: t.success, fontSize: 12.5),
                      ),
                    )
                  else
                    const Spacer(),
                  _PlayerButton(
                    tokens: t,
                    filled: false,
                    onPressed: () => Navigator.of(context).pop(),
                    child: Text(
                      'Cancel',
                      style: TextStyle(color: t.inkMuted, fontSize: 13),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _PlayerButton(
                    tokens: t,
                    autofocus: true,
                    onPressed: _send,
                    child: Text(
                      _status == _AdReportStatus.sending
                          ? 'Sending…'
                          : 'Send report',
                      style: TextStyle(
                        color: t.canvas,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
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

  Widget _rangeRow(HarborTokens t, int i) {
    final r = _ranges[i];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '${_fmt(r.start)} – ${_fmt(r.end)}',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (_ranges.length > 1)
                _PlayerButton(
                  tokens: t,
                  filled: false,
                  onPressed: () => setState(() => _ranges.removeAt(i)),
                  child: Icon(Icons.close, size: 16, color: t.inkMuted),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _PlayerButton(
                  tokens: t,
                  filled: false,
                  onPressed: () => setState(
                    () => r.start = widget.positionSec().roundToDouble(),
                  ),
                  child: Text(
                    'Start = now',
                    style: TextStyle(color: t.ink, fontSize: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _PlayerButton(
                  tokens: t,
                  filled: false,
                  onPressed: () => setState(
                    () => r.end = widget.positionSec().roundToDouble(),
                  ),
                  child: Text(
                    'End = now',
                    style: TextStyle(color: t.ink, fontSize: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlayerButton extends StatelessWidget {
  const _PlayerButton({
    required this.tokens,
    required this.onPressed,
    required this.child,
    this.filled = true,
    this.autofocus = false,
  });

  final HarborTokens tokens;
  final VoidCallback onPressed;
  final Widget child;
  final bool filled;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      autofocus: autofocus,
      borderRadius: 999,
      onPressed: onPressed,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: filled ? t.ink : t.canvas.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(999),
          border: filled ? null : Border.all(color: t.edge),
        ),
        child: child,
      ),
    );
  }
}

/// A remote-navigable player control: an icon (optionally with a trailing label)
/// that shows the branded [Focusable] ring + scale when the D-pad / keyboard
/// lands on it, so on a 10-foot TV the focused control is unmistakable — a plain
/// [IconButton] only paints Material's faint default highlight, which is why the
/// transport / subtitle / speed controls "could not be selected" from the couch.
/// Tap and hover still work for touch and desktop.
class _PlayerIconButton extends StatelessWidget {
  const _PlayerIconButton({
    required this.tokens,
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.color = Colors.white,
    this.label,
    this.labelColor,
    this.iconSize = 26,
    this.focusNode,
  });

  final HarborTokens tokens;
  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final Color color;

  /// When set, the control shows the icon plus this trailing label (the web's
  /// active-subtitle language, current speed, sleep countdown, A–B state).
  final String? label;
  final Color? labelColor;
  final double iconSize;

  /// An external node so the parent can park the remote here (play/pause).
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    final fg = labelColor ?? color;
    final Widget content = label == null
        ? Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon, size: iconSize, color: color),
          )
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: iconSize - 4, color: fg),
                const SizedBox(width: 6),
                Text(
                  label!,
                  style: TextStyle(color: fg, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          );
    return Tooltip(
      message: tooltip,
      child: Focusable(
        tokens: tokens,
        focusNode: focusNode,
        borderRadius: 999,
        scale: 1.12,
        onPressed: onPressed,
        child: content,
      ),
    );
  }
}

/// The remote-navigable leave-the-player confirmation (`playerConfirmLeave`):
/// Stay (autofocused), Leave, or Leave and stop asking.
class _LeaveConfirmDialog extends StatelessWidget {
  const _LeaveConfirmDialog({
    required this.tokens,
    required this.onLeave,
    required this.onLeaveDontAsk,
    required this.onCancel,
  });

  final HarborTokens tokens;
  final VoidCallback onLeave;
  final VoidCallback onLeaveDontAsk;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Dialog(
      backgroundColor: t.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Leave the player?',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 12,
                runSpacing: 10,
                children: [
                  _PlayerButton(
                    tokens: t,
                    filled: false,
                    onPressed: onLeaveDontAsk,
                    child: _label("Leave, don't ask again", t.ink),
                  ),
                  _PlayerButton(
                    tokens: t,
                    filled: false,
                    onPressed: onLeave,
                    child: _label('Leave', t.ink),
                  ),
                  _PlayerButton(
                    tokens: t,
                    filled: true,
                    autofocus: true,
                    onPressed: onCancel,
                    child: _label('Stay', t.canvas),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text, Color color) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
    child: Text(
      text,
      style: TextStyle(color: color, fontWeight: FontWeight.w600),
    ),
  );
}

/// The next-episode countdown card, ported from the web `UpNextCard`: the next
/// episode's still, an "Up next in Ns" line, a Play-now action, and a dismiss.
class _NextEpisodeCard extends StatelessWidget {
  const _NextEpisodeCard({
    required this.tokens,
    required this.still,
    required this.epLabel,
    required this.title,
    required this.seconds,
    required this.onPlay,
    required this.onCancel,
  });

  final HarborTokens tokens;
  final String? still;
  final String epLabel;
  final String? title;
  final int seconds;
  final VoidCallback onPlay;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      width: 360,
      height: 120,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 148,
            child: still != null
                ? CachedNetworkImage(
                    imageUrl: still!,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) =>
                        ColoredBox(color: Colors.white.withValues(alpha: 0.05)),
                  )
                : ColoredBox(color: Colors.white.withValues(alpha: 0.05)),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Up next in ${seconds}s',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.4,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              title ?? epLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (title != null)
                              Text(
                                epLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.55),
                                  fontSize: 11.5,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Focusable(
                        tokens: t,
                        borderRadius: 999,
                        onPressed: onCancel,
                        child: Container(
                          width: 26,
                          height: 26,
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.close,
                            size: 15,
                            color: Colors.white.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Focusable(
                    tokens: t,
                    autofocus: true,
                    borderRadius: 999,
                    onPressed: onPlay,
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.play_arrow, size: 16, color: Colors.black),
                          SizedBox(width: 4),
                          Text(
                            'Play now',
                            style: TextStyle(
                              color: Colors.black,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
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
}
