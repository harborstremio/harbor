import 'package:flutter/material.dart';

import '../../domain/nav/nav_items.dart';

/// The icon for a navigation item, shared by the app-shell nav and the
/// settings nav-customization editor.
IconData navIcon(NavItemId id) => switch (id) {
  NavItemId.home => Icons.home_outlined,
  NavItemId.discover => Icons.explore_outlined,
  NavItemId.catalogs => Icons.grid_view_outlined,
  NavItemId.movies => Icons.movie_outlined,
  NavItemId.shows => Icons.tv_outlined,
  NavItemId.kids => Icons.child_care,
  NavItemId.anime => Icons.animation,
  NavItemId.live => Icons.live_tv_outlined,
  NavItemId.vod => Icons.playlist_play,
  NavItemId.calendar => Icons.calendar_today_outlined,
  NavItemId.library => Icons.bookmark_outline,
  NavItemId.downloads => Icons.download_outlined,
  NavItemId.addons => Icons.extension_outlined,
  NavItemId.settings => Icons.settings_outlined,
};
