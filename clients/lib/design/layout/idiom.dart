import 'package:flutter/widgets.dart';

// The responsive-idiom system for the native Harbor rebuild.
//
// Harbor's web UI is desktop-first: its only breakpoint-driven reflows live in
// the content grids at Tailwind `md` (768) and `lg` (1024); `sm`/`xl` are never
// used and the chrome padding is fixed at every width. We reproduce that layout
// 1:1 while ADAPTING BY IDIOM — one codebase that is a phone app, a tablet app
// and a D-pad-driven TV app at once.
//
// Two orthogonal layers live here, and callers must not conflate them:
//
//   1. [Idiom] — a WINDOW-level form factor (phone / tablet / tv) derived from
//      the window width plus the input mode. It drives *chrome*: which nav
//      surface the shell shows, the page gutter, whether a hero stacks, whether
//      a sidebar collapses. Read it once near the top of a screen with
//      `Idiom.of(context)`; do not re-derive width ad hoc.
//
//   2. The Tailwind width thresholds ([kBpMd] / [kBpLg]) + [gridColumnsFor] — a
//      LOCAL, pane-relative column count fed the *actual* width a subtree gets
//      (from a `LayoutBuilder`), so a grid reflows off the space it really has,
//      exactly as the web's `md:`/`lg:` classes do. This is the 1:1 layer: the
//      column math is identical to the source, so a rail that is 2-up on a
//      narrow web column stays 2-up in the same width here. Idiom fixes the
//      chrome that was *stealing* that width (the always-on 230px rail, the
//      48px gutters); it does not change the column counts.

/// The window-level form factor. Derived from logical width + input mode, never
/// from a raw "is this a phone" device check — a split-view tablet, a resizable
/// desktop window and a picture-in-picture panel all present a phone-width
/// window and must render the phone chrome.
enum Idiom {
  /// Compact width (`< 640`). Touch, single pane, bottom navigation.
  phone,

  /// Medium/expanded width with a pointer (`>= 640`, not a 10-foot session).
  /// Touch/mouse, two-pane, a persistent side rail.
  tablet,

  /// A 10-foot session: a TV platform, or a very wide window driven by
  /// directional (D-pad/remote) focus with no pointer. Two-pane with the
  /// existing focusable nav rail and overscan-safe gutters.
  tv;

  bool get isPhone => this == Idiom.phone;
  bool get isTablet => this == Idiom.tablet;
  bool get isTv => this == Idiom.tv;

  /// Whether this idiom keeps a persistent side rail (tablet + tv) as opposed to
  /// the phone's bottom navigation.
  bool get hasSideRail => this != Idiom.phone;

  /// Resolve the idiom for [context] from the current [MediaQuery] and input
  /// mode. Cheap enough to call in `build`; it reads `MediaQuery.sizeOf` (which
  /// only rebuilds on a size change) and the ambient focus/navigation signals.
  static Idiom of(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (isTenFoot(context, width: width)) return Idiom.tv;
    if (width < kBpSm) return Idiom.phone;
    return Idiom.tablet;
  }

  /// The DEVICE idiom, keyed off the SHORTEST side rather than the current
  /// width — a phone stays [phone] in BOTH orientations (a landscape phone is
  /// still a phone, not a tablet) and a tablet stays [tablet] in portrait. Use
  /// this for the shell CHROME decision (side rail vs bottom nav); the content
  /// layout keeps using [of] (width/pane-based) so it still reflows to the
  /// space it actually has. TV is still detected via [isTenFoot].
  static Idiom device(BuildContext context) {
    if (isTenFoot(context)) return Idiom.tv;
    final shortest = MediaQuery.sizeOf(context).shortestSide;
    if (shortest < kBpSm) return Idiom.phone;
    return Idiom.tablet;
  }
}

// --- Breakpoints ------------------------------------------------------------
//
// Logical-pixel width thresholds. The `kBp*` values below are the Tailwind
// scale the web layout was authored against, so the grid helpers can reproduce
// the source's `md:`/`lg:` reflows byte-for-byte. Only `md` and `lg` are ever
// consulted by the addons layout — `sm`/`xl` exist for completeness and future
// screens (e.g. catalog grids) but the addons feature never branched on them.

/// Tailwind `sm` (640). ALSO the phone/tablet idiom boundary: below it the
/// window is compact and gets phone chrome. Unused by the addons *grids*.
const double kBpSm = 640;

/// Tailwind `md` (768). The first real grid reflow: category grid 2→3, tile &
/// detail rails 2→3, and the hero's decorative logo appears.
const double kBpMd = 768;

/// Tailwind `lg` (1024). The second grid reflow: feature/list/installed/
/// browse-category grids 1→2 and tile/detail rails 3→4. Also the floor of the
/// TV candidate band — a window this wide with directional input is 10-foot.
const double kBpLg = 1024;

/// Tailwind `xl` (1280). Unused by the addons layout; kept for parity with the
/// design tokens so other screens can reference the same scale.
const double kBpXl = 1280;

// --- 10-foot / remote detection ---------------------------------------------

/// A build-time/boot-time flag set by the platform bootstrap when the app is
/// launched on a television (Android TV leanback / Apple tvOS). When true every
/// session is treated as 10-foot regardless of width. Left `null` on
/// phone/tablet/desktop builds so the width+input heuristic decides.
///
/// Set this once at startup (before the first frame) from the platform channel
/// that already reports the TV flavor; it is intentionally a plain mutable
/// static rather than a provider so [Idiom.of] stays a pure context read.
bool? kPlatformIsTv;

/// Whether [context] is a 10-foot (TV / remote) session. True when the platform
/// is a TV, or when the window is in the large band ([kBpLg]+) AND the focus
/// system is running in directional mode with no touch pointer ever observed —
/// the combination that distinguishes a 1080p TV (1920 logical px, D-pad) from
/// a same-width desktop monitor driven by a mouse.
bool isTenFoot(BuildContext context, {double? width}) {
  if (kPlatformIsTv == true) return true;
  final w = width ?? MediaQuery.sizeOf(context).width;
  if (w < kBpLg) return false;
  final directional =
      MediaQuery.maybeNavigationModeOf(context) == NavigationMode.directional;
  final noTouch =
      FocusManager.instance.highlightMode == FocusHighlightMode.traditional;
  return directional && noTouch;
}

// --- Grid columns (the 1:1 layer) -------------------------------------------

/// The addons grids, each with its own web column rule. Feed [gridColumnsFor]
/// the *pane* width from a `LayoutBuilder` (the space the grid actually gets),
/// not the window width — the source keys these off the content column too.
enum AddonGrid {
  /// Discover "tile" rails: web `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
  tileRail,

  /// Discover "feature" rails: web `grid-cols-1 lg:grid-cols-2` (no `md`).
  featureRail,

  /// Discover "list" rails: web `grid-cols-1 lg:grid-cols-2` (no `md`).
  listRail,

  /// Discover "Browse by category" tiles: web `grid-cols-2 md:grid-cols-3`.
  /// Caps at 3 — it never reaches 4, unlike the tile rails.
  categoryGrid,

  /// Installed tab: web `grid-cols-1 lg:grid-cols-2`.
  installed,

  /// Detail "More like this" / "Recommended" rail:
  /// web `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
  detailRail,

  /// Browse-pane category grouping (LazyCategorySection):
  /// web `grid-cols-1 lg:grid-cols-2`.
  browseCategory,
}

/// The column count for [grid] at the given pane [maxWidth], reproducing the
/// web breakpoints 1:1. Callers pass the `LayoutBuilder` constraint width.
///
/// Note the Browse pane's [CommunityRow] list is deliberately absent: the
/// source renders it as a single-column stack at *every* width (a flat list,
/// not a grid), so it needs no column math here.
int gridColumnsFor(AddonGrid grid, double maxWidth) {
  switch (grid) {
    case AddonGrid.tileRail:
    case AddonGrid.detailRail:
      if (maxWidth < kBpMd) return 2;
      if (maxWidth < kBpLg) return 3;
      return 4;
    case AddonGrid.categoryGrid:
      return maxWidth < kBpMd ? 2 : 3;
    case AddonGrid.featureRail:
    case AddonGrid.listRail:
    case AddonGrid.installed:
    case AddonGrid.browseCategory:
      return maxWidth < kBpLg ? 1 : 2;
  }
}

// --- Chrome dimensions (the idiom layer) ------------------------------------

/// The page's horizontal gutter for [idiom]. The web uses a fixed `px-12`
/// (48px) at every width, but it never paid a 230px rail tax on a 360px phone.
/// On phone we drop to a phone-native gutter so the freed width (bottom nav, no
/// side rail) is spent on content, not padding; tablet/tv keep the source's
/// 48px so wide layouts stay 1:1 with Harbor.
double pageGutter(Idiom idiom) => idiom.isPhone ? 16 : 48;

/// The page's top gutter for [idiom]. The web header is `pt-20` (80px); the
/// phone app-bar reclaims that space, so phone starts content higher.
double pageTopGutter(Idiom idiom) => idiom.isPhone ? 16 : 28;

/// The width of the persistent nav surface for [idiom], or `null` on phone
/// (which uses bottom navigation and reserves no horizontal strip). Matches the
/// shell's existing 230px rail on tablet/tv.
double? navRailWidth(Idiom idiom) => idiom.isPhone ? null : 230;

/// Whether a leading-logo + trailing-content row (the detail hero, the organize
/// header, the community-rail header) must STACK into a column at [idiom].
/// Phone stacks; tablet/tv keep the source's side-by-side row.
bool stacksHero(Idiom idiom) => idiom.isPhone;

/// The overscan-safe minimum inset for the top-level interactive layout. TVs
/// crop ~5% of the frame, so a 10-foot session pads 48/27 (the 16:9 title-safe
/// recommendation) on top of the system insets; phone/tablet rely on
/// [SafeArea] alone and add nothing here.
EdgeInsets overscanInset(Idiom idiom) => idiom.isTv
    ? const EdgeInsets.symmetric(horizontal: 48, vertical: 27)
    : EdgeInsets.zero;
