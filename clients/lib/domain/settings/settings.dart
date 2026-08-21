import 'defaults.dart';

/// The effective settings object: a stored blob merged over [buildDefaultSettings].
/// Backed by a map (like the web's dynamic `Settings`) so it round-trips exactly
/// and never drops keys, with typed accessors and convenience getters for the
/// most-used fields.
class Settings {
  const Settings(this._raw);

  final Map<String, dynamic> _raw;

  factory Settings.defaults() => Settings(buildDefaultSettings());

  /// Merge a stored blob over the defaults (shallow, matching the web's
  /// `{...DEFAULT, ...stored}`), so fields absent from an older blob take the
  /// current default.
  factory Settings.fromStored(Map<String, dynamic> stored) {
    final map = buildDefaultSettings();
    map.addAll(stored);
    return Settings(map);
  }

  dynamic operator [](String key) => _raw[key];

  String getString(String key) => (_raw[key] ?? '').toString();
  bool getBool(String key) => _raw[key] == true;
  int getInt(String key) => (_raw[key] as num?)?.toInt() ?? 0;
  double getDouble(String key) => (_raw[key] as num?)?.toDouble() ?? 0;
  List<String> getStringList(String key) =>
      ((_raw[key] as List?) ?? const []).map((e) => e.toString()).toList();
  List<double> getDoubleList(String key) => ((_raw[key] as List?) ?? const [])
      .whereType<num>()
      .map((e) => e.toDouble())
      .toList();
  List<int> getIntList(String key) => ((_raw[key] as List?) ?? const [])
      .whereType<num>()
      .map((e) => e.toInt())
      .toList();
  Map<String, dynamic> getMap(String key) =>
      ((_raw[key] as Map?) ?? const {}).cast<String, dynamic>();

  Map<String, dynamic> toJson() => _raw;

  Settings withValue(String key, dynamic value) {
    final map = {..._raw};
    map[key] = value;
    return Settings(map);
  }

  // --- convenience getters for keys the app reads often -------------------
  String get tmdbKey => getString('tmdbKey');
  String get mdblistKey => getString('mdblistKey');
  String get omdbKey => getString('omdbKey');
  String get rpdbKey => getString('rpdbKey');
  String get aiSearchKey => getString('aiSearchKey');
  String get aiGroqKey => getString('aiGroqKey');
  String get rdKey => getString('rdKey');
  String get tbKey => getString('tbKey');
  String get adKey => getString('adKey');
  String get pmKey => getString('pmKey');
  String get dlKey => getString('dlKey');
  String get uiLanguage => getString('uiLanguage');
  String get region => getString('region');
  String get themePreset =>
      getMap('theme')['preset']?.toString() ?? 'cool-grey';
}
