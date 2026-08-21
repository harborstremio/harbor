import 'models.dart';

/// How a freshly-fetched manifest relates to what is already installed, ported
/// from `ResolveMatch.matchKind`.
enum AddonMatchKind { fresh, idMatch, hostnameMatch }

/// The addon being re-configured in the modal's manage mode.
class ManageTarget {
  const ManageTarget({
    required this.id,
    required this.name,
    required this.transportUrl,
    this.logo,
  });

  final String id;
  final String name;
  final String transportUrl;
  final String? logo;
}

/// A resolved install candidate: the fetched manifest, its normalized url, and
/// whether it is fresh, a same-id update, or a re-configure that should replace
/// an existing entry. Ported 1:1 from `ResolveMatch`.
class ResolveMatch {
  const ResolveMatch({
    required this.manifest,
    required this.url,
    required this.matchKind,
    this.replaceId,
    this.replaceName,
    this.replaceTransportUrl,
  });

  final Manifest manifest;
  final String url;
  final AddonMatchKind matchKind;
  final String? replaceId;
  final String? replaceName;
  final String? replaceTransportUrl;

  bool get isUpdate => matchKind != AddonMatchKind.fresh;
}

/// Finds an installed addon served from the same host as [url] — the signal a
/// pasted link is a re-configure of an existing addon. Ported from
/// `findHostnameMatch`.
InstalledAddon? hostnameMatch(String url, List<InstalledAddon> installed) {
  final host = Uri.tryParse(url)?.host;
  if (host == null || host.isEmpty) return null;
  for (final a in installed) {
    if (Uri.tryParse(a.transportUrl)?.host == host) return a;
  }
  return null;
}

/// Classifies a fetched [manifest] at [url] against the current install state,
/// ported 1:1 from the `tryResolve` match logic. In manage mode a differing id
/// is treated as a re-configure that replaces [manage]; otherwise a matching id
/// is an update and a shared host is a re-configure of that addon.
ResolveMatch classifyResolve({
  required Manifest manifest,
  required String url,
  required Set<String> installedIds,
  required List<InstalledAddon> installed,
  ManageTarget? manage,
}) {
  if (manage != null && manage.id.isNotEmpty) {
    if (manage.id == manifest.id) {
      return ResolveMatch(
        manifest: manifest,
        url: url,
        matchKind: AddonMatchKind.idMatch,
      );
    }
    return ResolveMatch(
      manifest: manifest,
      url: url,
      matchKind: AddonMatchKind.hostnameMatch,
      replaceId: manage.id,
      replaceName: manage.name,
      replaceTransportUrl: manage.transportUrl,
    );
  }
  if (installedIds.contains(manifest.id)) {
    return ResolveMatch(
      manifest: manifest,
      url: url,
      matchKind: AddonMatchKind.idMatch,
    );
  }
  final host = hostnameMatch(url, installed);
  if (host != null) {
    return ResolveMatch(
      manifest: manifest,
      url: url,
      matchKind: AddonMatchKind.hostnameMatch,
      replaceId: host.id,
      replaceName: host.manifest?.name ?? host.id,
      replaceTransportUrl: host.transportUrl,
    );
  }
  return ResolveMatch(
    manifest: manifest,
    url: url,
    matchKind: AddonMatchKind.fresh,
  );
}
