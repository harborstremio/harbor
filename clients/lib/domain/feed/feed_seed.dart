/// Day-seeded RNG helpers for the feed, ported 1:1 from `tags.ts` /
/// `daily-rows-types.ts`. All arithmetic is kept in the unsigned 32-bit domain
/// so it matches the web's `Math.imul` / `>>> 0` results bit-for-bit.
int _imul(int a, int b) => (a * b) & 0xFFFFFFFF;

/// The day index (whole days since the Unix epoch, UTC), ported from `dayIndex`.
int dayIndex(DateTime now) => now.millisecondsSinceEpoch ~/ 86400000;

/// Mixes a [base] seed with a [salt] (Math.imul by the golden-ratio constant
/// then add), ported 1:1 from `mixSeed`.
int mixSeed(int base, int salt) =>
    (_imul(base, 0x9E3779B1) + salt) & 0xFFFFFFFF;

/// The 32-bit FNV-1a hash of [s], ported 1:1 from `hashStr`.
int hashStr(String s) {
  var h = 0x811C9DC5;
  for (final c in s.codeUnits) {
    h = (h ^ c) & 0xFFFFFFFF;
    h = _imul(h, 0x01000193);
  }
  return h & 0xFFFFFFFF;
}

/// The day seed `YYYYMMDD`, ported 1:1 from `dailySeed`.
int dailySeed(DateTime now) => now.year * 10000 + now.month * 100 + now.day;

/// The next glibc-LCG state, the step used by [feedShuffle] / [pickRandom].
/// Computed in exact 64-bit ints (the web computes this in a double, so the
/// order is deterministic per seed but not bit-identical to the web's).
int _lcg(int s) => (s * 1103515245 + 12345) & 0x7FFFFFFF;

/// A [seed]ed Fisher-Yates shuffle, ported from `shuffle`. Returns a new list so
/// it stays pure; a fixed seed yields a stable daily rotation.
List<T> feedShuffle<T>(List<T> arr, int seed) {
  final out = [...arr];
  var s = seed;
  for (var i = out.length - 1; i > 0; i--) {
    s = _lcg(s);
    final j = s % (i + 1);
    final tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/// A [seed]ed pick of [n] items, ported from `pickRandom` (shuffle then take).
List<T> pickRandom<T>(List<T> arr, int n, int seed) {
  final shuffled = feedShuffle(arr, seed);
  return shuffled.take(n < arr.length ? n : arr.length).toList();
}
