import 'dart:convert';

/// Every view/screen Harbor can show, as a frame kind (`docs/10`). Navigation is
/// a frame stack, not URL routing.
enum FrameKind {
  home,
  search,
  settings,
  anime,
  discover,
  catalogs,
  addons,
  addonDetail,
  organizeAddons,
  calendar,
  queue,
  movies,
  shows,
  kids,
  library,
  wrapped,
  live,
  multiview,
  vod,
  downloads,
  service,
  meta,
  episodeDetail,
  person,
  collection,
  collections,
  filter,
  grid,
  kidsFranchise,
  award,
  animeAward,
  picker,
  player,
  matchDetail,
}

/// The tab views: `setView` REPLACES the whole stack for these. `settings` and
/// all `open*` targets push instead.
const Set<FrameKind> kTabViewKinds = {
  FrameKind.home,
  FrameKind.search,
  FrameKind.anime,
  FrameKind.discover,
  FrameKind.catalogs,
  FrameKind.addons,
  FrameKind.calendar,
  FrameKind.downloads,
  FrameKind.movies,
  FrameKind.shows,
  FrameKind.kids,
  FrameKind.library,
  FrameKind.live,
  FrameKind.vod,
};

/// A stack entry: a kind plus its arguments (meta id, section, etc.).
class Frame {
  const Frame(this.kind, [this.args = const {}]);

  final FrameKind kind;
  final Map<String, dynamic> args;

  /// Stable key used for de-duping (same target already on top) and widget keys.
  String frameKey() => '${kind.name}:${args.isEmpty ? '' : jsonEncode(args)}';
}

/// The nav stack + browser-style forward stack.
class NavState {
  const NavState({required this.stack, required this.forwardStack});

  final List<Frame> stack;
  final List<Frame> forwardStack;

  Frame get active => stack.last;
  bool get canGoBack => stack.length > 1;
  bool get canGoForward => forwardStack.isNotEmpty;
}
