import '../../domain/addons/curated.dart';
import '../../domain/addons/resolved_addon.dart';

/// The addon's stable id, ported from `idOf` — delegates to the domain's
/// canonical [resolvedAddonId] (manifest id, else curated id, else transportUrl).
String idOf(ResolvedAddon r) => resolvedAddonId(r);

/// The addon's display name, ported from `nameOf`.
String nameOf(ResolvedAddon r) =>
    r.manifest?.name ?? r.curated?.id ?? 'Untitled addon';

/// A collision-resistant key for lists, ported from `addonKey`.
String addonKey(ResolvedAddon r) => '${idOf(r)}:${r.transportUrl}';

/// A one-line subtitle for an addon card, ported from `subtitleFromManifest`:
/// the first sentence of the description (capped at 90 chars), else the resource
/// labels joined, else a loading placeholder.
String subtitleFromManifest(ResolvedAddon r) {
  final m = r.manifest;
  if (m == null) return 'Loading…';
  final desc = m.description;
  if (desc != null && desc.isNotEmpty) {
    final first = desc.split(RegExp(r'[.\n]')).first;
    return first.length > 90 ? first.substring(0, 90) : first;
  }
  return m.resources.join(' · ');
}

/// The human label for an addon category, ported from `categoryLabel`. Every
/// category maps to a label (the enum is closed, so there is no unknown case).
String categoryLabel(AddonCategory category) => switch (category) {
  AddonCategory.metadata => 'Catalogs & metadata',
  AddonCategory.streams => 'Streams',
  AddonCategory.subtitles => 'Subtitles',
  AddonCategory.anime => 'Anime',
  AddonCategory.sports => 'Sports',
  AddonCategory.liveTv => 'Live TV',
  AddonCategory.tools => 'Tools',
  AddonCategory.adult => 'Adult',
};

/// Resolves [future] but never faster than [min] — the web `withMinDuration`,
/// which holds a spinner up long enough to avoid a flash.
Future<T> withMinDuration<T>(Future<T> future, Duration min) async {
  final delay = Future<void>.delayed(min);
  final result = await future;
  await delay;
  return result;
}

/// Groups an integer count with thousands separators, matching `toLocaleString`.
String formatThousands(num n) {
  final digits = n.toInt().abs().toString();
  final buffer = StringBuffer(n < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}
