import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// A kid profile's daily watch-time record, ported 1:1 from the web
/// `CurfewRecord` (`src/lib/curfew.ts`): the calendar day it covers, the seconds
/// watched so far, and whether a parent has unlocked it for the rest of the day.
class CurfewRecord {
  const CurfewRecord({
    required this.date,
    required this.seconds,
    required this.unlocked,
  });

  final String date;
  final int seconds;
  final bool unlocked;

  CurfewRecord copyWith({String? date, int? seconds, bool? unlocked}) =>
      CurfewRecord(
        date: date ?? this.date,
        seconds: seconds ?? this.seconds,
        unlocked: unlocked ?? this.unlocked,
      );

  factory CurfewRecord.fromJson(Map<String, dynamic> json) => CurfewRecord(
    date: (json['date'] as String?) ?? '',
    seconds: (json['seconds'] as num?)?.toInt() ?? 0,
    unlocked: json['unlocked'] == true,
  );

  Map<String, dynamic> toJson() => {
    'date': date,
    'seconds': seconds,
    'unlocked': unlocked,
  };

  @override
  bool operator ==(Object other) =>
      other is CurfewRecord &&
      other.date == date &&
      other.seconds == seconds &&
      other.unlocked == unlocked;

  @override
  int get hashCode => Object.hash(date, seconds, unlocked);
}

/// The calendar-day key `YYYY-M-D`, matching the web `todayKey` (month is 1-12,
/// no zero-padding) so records round-trip with the web app.
String curfewTodayKey(DateTime now) => '${now.year}-${now.month}-${now.day}';

/// The per-profile storage key, matching the web `harbor.curfew.<id>`.
String curfewStorageKey(String id) => 'harbor.curfew.$id';

/// Loads [id]'s record, resetting to a fresh day when the stored date isn't
/// today. Ported from `loadCurfew`.
CurfewRecord loadCurfew(KvStore kv, String id, DateTime now) {
  final today = curfewTodayKey(now);
  final fresh = CurfewRecord(date: today, seconds: 0, unlocked: false);
  final raw = kv.getString(curfewStorageKey(id));
  if (raw == null || raw.isEmpty) return fresh;
  try {
    final rec = CurfewRecord.fromJson(
      (jsonDecode(raw) as Map).cast<String, dynamic>(),
    );
    return rec.date == today ? rec.copyWith(date: today) : fresh;
  } catch (_) {
    return fresh;
  }
}

/// Persists [id]'s record. Ported from `saveCurfew`.
Future<void> saveCurfew(KvStore kv, String id, CurfewRecord rec) =>
    kv.setString(curfewStorageKey(id), jsonEncode(rec.toJson()));

/// Whether the day's limit is reached and not parent-unlocked. A null limit
/// (no curfew) never locks. Ported from the web `locked` computation.
bool curfewLocked(CurfewRecord rec, int? limitMinutes) =>
    limitMinutes != null && !rec.unlocked && rec.seconds >= limitMinutes * 60;
