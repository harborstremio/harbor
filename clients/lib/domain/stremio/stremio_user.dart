/// A Stremio account user object as returned by `login`/`getUser`. Backed by the
/// raw JSON so the whole object round-trips into storage exactly as Stremio and
/// the web app expect (the server sends more fields than we surface).
class StremioUser {
  const StremioUser(this.json);

  final Map<String, dynamic> json;

  factory StremioUser.fromJson(Map<String, dynamic> json) => StremioUser(json);

  String? get id => (json['_id'] ?? json['id'])?.toString();
  String get email => (json['email'] ?? '').toString();
  String? get fullName => json['fullname'] as String?;
  String? get avatar => json['avatar'] as String?;

  Map<String, dynamic> toJson() => json;
}
