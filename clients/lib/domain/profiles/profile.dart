import 'kid_config.dart';

export 'kid_config.dart' show KidConfig, kDefaultKid;

/// A user profile. Mirrors Harbor's `Profile` shape (`docs/20` §12, `docs/30`):
/// `{ id, name, avatar, color, isPrimary, shareStremioWith, passwordHash,
/// hideContent, lockedTabs, kid, settingsLinked?, createdAt }`. Unknown keys are
/// preserved in [extras] so a round-trip through clientv2 never drops fields the
/// web app (or a future version) writes.
class Profile {
  const Profile({
    required this.id,
    required this.name,
    this.avatar,
    this.color,
    this.isPrimary = false,
    this.shareStremioWith,
    this.passwordHash,
    this.hideContent,
    this.lockedTabs,
    this.kid,
    this.settingsLinked,
    this.createdAt,
    this.extras = const {},
  });

  final String id;
  final String name;
  final String? avatar;
  final String? color;
  final bool isPrimary;
  final String? shareStremioWith;
  final String? passwordHash;
  final Map<String, dynamic>? hideContent;
  final List<String>? lockedTabs;

  /// The kid configuration, or null for a normal profile. The web stores this as
  /// an object (`{ age, curfewMinutes, parentPinHash }`), NOT a boolean — see
  /// [isKid] for the "is this a kid profile" check.
  final KidConfig? kid;

  /// A profile is LINKED to shared settings unless `settingsLinked === false`.
  final bool? settingsLinked;
  final int? createdAt;
  final Map<String, dynamic> extras;

  /// True when this profile reads/writes the shared settings blob.
  bool get linked => settingsLinked != false;

  /// True when this is a kid profile (has a [KidConfig]).
  bool get isKid => kid != null;

  static const _known = {
    'id',
    'name',
    'avatar',
    'color',
    'isPrimary',
    'shareStremioWith',
    'passwordHash',
    'hideContent',
    'lockedTabs',
    'kid',
    'settingsLinked',
    'createdAt',
  };

  factory Profile.fromJson(Map<String, dynamic> json) {
    final extras = <String, dynamic>{};
    for (final e in json.entries) {
      if (!_known.contains(e.key)) extras[e.key] = e.value;
    }
    final kid = _parseKid(json['kid']);
    var avatar = json['avatar'] as String?;
    // A non-kid profile can't keep a reserved /kids/avatars/ avatar.
    if (kid == null && avatar != null && avatar.startsWith('/kids/avatars/')) {
      avatar = null;
    }
    return Profile(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      avatar: avatar,
      color: json['color'] as String?,
      isPrimary: json['isPrimary'] == true,
      shareStremioWith: json['shareStremioWith'] as String?,
      passwordHash: json['passwordHash'] as String?,
      hideContent: (json['hideContent'] as Map?)?.cast<String, dynamic>(),
      lockedTabs: (json['lockedTabs'] as List?)
          ?.map((e) => e.toString())
          .toList(),
      kid: kid,
      settingsLinked: json['settingsLinked'] as bool?,
      createdAt: (json['createdAt'] as num?)?.toInt(),
      extras: extras,
    );
  }

  /// Normalises the stored `kid` value: an object becomes a [KidConfig]; a legacy
  /// boolean `true` becomes [kDefaultKid]; anything else (false / null / absent)
  /// is not a kid profile. Mirrors the web load-time kid migration.
  static KidConfig? _parseKid(Object? raw) {
    if (raw is Map) return KidConfig.fromJson(raw.cast<String, dynamic>());
    if (raw == true) return kDefaultKid;
    return null;
  }

  Map<String, dynamic> toJson() => {
    ...extras,
    'id': id,
    'name': name,
    if (avatar != null) 'avatar': avatar,
    if (color != null) 'color': color,
    'isPrimary': isPrimary,
    if (shareStremioWith != null) 'shareStremioWith': shareStremioWith,
    if (passwordHash != null) 'passwordHash': passwordHash,
    if (hideContent != null) 'hideContent': hideContent,
    if (lockedTabs != null) 'lockedTabs': lockedTabs,
    'kid': kid?.toJson(),
    if (settingsLinked != null) 'settingsLinked': settingsLinked,
    if (createdAt != null) 'createdAt': createdAt,
  };

  Profile copyWith({
    String? name,
    bool? settingsLinked,
    // Sentinel-defaulted so these can be explicitly cleared to null (e.g.
    // removing a PIN, clearing the kid config, or dropping the last locked tab)
    // — a plain `?? this.x` can't distinguish "unset" from "clear to null".
    Object? avatar = _keep,
    Object? color = _keep,
    Object? shareStremioWith = _keep,
    Object? passwordHash = _keep,
    Object? hideContent = _keep,
    Object? lockedTabs = _keep,
    Object? kid = _keep,
  }) {
    return Profile(
      id: id,
      name: name ?? this.name,
      avatar: identical(avatar, _keep) ? this.avatar : avatar as String?,
      color: identical(color, _keep) ? this.color : color as String?,
      isPrimary: isPrimary,
      shareStremioWith: identical(shareStremioWith, _keep)
          ? this.shareStremioWith
          : shareStremioWith as String?,
      passwordHash: identical(passwordHash, _keep)
          ? this.passwordHash
          : passwordHash as String?,
      hideContent: identical(hideContent, _keep)
          ? this.hideContent
          : hideContent as Map<String, dynamic>?,
      lockedTabs: identical(lockedTabs, _keep)
          ? this.lockedTabs
          : lockedTabs as List<String>?,
      kid: identical(kid, _keep) ? this.kid : kid as KidConfig?,
      settingsLinked: settingsLinked ?? this.settingsLinked,
      createdAt: createdAt,
      extras: extras,
    );
  }
}

/// Sentinel marking a [Profile.copyWith] nullable field as "leave unchanged".
const Object _keep = Object();

/// The `harbor.profiles.v1` state: the profile list and the active id.
class ProfilesState {
  const ProfilesState({required this.profiles, required this.activeId});

  final List<Profile> profiles;
  final String? activeId;

  static const empty = ProfilesState(profiles: [], activeId: null);

  factory ProfilesState.fromJson(Map<String, dynamic> json) {
    final list = (json['profiles'] as List?) ?? const [];
    return ProfilesState(
      profiles: list
          .whereType<Map>()
          .map((e) => Profile.fromJson(e.cast<String, dynamic>()))
          .toList(),
      activeId: json['activeId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'profiles': profiles.map((p) => p.toJson()).toList(),
    'activeId': activeId,
  };

  ProfilesState copyWith({List<Profile>? profiles, String? activeId}) =>
      ProfilesState(
        profiles: profiles ?? this.profiles,
        activeId: activeId ?? this.activeId,
      );
}

/// The avatar-ring colour palette a new profile is assigned from. Ported 1:1
/// from `PROFILE_COLORS`.
const List<String> kProfileColors = [
  '#7dd3fc',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#34d399',
  '#22d3ee',
];

/// Picks the first palette colour not already used by [profiles], cycling once
/// all are taken. Ported from the web `pickColor`.
String pickProfileColor(List<Profile> profiles) {
  final used = {for (final p in profiles) p.color};
  for (final c in kProfileColors) {
    if (!used.contains(c)) return c;
  }
  return kProfileColors[profiles.length % kProfileColors.length];
}
