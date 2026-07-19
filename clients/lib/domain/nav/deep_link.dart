/// A `stremio://detail/...` open target, ported from the web `DeepLinkOpen`.
class DeepLinkOpen {
  const DeepLinkOpen({required this.type, required this.id, this.videoId});

  final String type;
  final String id;
  final String? videoId;

  @override
  bool operator ==(Object other) =>
      other is DeepLinkOpen &&
      other.type == type &&
      other.id == id &&
      other.videoId == videoId;

  @override
  int get hashCode => Object.hash(type, id, videoId);
}

/// What an incoming deep link resolves to, once classified.
sealed class DeepLinkAction {
  const DeepLinkAction();
}

/// Open a title's detail (from `stremio://detail/<type>/<id>[/<videoId>]`).
class DeepLinkOpenDetail extends DeepLinkAction {
  const DeepLinkOpenDetail(this.open);
  final DeepLinkOpen open;
}

/// Install an addon from the link (a `manifest.json` / `harbor://` / installer
/// `stremio://` link).
class DeepLinkInstall extends DeepLinkAction {
  const DeepLinkInstall(this.rawUrl);
  final String rawUrl;
}

/// A quick in-app action opened from an App Shortcut / assistant deep link
/// (`harbor://search`, `harbor://continue`, `harbor://profiles`).
enum DeepLinkTarget { search, continueWatching, profiles }

/// Jump straight to an app surface (from an OS App Shortcut or a Google
/// Assistant / Siri phrase that deep-links in).
class DeepLinkAppAction extends DeepLinkAction {
  const DeepLinkAppAction(this.target);
  final DeepLinkTarget target;

  @override
  bool operator ==(Object other) =>
      other is DeepLinkAppAction && other.target == target;

  @override
  int get hashCode => target.hashCode;
}

/// The link is not something Harbor acts on.
class DeepLinkIgnore extends DeepLinkAction {
  const DeepLinkIgnore();
}

/// A `harbor://<action>` App-Shortcut / assistant link (search / continue), or
/// null when the `harbor://` link is an addon-install link instead.
DeepLinkAppAction? parseAppAction(String url) {
  if (!url.startsWith('harbor://')) return null;
  final host = Uri.tryParse(url)?.host ?? '';
  return switch (host) {
    'search' => const DeepLinkAppAction(DeepLinkTarget.search),
    'continue' || 'continue-watching' => const DeepLinkAppAction(
      DeepLinkTarget.continueWatching,
    ),
    'profiles' ||
    'who-is-watching' => const DeepLinkAppAction(DeepLinkTarget.profiles),
    _ => null,
  };
}

DeepLinkOpen? _parseDetailPath(String path) {
  final parts = path.split('/').where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty || parts[0] != 'detail' || parts.length < 3) return null;
  final type = Uri.decodeComponent(parts[1]);
  final id = Uri.decodeComponent(parts[2]);
  if (type.isEmpty || id.isEmpty) return null;
  final videoId = parts.length > 3 ? Uri.decodeComponent(parts[3]) : null;
  return DeepLinkOpen(type: type, id: id, videoId: videoId);
}

/// Parses a `stremio://detail/...` link, or a `stremio.com/#/detail/...` web
/// link, into its open target. Ported 1:1 from `parseStremioOpen`.
DeepLinkOpen? parseStremioOpen(String url) {
  if (url.startsWith('stremio://')) {
    return _parseDetailPath(url.substring('stremio://'.length));
  }
  final hash = url.indexOf('#');
  if (hash != -1 && url.contains('stremio.com')) {
    var frag = url.substring(hash + 1);
    if (frag.startsWith('/')) frag = frag.substring(1);
    return _parseDetailPath(frag);
  }
  return null;
}

/// Whether a non-detail link should be forwarded to the addon installer, ported
/// from `shouldForward`. On native Harbor a `stremio://` link that is not a
/// detail open is treated as an install (there is no Tauri installer-window
/// flag); `harbor://` links and any `manifest.json` link install too.
bool shouldForwardInstall(String url) {
  if (url.startsWith('harbor://')) return true;
  if (url.startsWith('stremio://')) return true;
  return url.contains('manifest.json');
}

/// Classifies an incoming deep link into the action Harbor takes: open a detail,
/// install an addon, or ignore. Ported from the `handle` dispatch in
/// `startDeepLinkBridge`.
DeepLinkAction classifyDeepLink(String url) {
  if (url.isEmpty) return const DeepLinkIgnore();
  final open = parseStremioOpen(url);
  if (open != null) return DeepLinkOpenDetail(open);
  final action = parseAppAction(url);
  if (action != null) return action;
  // The companion pairing now uses a real http URL opened in the phone browser,
  // not a deep link — ignore any stray `harbor://companion` so the install
  // fallback below never mistakes it for an addon manifest.
  if (url.startsWith('harbor://companion')) return const DeepLinkIgnore();
  if (shouldForwardInstall(url)) return DeepLinkInstall(url);
  return const DeepLinkIgnore();
}
