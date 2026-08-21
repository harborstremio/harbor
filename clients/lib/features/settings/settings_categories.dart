import 'package:flutter/material.dart';

/// One settings category — a single page in the settings master/detail, mirroring
/// a Harbor sidebar entry. [label]/[sub] are the web `SECTION_META` title and
/// subtitle; [sections] are the clientv2 section labels this page renders, in
/// the order Harbor's panel presents them.
class SettingsCategory {
  const SettingsCategory({
    required this.id,
    required this.label,
    required this.sub,
    required this.icon,
    required this.sections,
  });

  final String id;
  final String label;
  final String sub;
  final IconData icon;
  final List<String> sections;
}

/// A titled cluster of categories in the sidebar. Ported from the web
/// `NAV_GROUPS` (`views/settings/nav.tsx`).
class SettingsGroup {
  const SettingsGroup({this.heading, required this.categories});

  final String? heading;
  final List<SettingsCategory> categories;
}

const _account = SettingsCategory(
  id: 'account',
  label: 'Account',
  sub:
      'Your Stremio sign-in. Library, watch progress, and addons sync from '
      'here.',
  icon: Icons.person_outline,
  sections: ['Account', 'Parental controls'],
);

const _library = SettingsCategory(
  id: 'library',
  label: 'Library & metadata',
  sub:
      'Optional keys that unlock TMDB rails, baked-in poster ratings, fanart, '
      'and TVDB episode data.',
  icon: Icons.grid_view_outlined,
  sections: [
    'Home layout',
    'Home languages',
    'Spoilers',
    'Episode cards',
    'AI search',
    'Metadata & API keys',
    'Detail page',
  ],
);

const _trakt = SettingsCategory(
  id: 'trakt',
  label: 'Trakt',
  sub:
      'Connect your Trakt account to scrobble playback, sync your watchlist, '
      'and pull personalized recommendations.',
  icon: Icons.sync_alt,
  sections: ['Trakt'],
);

const _anilist = SettingsCategory(
  id: 'anilist',
  label: 'AniList',
  sub:
      'Connect your AniList account to show your anime lists as rails on the '
      'Anime page.',
  icon: Icons.animation_outlined,
  sections: ['AniList'],
);

const _mal = SettingsCategory(
  id: 'mal',
  label: 'MyAnimeList',
  sub:
      'Connect your MyAnimeList account to sync your watch progress and '
      'browse your list.',
  icon: Icons.list_alt_outlined,
  sections: ['MyAnimeList'],
);

const _simkl = SettingsCategory(
  id: 'simkl',
  label: 'Simkl',
  sub:
      'Connect your Simkl account to mark what you finish as watched and sync '
      'your plan-to-watch list across apps.',
  icon: Icons.check_circle_outline,
  sections: ['Simkl'],
);

const _letterboxd = SettingsCategory(
  id: 'letterboxd',
  label: 'Letterboxd',
  sub:
      'Bring your Letterboxd watchlist, diary, liked films and lists into '
      'Harbor via the Stremboxd bridge.',
  icon: Icons.movie_filter_outlined,
  sections: ['Letterboxd'],
);

const _streaming = SettingsCategory(
  id: 'streaming',
  label: 'Streaming sources',
  sub:
      'How Harbor finds and resolves playable streams. Debrid keys and addon '
      'installs live here.',
  icon: Icons.cloud_outlined,
  sections: ['Streaming sources', 'Debrid services', 'Streaming catalogs'],
);

const _streamFilters = SettingsCategory(
  id: 'streamFilters',
  label: 'Stream filters',
  sub:
      'Build a named filter once, then apply it in the source picker to trim a '
      'noisy stream list down to exactly what you want.',
  icon: Icons.filter_alt_outlined,
  sections: ['Stream filters'],
);

const _player = SettingsCategory(
  id: 'player',
  label: 'Player & quality',
  sub:
      'Pick the playback engine and aspect, shape the audio, and set how '
      'episodes skip and advance.',
  icon: Icons.play_circle_outline,
  sections: [
    'Playback',
    'Player engine',
    'Aspect ratio',
    'Skip intros & credits',
  ],
);

const _mpv = SettingsCategory(
  id: 'mpv',
  label: 'Video tuning',
  sub:
      'Match the picture quality to your device, smooth out weak connections, '
      'and fine-tune the mpv engine with plain-language controls.',
  icon: Icons.tune,
  sections: [
    'Picture quality',
    'Hardware acceleration',
    'Color & HDR',
    'Connection',
    'Audio downmix',
  ],
);

const _anime = SettingsCategory(
  id: 'anime',
  label: 'Anime tweaks',
  sub:
      'Anime4K real-time upscaling and smooth motion. All the anime-specific '
      'picture enhancements in one place.',
  icon: Icons.auto_awesome_outlined,
  sections: ['Anime4K presets', 'Smooth motion'],
);

const _language = SettingsCategory(
  id: 'language',
  label: 'Languages',
  sub: 'Which audio and subtitle languages rank first in stream lists.',
  icon: Icons.language_outlined,
  sections: ['Language', 'Subtitle style', 'Languages'],
);

const _theme = SettingsCategory(
  id: 'theme',
  label: 'Theme & appearance',
  sub:
      'Color presets, custom backgrounds, and the font pair Harbor renders in.',
  icon: Icons.palette_outlined,
  sections: [
    'Theme',
    'Navigation',
    'Poster card style',
    'Title text',
    'Seek bar',
    'Sound effects',
  ],
);

const _bug = SettingsCategory(
  id: 'bug',
  label: 'Report a bug',
  sub:
      'Send a bug report straight to the Harbor team. Screenshots and screen '
      'recordings welcome.',
  icon: Icons.bug_report_outlined,
  sections: ['Report a bug'],
);

/// The settings sidebar, grouped exactly as Harbor's `NAV_GROUPS`. The
/// desktop-only categories (relay, p2p, playerLayout, hotkeys, webhooks,
/// advanced) are absent — they have no native counterpart on phone/tablet/TV.
const kSettingsGroups = <SettingsGroup>[
  SettingsGroup(
    heading: 'Account',
    categories: [
      _account,
      _library,
      _trakt,
      _anilist,
      _mal,
      _simkl,
      _letterboxd,
    ],
  ),
  SettingsGroup(heading: 'Streaming', categories: [_streaming, _streamFilters]),
  SettingsGroup(
    heading: 'Playback',
    categories: [_player, _mpv, _anime, _language],
  ),
  SettingsGroup(heading: 'Appearance', categories: [_theme]),
  SettingsGroup(heading: 'Help', categories: [_bug]),
];

/// Every category, flattened in sidebar order.
final kSettingsCategories = <SettingsCategory>[
  for (final g in kSettingsGroups) ...g.categories,
];

/// Harbor opens settings on the Account panel.
const kDefaultSettingsCategoryId = 'account';

SettingsCategory settingsCategoryById(String id) => kSettingsCategories
    .firstWhere((c) => c.id == id, orElse: () => kSettingsCategories.first);
