import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/anilist_providers.dart';
import '../../app/download_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/mal_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/parental_providers.dart';
import '../../app/profiles_providers.dart';
import '../../app/providers.dart';
import '../../app/self_avatar.dart';
import '../../app/simkl_providers.dart';
import '../../app/theme_controller.dart';
import '../../app/voice_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/ui_sound.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/awards/wikidata_awards.dart';
import '../../domain/catalog/filter_rails.dart';
import '../../domain/downloads/downloads_store.dart';
import '../../domain/nav/frame.dart';
import '../../domain/nav/nav_items.dart';
import '../../domain/profiles/parental.dart';
import '../../domain/settings/settings.dart';
import '../../domain/sports/sports_espn.dart';
import '../addons/addons_view.dart';
import '../../domain/anime/anime_awards.dart' show AwardSourceId;
import '../anime/anime_award_view.dart';
import '../anime/anime_view.dart';
import '../discover/discover_view.dart';
import '../queue/queue_view.dart';
import '../addons/detail/addon_detail_view.dart';
import '../addons/organize/organize_addons_view.dart';
import '../calendar/calendar_view.dart';
import '../catalog/catalog_rows_view.dart';
import '../catalog/catalogs_view.dart';
import '../live/live_view.dart';
import '../multiview/multiview_view.dart';
import '../live/sports/match_detail_view.dart';
import '../vod/vod_view.dart';
import '../collection/collection_view.dart';
import '../collection/collections_view.dart';
import '../award/award_view.dart';
import '../detail/detail_view.dart';
import 'parental_pin_dialog.dart';
import 'profile_switcher.dart';
import '../detail/episode_detail_view.dart';
import '../downloads/downloads_view.dart';
import '../home/home_view.dart';
import '../person/person_view.dart';
import '../picker/picker_view.dart';
import '../player/player_view.dart';
import '../grid/grid_view.dart';
import '../filter/filter_view.dart';
import '../kids/kids_franchise_view.dart';
import '../kids/kids_detail_view.dart';
import '../kids/kids_view.dart';
import '../library/library_view.dart';
import '../wrapped/wrapped_view.dart';
import '../search/search_view.dart';
import '../settings/settings_view.dart';
import '../streaming/service_view.dart';
import 'nav_icons.dart';

/// The persistent app shell: a remote-navigable nav rail plus the active view.
/// The rail lists the implemented tabs; more land as their views are built.
class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final state = ref.watch(navControllerProvider);

    // Identity sync (web `ProfileIdentitySync`): keep the global `harborAvatar`
    // mirror pointed at the active profile's own avatar, so an avatar adopted on
    // one profile can never leak onto another avatar-less profile's chip. Kid
    // profiles are excluded (their reserved avatars are not identity mirrors).
    ref.listen(activeProfileProvider, (_, next) {
      if (next == null || next.isKid) return;
      if (ref.read(settingsProvider)['harborAvatar'] != next.avatar) {
        ref
            .read(settingsProvider.notifier)
            .setValue('harborAvatar', next.avatar);
      }
    });

    // AnilistAvatarSync (web): while "use my AniList avatar" is on, mirror the
    // AniList picture onto the active profile (ProfileIdentitySync then carries
    // it to harborAvatar). Forward-only — turning the toggle off leaves the
    // adopted avatar in place, matching web.
    ref.listen(anilistAvatarSyncProvider, (_, next) {
      if (!next.on || next.avatar == null) return;
      final active = ref.read(activeProfileProvider);
      if (active != null && !active.isKid && active.avatar != next.avatar) {
        ref
            .read(profilesProvider.notifier)
            .updateProfile(active.id, (p) => p.copyWith(avatar: next.avatar));
      }
    });

    // MalAvatarSync (web): same forward-only mirror for the MyAnimeList avatar.
    ref.listen(malAvatarSyncProvider, (_, next) {
      if (!next.on || next.avatar == null) return;
      final active = ref.read(activeProfileProvider);
      if (active != null && !active.isKid && active.avatar != next.avatar) {
        ref
            .read(profilesProvider.notifier)
            .updateProfile(active.id, (p) => p.copyWith(avatar: next.avatar));
      }
    });

    // SimklAvatarSync (web): same forward-only mirror for the Simkl avatar.
    ref.listen(simklAvatarSyncProvider, (_, next) {
      if (!next.on || next.avatar == null) return;
      final active = ref.read(activeProfileProvider);
      if (active != null && !active.isKid && active.avatar != next.avatar) {
        ref
            .read(profilesProvider.notifier)
            .updateProfile(active.id, (p) => p.copyWith(avatar: next.avatar));
      }
    });

    // The player is fullscreen — chrome (the rail) is suppressed (docs/10 §chrome).
    final fullscreen = state.active.kind == FrameKind.player;
    // Phone drops the side rail for a bottom nav; tablet/tv keep the rail. The
    // CHROME keys off the DEVICE idiom (shortest side), so a phone stays on the
    // bottom nav even in landscape instead of flipping to the tablet rail when
    // its landscape width crosses 640 (content still reflows to its own width).
    final idiom = Idiom.device(context);
    final phone = !fullscreen && idiom.isPhone;
    final searchOpen = ref.watch(searchOpenProvider);

    return PopScope(
      // Back closes the search overlay first, then walks the nav stack.
      canPop: !searchOpen && !state.canGoBack,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // Back/close tone (web `SFX.close`), silent unless a theme is enabled.
        uiSound?.close();
        if (ref.read(searchOpenProvider)) {
          ref.read(searchOpenProvider.notifier).close();
          return;
        }
        final nav = ref.read(navControllerProvider.notifier);
        // The player exits to the source list (and clears a re-firing auto-play
        // picker); every other frame pops normally.
        if (state.active.kind == FrameKind.player) {
          nav.exitPlayer();
        } else {
          nav.back();
        }
      },
      // The search overlay sits ABOVE the Scaffold so it covers the top bar and
      // the phone bottom nav — only one search field is ever visible.
      child: Stack(
        children: [
          // While search is open, take the whole app behind it out of the focus
          // tree so a TV D-pad can't escape the overlay onto the nav rail or a
          // card behind the dim, and so the overlay's search field can claim
          // autofocus in a now-empty scope. The overlay is a Stack sibling (it
          // must cover the top bar + bottom nav), so this is the only place the
          // background can be excluded from.
          ExcludeFocus(
            excluding: searchOpen,
            child: Scaffold(
              backgroundColor: fullscreen ? const Color(0xFF000000) : null,
              body: fullscreen
                  ? _content(state.active)
                  : SafeArea(
                      child: idiom.hasSideRail
                          ? _wideBody(t, state.active)
                          : _phoneBody(t, state.active),
                    ),
              bottomNavigationBar: phone ? _PhoneNavBar(tokens: t) : null,
            ),
          ),
          if (searchOpen) _SearchOverlay(tokens: t),
        ],
      ),
    );
  }

  /// The tablet/tv chrome — UNCHANGED from the original single layout: a top bar
  /// above the sidebar rail and the active view. The bar, the rail, and the view
  /// are separate focus-traversal groups so D-pad up/down/right stays within the
  /// active view; the rail is reached with Left at the content's edge, the bar
  /// with Up. This tree must stay byte-for-byte identical to avoid a TV focus
  /// regression.
  Widget _wideBody(HarborTokens t, Frame active) => Column(
    children: [
      FocusTraversalGroup(child: _TopBar(tokens: t)),
      Expanded(
        child: Row(
          children: [
            FocusTraversalGroup(child: _NavRail(tokens: t)),
            Expanded(
              child: FocusTraversalGroup(child: _panedContent(active)),
            ),
          ],
        ),
      ),
    ],
  );

  /// Wraps the content pane so descendants read the PANE's size via
  /// `MediaQuery` — and therefore `Idiom.of` — instead of the full window. The
  /// nav rail leaves a much narrower pane, so on a portrait 11" tablet the ~600px
  /// pane correctly resolves to phone chrome (stacked hero, single column) and
  /// stops the side-by-side tablet layouts from overflowing; a wider pane
  /// (12.9" tablet, TV) still resolves to tablet/tv. Mirrors the web keying its
  /// `md:`/`lg:` reflows off the content column, not the viewport.
  Widget _panedContent(Frame active) => LayoutBuilder(
    builder: (context, constraints) {
      final mq = MediaQuery.of(context);
      final h = constraints.maxHeight.isFinite
          ? constraints.maxHeight
          : mq.size.height;
      return MediaQuery(
        data: mq.copyWith(size: Size(constraints.maxWidth, h)),
        child: _keyedContent(active),
      );
    },
  );

  /// The phone chrome: the same top bar over the full-bleed active view, with
  /// navigation moved to the bottom bar. No side rail — the freed width is what
  /// lets the content panes stop overflowing.
  Widget _phoneBody(HarborTokens t, Frame active) => Column(
    children: [
      FocusTraversalGroup(child: _TopBar(tokens: t)),
      Expanded(child: FocusTraversalGroup(child: _keyedContent(active))),
    ],
  );

  /// The active view, keyed so its element (and focus/scroll state) survives the
  /// chrome reshaping across the phone/tablet breakpoint.
  Widget _keyedContent(Frame active) =>
      KeyedSubtree(key: _shellContentKey, child: _content(active));

  Widget _content(Frame frame) => switch (frame.kind) {
    FrameKind.search => const SearchView(),
    FrameKind.movies => const CatalogRowsView(type: 'movie'),
    FrameKind.shows => const CatalogRowsView(type: 'series'),
    FrameKind.addons => const AddonsView(),
    FrameKind.addonDetail => AddonDetailView(
      key: ValueKey(frame.frameKey()),
      id: frame.args['id'] as String,
    ),
    FrameKind.organizeAddons => const OrganizeAddonsView(),
    FrameKind.service => ServiceView(
      key: ValueKey(frame.frameKey()),
      service: frame.args['service'] as String,
    ),
    FrameKind.collection => CollectionView(
      key: ValueKey(frame.frameKey()),
      collectionId: frame.args['id'] as int,
    ),
    FrameKind.collections => const CollectionsView(),
    FrameKind.kids => const KidsView(),
    FrameKind.library => const LibraryView(),
    FrameKind.wrapped => const WrappedView(),
    FrameKind.calendar => const CalendarView(),
    FrameKind.catalogs => const CatalogsView(),
    FrameKind.discover => const DiscoverView(),
    FrameKind.anime => const AnimeView(),
    FrameKind.animeAward => AnimeAwardView(
      key: ValueKey(frame.frameKey()),
      sourceId:
          AwardSourceId.fromWire(frame.args['sourceId'] as String? ?? '') ??
          AwardSourceId.crunchyroll,
    ),
    FrameKind.queue => const QueueView(),
    FrameKind.live => const LiveTvView(),
    FrameKind.multiview => const MultiviewView(),
    FrameKind.matchDetail => MatchDetailView(
      key: ValueKey(frame.frameKey()),
      game: SportsGame.fromJson(
        (frame.args['game'] as Map).cast<String, dynamic>(),
      ),
    ),
    FrameKind.vod => const VodView(),
    FrameKind.downloads => const DownloadsView(),
    FrameKind.grid => GridPageView(
      key: ValueKey(frame.frameKey()),
      title: frame.args['title'] as String? ?? '',
      items: [
        for (final j in (frame.args['items'] as List? ?? const []))
          MetaPreview.fromJson((j as Map).cast<String, dynamic>()),
      ],
    ),
    FrameKind.kidsFranchise => KidsFranchiseView(
      key: ValueKey(frame.frameKey()),
      franchiseKey: frame.args['key'] as String,
    ),
    FrameKind.filter => FilterView(
      key: ValueKey(frame.frameKey()),
      filter: MetaFilter.fromArgs(frame.args)!,
    ),
    FrameKind.award => AwardView(
      key: ValueKey(frame.frameKey()),
      type: awardTypeFromId(frame.args['type'] as String? ?? ''),
    ),
    FrameKind.settings => SettingsView(
      key: ValueKey(frame.frameKey()),
      initialCategoryId: frame.args['category'] as String?,
    ),
    FrameKind.meta => _MetaRoute(
      key: ValueKey(frame.frameKey()),
      type: frame.args['type'] as String,
      id: frame.args['id'] as String,
    ),
    FrameKind.episodeDetail => EpisodeDetailView(
      key: ValueKey(frame.frameKey()),
      type: frame.args['type'] as String,
      id: frame.args['id'] as String,
      season: frame.args['season'] as int,
      episode: frame.args['episode'] as int,
      title: frame.args['title'] as String?,
      tvId: frame.args['tvId'] as int?,
      seriesImdbId: frame.args['seriesImdbId'] as String?,
    ),
    FrameKind.person => PersonView(
      key: ValueKey(frame.frameKey()),
      personId: frame.args['id'] as int,
    ),
    FrameKind.picker => PickerView(
      key: ValueKey(frame.frameKey()),
      type: frame.args['type'] as String,
      id: frame.args['id'] as String,
      season: frame.args['season'] as int?,
      episode: frame.args['episode'] as int?,
      title: frame.args['title'] as String?,
      year: frame.args['year'] as int?,
      releaseDate: frame.args['releaseDate'] as String?,
      isAnime: frame.args['isAnime'] == true,
      intent: switch (frame.args['intent']) {
        'download' => PickerIntent.download,
        'download-season' => PickerIntent.downloadSeason,
        _ => PickerIntent.play,
      },
      poster: frame.args['poster'] as String?,
      autoPlay: frame.args['autoPlay'] == true,
    ),
    FrameKind.player => PlayerView(
      key: ValueKey(frame.frameKey()),
      url: frame.args['url'] as String,
      title: frame.args['title'] as String?,
      headers: (frame.args['headers'] as Map?)?.cast<String, String>(),
      startAtSec: (frame.args['startAtSec'] as num?)?.toDouble(),
      notWebReady: frame.args['notWebReady'] == true,
      isLive: frame.args['isLive'] == true,
      contentId: frame.args['contentId'] as String?,
      contentType: frame.args['contentType'] as String?,
      season: frame.args['season'] as int?,
      episode: frame.args['episode'] as int?,
      sourceInfoHash: frame.args['sourceInfoHash'] as String?,
      sourceUrl: frame.args['sourceUrl'] as String?,
      sourceAddonId: frame.args['sourceAddonId'] as String?,
      sourceBingeGroup: frame.args['sourceBingeGroup'] as String?,
      sourceResolution: frame.args['sourceResolution'] as String?,
      sourceSourceKind: frame.args['sourceSourceKind'] as String?,
      sourceFileIdx: frame.args['sourceFileIdx'] as int?,
      sourceReleaseGroup: frame.args['sourceReleaseGroup'] as String?,
      sourceSize: frame.args['sourceSize'] as int?,
      sourceParsedTitle: frame.args['sourceParsedTitle'] as String?,
      releaseInfo: frame.args['releaseInfo'] as String?,
      subtitlePreselectOff: frame.args['subtitlePreselectOff'] == true,
      subtitlePreselectUrl: frame.args['subtitlePreselectUrl'] as String?,
      subtitlePreselectLang: frame.args['subtitlePreselectLang'] as String?,
      subtitlePreselectTitle: frame.args['subtitlePreselectTitle'] as String?,
    ),
    _ => const HomeView(),
  };
}

/// The nav frames whose views are fully built. The rail only renders items
/// backed by a real view — never a placeholder that would fall through to Home.
const Set<FrameKind> _implementedNavFrames = {
  FrameKind.home,
  FrameKind.discover,
  FrameKind.anime,
  FrameKind.catalogs,
  FrameKind.movies,
  FrameKind.shows,
  FrameKind.kids,
  FrameKind.live,
  FrameKind.vod,
  FrameKind.calendar,
  FrameKind.library,
  FrameKind.downloads,
  FrameKind.addons,
  FrameKind.settings,
};

/// The Material glyph standing in for each web nav icon.

/// The web visibility gate for a nav item (`sidebar.tsx` `isItemVisible`), plus
/// a build-state gate hiding items whose view is not yet implemented.
bool _navVisible(NavItemDef it, Settings s, bool kid) {
  if (kid) return it.id == NavItemId.kids;
  if (it.id == NavItemId.kids) return false;
  if (it.id == NavItemId.vod && !s.getBool('showPlaylistsTab')) return false;
  if (it.hideKey != null && s.getMap('hideContent')[it.hideKey!.name] == true) {
    return false;
  }
  return _implementedNavFrames.contains(it.frame);
}

/// The sidebar rail: the web `Sidebar` structure — a logo, the primary content
/// section, a divider, then the collections section (Settings pinned last) —
/// Shows the parental PIN dialog; on a correct PIN it unlocks the profile for
/// the session and runs [onUnlocked] (usually the deferred navigation).
Future<void> _promptParentalPin(
  BuildContext context,
  WidgetRef ref,
  HarborTokens tokens,
  VoidCallback onUnlocked,
) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (_) => ParentalPinDialog(
      tokens: tokens,
      tr: ref.read(translationsProvider),
      verify: (pin) => ref.read(parentalProvider.notifier).unlock(pin),
    ),
  );
  if (ok == true) onUnlocked();
}

/// Preserves the active view's element (and its focus/scroll state) as the shell
/// chrome reshapes across the phone/tablet breakpoint — so rotating or entering
/// split-view never drops the remote or resets the scroll position.
final GlobalKey _shellContentKey = GlobalKey();

/// The visible nav items split into the primary (content) and collections
/// sections, after applying the user's [NavCustomization], the kid/visibility
/// gates, and the parental lock filter. Shared by the rail (tablet/tv) and the
/// bottom bar (phone) so the gating logic lives in exactly one place.
({List<NavItemDef> primary, List<NavItemDef> collections}) _navSections(
  WidgetRef ref,
) {
  final settings = ref.watch(settingsProvider);
  final kid = ref.watch(activeProfileProvider)?.isKid ?? false;
  final parental = ref.watch(parentalProvider);

  final cfg = NavCustomization.fromMap(settings.getMap('navCustomization'));
  final items = applyNavCustomization(kNavItems, cfg)
      .where((it) => _navVisible(it, settings, kid))
      .where(
        (it) =>
            !(parental.locked &&
                it.parentalKey != null &&
                isTabLocked(parental.lockedTabs, it.parentalKey!.name)),
      )
      .toList();
  return (
    primary: items.where((it) => navIsPrimary(it.id)).toList(),
    collections: items.where((it) => !navIsPrimary(it.id)).toList(),
  );
}

/// Navigates to [it], prompting for the parental PIN first when a locked
/// profile taps a PIN-gated tab. Shared by the rail and the bottom bar.
void _openNav(
  BuildContext context,
  WidgetRef ref,
  HarborTokens tokens,
  NavItemDef it,
) {
  final parental = ref.read(parentalProvider);
  if (parental.locked && it.pinGated) {
    _promptParentalPin(context, ref, tokens, () {
      ref.read(navControllerProvider.notifier).setView(it.frame);
    });
    return;
  }
  ref.read(navControllerProvider.notifier).setView(it.frame);
}

/// driven by [kNavItems] + the user's [NavCustomization] and visibility gates.
class _NavRail extends ConsumerWidget {
  const _NavRail({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(activeFrameProvider).kind;
    final parental = ref.watch(parentalProvider);
    final translations = ref.watch(translationsProvider);

    final sections = _navSections(ref);
    final primary = sections.primary;
    final collections = sections.collections;

    Widget itemFor(NavItemDef it) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: _NavItem(
        tokens: tokens,
        icon: navIcon(it.id),
        label: translations.tOr(it.labelKey, it.label),
        selected: it.frame == active,
        // Content autofocuses; the rail is reached with Left.
        autofocus: false,
        onPressed: () => _openNav(context, ref, tokens, it),
      ),
    );

    return Container(
      width: 230,
      color: tokens.surface,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 28),
            child: _HarborBrand(tokens: tokens),
          ),
          // Scrolls when the item list is taller than the viewport (e.g. a
          // 1080p TV); directional focus auto-reveals the focused item.
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final it in primary) itemFor(it),
                  if (primary.isNotEmpty && collections.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 14),
                      child: Divider(
                        height: 1,
                        thickness: 1,
                        color: tokens.edgeSoft,
                      ),
                    ),
                  for (final it in collections) itemFor(it),
                ],
              ),
            ),
          ),
          if (parental.locked)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    size: 16,
                    color: tokens.inkSubtle,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'LOCKED',
                    style: TextStyle(
                      color: tokens.inkSubtle,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.4,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tokens,
    required this.icon,
    required this.label,
    required this.selected,
    required this.autofocus,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String label;
  final bool selected;
  final bool autofocus;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Focusable(
      tokens: tokens,
      autofocus: autofocus,
      borderRadius: 12,
      onPressed: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: selected ? tokens.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 22,
              color: selected ? tokens.accent : tokens.inkMuted,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selected ? tokens.accent : tokens.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The phone bottom navigation: up to four primary tabs inline plus a "More"
/// destination that opens a sheet with any overflow primaries and the whole
/// collections section. Every tap routes through the shared [_openNav], so the
/// parental PIN gate still fires. Each item is a real [Focusable] so the
/// primitive contract (and future external-keyboard focus) still holds.
class _PhoneNavBar extends ConsumerWidget {
  const _PhoneNavBar({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(activeFrameProvider).kind;
    final translations = ref.watch(translationsProvider);
    final sections = _navSections(ref);
    final inline = sections.primary.take(4).toList();
    final overflow = [...sections.primary.skip(4), ...sections.collections];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border(top: BorderSide(color: tokens.edgeSoft)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: [
              for (final it in inline)
                Expanded(
                  child: _PhoneNavItem(
                    tokens: tokens,
                    icon: navIcon(it.id),
                    label: translations.tOr(it.labelKey, it.label),
                    selected: it.frame == active,
                    onPressed: () => _openNav(context, ref, tokens, it),
                  ),
                ),
              if (overflow.isNotEmpty)
                Expanded(
                  child: _PhoneNavItem(
                    tokens: tokens,
                    icon: Icons.more_horiz_rounded,
                    label: translations.t('More'),
                    selected: overflow.any((it) => it.frame == active),
                    onPressed: () =>
                        _openMoreSheet(context, ref, tokens, overflow, active),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhoneNavItem extends StatelessWidget {
  const _PhoneNavItem({
    required this.tokens,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final color = selected ? tokens.accent : tokens.inkMuted;
    return Focusable(
      tokens: tokens,
      borderRadius: 12,
      onPressed: onPressed,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// The "More" sheet for the phone nav overflow: the remaining primary tabs and
/// the collections section, each routed through [_openNav].
Future<void> _openMoreSheet(
  BuildContext context,
  WidgetRef ref,
  HarborTokens tokens,
  List<NavItemDef> items,
  FrameKind active,
) {
  final translations = ref.read(translationsProvider);
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: tokens.elevated,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetCtx) => SafeArea(
      top: false,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final it in items)
              Focusable(
                tokens: tokens,
                borderRadius: 0,
                scale: 1.0,
                onPressed: () {
                  Navigator.of(sheetCtx).pop();
                  _openNav(context, ref, tokens, it);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        navIcon(it.id),
                        size: 22,
                        color: it.frame == active
                            ? tokens.accent
                            : tokens.inkMuted,
                      ),
                      const SizedBox(width: 16),
                      Text(
                        translations.tOr(it.labelKey, it.label),
                        style: TextStyle(
                          color: it.frame == active
                              ? tokens.accent
                              : tokens.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    ),
  );
}

/// The top chrome bar: a Back control (when the stack can pop) and the centered
/// search pill that opens the search view. Mirrors the web `Topbar` layout;
/// the recording/downloads/together controls land with their features.
class _TopBar extends ConsumerWidget {
  const _TopBar({required this.tokens});

  final HarborTokens tokens;

  Widget _circle(IconData icon, VoidCallback onTap) => Focusable(
    tokens: tokens,
    borderRadius: 22,
    onPressed: onTap,
    child: Container(
      height: 44,
      width: 44,
      decoration: BoxDecoration(
        color: tokens.elevated,
        shape: BoxShape.circle,
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: Icon(icon, size: 20, color: tokens.inkMuted),
    ),
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nav = ref.watch(navControllerProvider);
    return Container(
      height: 72,
      color: tokens.canvas,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      child: Row(
        children: [
          if (nav.canGoBack)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 12),
              child: _circle(
                Icons.arrow_back,
                () => ref.read(navControllerProvider.notifier).back(),
              ),
            ),
          if (nav.canGoForward)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 12),
              child: _circle(
                Icons.arrow_forward,
                () => ref.read(navControllerProvider.notifier).forward(),
              ),
            ),
          Expanded(
            child: Align(
              alignment: Alignment.center,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: _SearchPill(tokens: tokens),
              ),
            ),
          ),
          const SizedBox(width: 12),
          _VoiceMicButton(tokens: tokens),
          const SizedBox(width: 12),
          _DownloadsButton(tokens: tokens),
          _ProfileChip(tokens: tokens),
        ],
      ),
    );
  }
}

/// The Harbor brand lockup — the sailboat [HarborMark] followed by the "Harbor"
/// wordmark in Fraunces, tinted with the theme ink. A 1:1 port of the web
/// sidebar brand (`chrome/sidebar.tsx`: `<HarborMark/>` + Fraunces "Harbor").
class _HarborBrand extends StatelessWidget {
  const _HarborBrand({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Harbor',
    // Scale the lockup down (never up) so it never overflows a narrow rail.
    child: Align(
      alignment: AlignmentDirectional.centerStart,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: AlignmentDirectional.centerStart,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset(
              'assets/brand/harbor-mark.svg',
              height: 26,
              colorFilter: ColorFilter.mode(tokens.ink, BlendMode.srcIn),
            ),
            const SizedBox(width: 9),
            Text(
              'Harbor',
              style: TextStyle(
                color: tokens.ink,
                fontFamily: 'Fraunces',
                fontSize: 27,
                fontWeight: FontWeight.w500,
                height: 1,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// The top-bar profile chip: the active profile's avatar; tapping it opens the
/// profile switcher. Hidden when there is no active profile.
class _ProfileChip extends ConsumerWidget {
  const _ProfileChip({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(activeProfileProvider);
    if (profile == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 12),
      child: Focusable(
        tokens: tokens,
        borderRadius: 22,
        onPressed: () => showProfileSwitcher(context, ref, tokens),
        child: ProfileAvatar(
          profile: profile,
          tokens: tokens,
          size: 40,
          fallbackAvatar: ref.watch(harborFallbackAvatarProvider),
        ),
      ),
    );
  }
}

/// The top-bar downloads button. Opens the Downloads view and shows a live
/// badge with the number of in-progress (downloading or paused) items.
class _DownloadsButton extends ConsumerWidget {
  const _DownloadsButton({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final engine = ref.watch(downloadEngineProvider);
    return Focusable(
      tokens: tokens,
      borderRadius: 22,
      onPressed: () =>
          ref.read(navControllerProvider.notifier).setView(FrameKind.downloads),
      child: ListenableBuilder(
        listenable: engine.items,
        builder: (context, _) {
          final active = activeDownloadCount(engine.items.value);
          return Container(
            height: 44,
            width: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tokens.elevated,
              shape: BoxShape.circle,
              border: Border.all(color: tokens.edgeSoft),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Icon(Icons.download_rounded, size: 20, color: tokens.inkMuted),
                if (active > 0)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 16),
                      height: 16,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: tokens.accent,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: tokens.canvas, width: 1.5),
                      ),
                      child: Text(
                        active > 9 ? '9+' : '$active',
                        style: TextStyle(
                          color: tokens.canvas,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// The top-bar voice-search mic (doc-03: voice on the search screen *and* the
/// top bar). Pressing it opens Search and starts a capture there, so the
/// transcript runs through the same pipeline as typing.
class _VoiceMicButton extends ConsumerWidget {
  const _VoiceMicButton({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Focusable(
      tokens: tokens,
      borderRadius: 22,
      onPressed: () {
        ref.read(voiceAutostartProvider).value = true;
        ref.read(searchOpenProvider.notifier).open();
      },
      child: Container(
        height: 44,
        width: 44,
        decoration: BoxDecoration(
          color: tokens.elevated,
          shape: BoxShape.circle,
          border: Border.all(color: tokens.edgeSoft),
        ),
        child: Icon(Icons.mic_none_rounded, size: 20, color: tokens.inkMuted),
      ),
    );
  }
}

class _SearchPill extends ConsumerWidget {
  const _SearchPill({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Focusable(
      tokens: tokens,
      borderRadius: 22,
      onPressed: () => ref.read(searchOpenProvider.notifier).open(),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: tokens.elevated,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: tokens.edgeSoft),
        ),
        child: Row(
          children: [
            Icon(Icons.search, size: 18, color: tokens.inkSubtle),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Search movies, shows, people…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: tokens.inkSubtle, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The full-screen search overlay — a dimmed, tappable backdrop with the search
/// panel above it. It covers the whole app (top bar and phone bottom nav) so a
/// single search field is ever visible; tapping the backdrop, pressing Escape,
/// or Back closes it. A phone shows the panel full-bleed with a close button;
/// tablet/TV show a centred card with backdrop around it to tap away.
class _SearchOverlay extends ConsumerWidget {
  const _SearchOverlay({required this.tokens});

  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final idiom = Idiom.of(context);
    void close() => ref.read(searchOpenProvider.notifier).close();

    final panel = GestureDetector(
      // Absorb taps on the panel so they never reach the dismiss backdrop.
      behavior: HitTestBehavior.opaque,
      onTap: () {},
      child: Material(
        color: t.canvas,
        child: Column(
          children: [
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 8, 8, 0),
                child: Focusable(
                  tokens: t,
                  borderRadius: 999,
                  onPressed: close,
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.close_rounded,
                      color: t.inkMuted,
                      size: 24,
                    ),
                  ),
                ),
              ),
            ),
            const Expanded(child: SearchView()),
          ],
        ),
      ),
    );

    final Widget content = idiom.isPhone
        ? Positioned.fill(child: SafeArea(child: panel))
        : Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: 900,
                maxHeight: MediaQuery.sizeOf(context).height * 0.85,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: panel,
              ),
            ),
          );

    return Positioned.fill(
      child: CallbackShortcuts(
        bindings: {const SingleActivator(LogicalKeyboardKey.escape): close},
        // A fresh FocusScope so the search field's autofocus fires here (the
        // background is taken out of the focus tree by ExcludeFocus while open).
        child: FocusScope(
          child: Stack(
            children: [
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: close,
                  child: ColoredBox(color: Colors.black.withValues(alpha: 0.6)),
                ),
              ),
              content,
            ],
          ),
        ),
      ),
    );
  }
}

/// Routes a meta frame to the kid-safe [KidsDetailView] when a kid profile is
/// active, else the full [DetailView] — mirroring the web `App.tsx` branch that
/// swaps the detail view under a kid session.
class _MetaRoute extends ConsumerWidget {
  const _MetaRoute({super.key, required this.type, required this.id});

  final String type;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isKid = ref.watch(activeProfileProvider)?.isKid ?? false;
    return isKid
        ? KidsDetailView(type: type, id: id)
        : DetailView(type: type, id: id);
  }
}
