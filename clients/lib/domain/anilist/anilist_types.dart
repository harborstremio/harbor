/// A persisted AniList session. Ported from `AnilistSession`. The token is a
/// secret and is stored in the platform keychain, never plaintext prefs.
class AnilistSession {
  const AnilistSession({
    required this.accessToken,
    required this.createdAt,
    required this.expiresAt,
    required this.userId,
    required this.userName,
    this.avatar,
  });

  final String accessToken;
  final int createdAt;
  final int expiresAt;
  final int userId;
  final String userName;
  final String? avatar;

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'createdAt': createdAt,
    'expiresAt': expiresAt,
    'userId': userId,
    'userName': userName,
    'avatar': ?avatar,
  };

  /// Parses a stored session, or null when any required field is missing or
  /// mistyped — a partial session is never trusted. Ported from the `read`
  /// validation in `anilist/session.ts`.
  static AnilistSession? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final accessToken = raw['accessToken'];
    final createdAt = raw['createdAt'];
    final expiresAt = raw['expiresAt'];
    final userId = raw['userId'];
    final userName = raw['userName'];
    if (accessToken is! String ||
        createdAt is! num ||
        expiresAt is! num ||
        userId is! num ||
        userName is! String) {
      return null;
    }
    return AnilistSession(
      accessToken: accessToken,
      createdAt: createdAt.toInt(),
      expiresAt: expiresAt.toInt(),
      userId: userId.toInt(),
      userName: userName,
      avatar: raw['avatar'] as String?,
    );
  }
}

/// The authenticated AniList user. Ported from `AnilistViewer`.
class AnilistViewer {
  const AnilistViewer({
    required this.id,
    required this.name,
    this.avatar,
    this.siteUrl,
  });

  final int id;
  final String name;
  final String? avatar;
  final String? siteUrl;
}

/// A thread/comment author. Ported from `AnilistUser` in the web
/// `anilist/threads.ts` — the avatar prefers `medium`, then `large`.
class AnilistUser {
  const AnilistUser({required this.id, required this.name, this.avatar});

  final int id;
  final String name;
  final String? avatar;

  static AnilistUser fromJson(Object? raw) {
    if (raw is! Map) return const AnilistUser(id: 0, name: 'Unknown');
    final avatar = raw['avatar'];
    final medium = avatar is Map ? avatar['medium'] : null;
    final large = avatar is Map ? avatar['large'] : null;
    return AnilistUser(
      id: (raw['id'] as num?)?.toInt() ?? 0,
      name: raw['name'] is String ? raw['name'] as String : 'Unknown',
      avatar: medium is String && medium.isNotEmpty
          ? medium
          : (large is String && large.isNotEmpty ? large : null),
    );
  }
}

/// A forum thread for a media — the AniList "comments" surface on the detail
/// page. Ported from `AnilistThread`.
class AnilistThread {
  const AnilistThread({
    required this.id,
    required this.title,
    this.bodyHtml,
    required this.replyCount,
    required this.viewCount,
    required this.isLocked,
    required this.isSticky,
    required this.createdAt,
    required this.updatedAt,
    this.siteUrl,
    required this.user,
  });

  final int id;
  final String title;
  final String? bodyHtml;
  final int replyCount;
  final int viewCount;
  final bool isLocked;
  final bool isSticky;
  final int createdAt;
  final int updatedAt;
  final String? siteUrl;
  final AnilistUser user;

  static AnilistThread? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = (raw['id'] as num?)?.toInt();
    if (id == null) return null;
    return AnilistThread(
      id: id,
      title: raw['title'] is String ? raw['title'] as String : '',
      bodyHtml: raw['bodyHtml'] as String?,
      replyCount: (raw['replyCount'] as num?)?.toInt() ?? 0,
      viewCount: (raw['viewCount'] as num?)?.toInt() ?? 0,
      isLocked: raw['isLocked'] == true,
      isSticky: raw['isSticky'] == true,
      createdAt: (raw['createdAt'] as num?)?.toInt() ?? 0,
      updatedAt: (raw['updatedAt'] as num?)?.toInt() ?? 0,
      siteUrl: raw['siteUrl'] as String?,
      user: AnilistUser.fromJson(raw['user']),
    );
  }
}

/// A comment inside an AniList thread. Ported from `AnilistThreadComment`.
class AnilistThreadComment {
  const AnilistThreadComment({
    required this.id,
    required this.commentHtml,
    required this.likeCount,
    required this.isLiked,
    required this.createdAt,
    this.siteUrl,
    required this.user,
  });

  final int id;
  final String commentHtml;
  final int likeCount;
  final bool isLiked;
  final int createdAt;
  final String? siteUrl;
  final AnilistUser user;

  static AnilistThreadComment? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = (raw['id'] as num?)?.toInt();
    if (id == null) return null;
    return AnilistThreadComment(
      id: id,
      commentHtml: raw['commentHtml'] is String
          ? raw['commentHtml'] as String
          : '',
      likeCount: (raw['likeCount'] as num?)?.toInt() ?? 0,
      isLiked: raw['isLiked'] == true,
      createdAt: (raw['createdAt'] as num?)?.toInt() ?? 0,
      siteUrl: raw['siteUrl'] as String?,
      user: AnilistUser.fromJson(raw['user']),
    );
  }
}
