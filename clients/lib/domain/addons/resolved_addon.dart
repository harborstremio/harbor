import 'curated.dart';
import 'models.dart';

/// Where a resolved addon entry came from, ported from the `ResolvedAddon.source`
/// string union. Governs merge precedence in the catalog pipeline.
enum AddonSource { curated, community, stremioUser, harborLocal }

/// A single addon reconciled across every source — the curated catalog, the
/// user's Stremio collection, Harbor's local installs, and the community index.
/// Ported 1:1 from the web `ResolvedAddon`.
class ResolvedAddon {
  const ResolvedAddon({
    this.curated,
    this.manifest,
    required this.transportUrl,
    required this.source,
    required this.installed,
  });

  /// The curated metadata (eyebrow, tags, hero, warnings) when this addon is in
  /// the hand-picked set; null otherwise.
  final CuratedEntry? curated;

  /// The live manifest, or null before it has been fetched (a curated entry
  /// starts manifest-less until its manifest is pulled).
  final Manifest? manifest;

  final String transportUrl;
  final AddonSource source;

  /// True when the addon is in the user's Stremio collection or installed
  /// locally in Harbor.
  final bool installed;

  ResolvedAddon copyWith({
    CuratedEntry? curated,
    Manifest? manifest,
    String? transportUrl,
    AddonSource? source,
    bool? installed,
  }) => ResolvedAddon(
    curated: curated ?? this.curated,
    manifest: manifest ?? this.manifest,
    transportUrl: transportUrl ?? this.transportUrl,
    source: source ?? this.source,
    installed: installed ?? this.installed,
  );
}

/// The canonical id of a resolved addon — the manifest id, else the curated id,
/// else the transportUrl. Ported from the web's `r.manifest?.id ?? r.curated?.id
/// ?? r.transportUrl` (a blank manifest id falls through, matching an absent id).
String resolvedAddonId(ResolvedAddon r) {
  final id = r.manifest?.id;
  if (id != null && id.isNotEmpty) return id;
  return r.curated?.id ?? r.transportUrl;
}
