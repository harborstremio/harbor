/// A profile's kid configuration, mirroring the web `KidConfig`
/// (`src/lib/profiles.tsx`): `{ age, curfewMinutes, parentPinHash }`. A profile
/// is a kid profile exactly when its `kid` is a non-null [KidConfig]; the web
/// stores this as an object (not a boolean), so it must round-trip losslessly.
class KidConfig {
  const KidConfig({this.age = 7, this.curfewMinutes, this.parentPinHash});

  /// The child's age (drives the content ceiling). Defaults to 7, matching
  /// `DEFAULT_KID`.
  final int age;

  /// Daily watch-time limit in minutes, or null for no curfew.
  final int? curfewMinutes;

  /// The SHA-256 hash of the parent PIN gating exit from the kids surface, or
  /// null when no parent PIN is set.
  final String? parentPinHash;

  factory KidConfig.fromJson(Map<String, dynamic> json) => KidConfig(
    age: (json['age'] as num?)?.toInt() ?? 7,
    curfewMinutes: (json['curfewMinutes'] as num?)?.toInt(),
    parentPinHash: json['parentPinHash'] as String?,
  );

  /// Serialised with every field present (nulls included), matching the web
  /// `{ age, curfewMinutes, parentPinHash }` shape.
  Map<String, dynamic> toJson() => {
    'age': age,
    'curfewMinutes': curfewMinutes,
    'parentPinHash': parentPinHash,
  };

  KidConfig copyWith({
    int? age,
    Object? curfewMinutes = _keep,
    Object? parentPinHash = _keep,
  }) => KidConfig(
    age: age ?? this.age,
    curfewMinutes: identical(curfewMinutes, _keep)
        ? this.curfewMinutes
        : curfewMinutes as int?,
    parentPinHash: identical(parentPinHash, _keep)
        ? this.parentPinHash
        : parentPinHash as String?,
  );

  @override
  bool operator ==(Object other) =>
      other is KidConfig &&
      other.age == age &&
      other.curfewMinutes == curfewMinutes &&
      other.parentPinHash == parentPinHash;

  @override
  int get hashCode => Object.hash(age, curfewMinutes, parentPinHash);
}

/// The kid config a freshly toggled kid profile starts from, ported 1:1 from
/// `DEFAULT_KID`.
const KidConfig kDefaultKid = KidConfig(age: 7);

const Object _keep = Object();
