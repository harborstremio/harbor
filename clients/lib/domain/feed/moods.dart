import '../catalog/tmdb.dart';

/// A mood-based discover row spec (id + title + TMDB discover params), ported
/// from `MoodSpec` in `src/lib/feed/moods.ts`.
class MoodSpec {
  const MoodSpec({required this.id, required this.title, required this.params});
  final String id;
  final String title;
  final Map<String, String> params;
}

String _g(String name) => '${kMovieGenres[name]}';

class _Mood {
  const _Mood(this.id, this.name, this.params);
  final String id;
  final String name;
  final Map<String, String> params;
}

final List<_Mood> _pool = [
  _Mood('comfort', 'Comfort Watch', {
    'with_genres': '${_g('Family')},${_g('Comedy')},${_g('Animation')}',
    'vote_average.gte': '7.2',
    'vote_count.gte': '1200',
    'sort_by': 'popularity.desc',
  }),
  _Mood('mind-benders', 'Mind Benders', {
    'with_genres': '${_g('Sci-Fi')},${_g('Mystery')},${_g('Thriller')}',
    'vote_average.gte': '7.4',
    'vote_count.gte': '1500',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('after-dark', 'After Dark', {
    'with_genres': _g('Horror'),
    'vote_average.gte': '6.6',
    'vote_count.gte': '400',
    'sort_by': 'popularity.desc',
  }),
  _Mood('date-night', 'Date Night', {
    'with_genres': '${_g('Romance')},${_g('Comedy')}',
    'vote_average.gte': '7.0',
    'vote_count.gte': '700',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('adrenaline', 'Adrenaline Rush', {
    'with_genres': '${_g('Action')},${_g('Thriller')}',
    'vote_average.gte': '6.9',
    'vote_count.gte': '1200',
    'sort_by': 'popularity.desc',
  }),
  _Mood('tearjerker', 'Bring the Tissues', {
    'with_genres': '${_g('Drama')},${_g('Romance')}',
    'vote_average.gte': '7.6',
    'vote_count.gte': '1200',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('feel-good', 'Feel-Good Hits', {
    'with_genres': '${_g('Comedy')},${_g('Family')}',
    'vote_average.gte': '7.0',
    'vote_count.gte': '1000',
    'sort_by': 'popularity.desc',
  }),
  _Mood('laugh', 'Laugh Out Loud', {
    'with_genres': _g('Comedy'),
    'vote_average.gte': '6.8',
    'vote_count.gte': '1200',
    'sort_by': 'popularity.desc',
  }),
  _Mood('heist', 'Heists & Cons', {
    'with_genres': '${_g('Crime')},${_g('Thriller')}',
    'vote_average.gte': '7.0',
    'vote_count.gte': '800',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('space', 'Into the Stars', {
    'with_genres': _g('Sci-Fi'),
    'vote_average.gte': '7.0',
    'vote_count.gte': '1500',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('fantasy', 'Sword & Sorcery', {
    'with_genres': '${_g('Fantasy')},${_g('Adventure')}',
    'vote_average.gte': '7.0',
    'vote_count.gte': '1200',
    'sort_by': 'popularity.desc',
  }),
  _Mood('true-crime', 'True Crime Files', {
    'with_genres': '${_g('Crime')},${_g('Documentary')}',
    'vote_average.gte': '7.2',
    'vote_count.gte': '150',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('slow-burn', 'Slow-Burn Dramas', {
    'with_genres': _g('Drama'),
    'vote_average.gte': '7.7',
    'vote_count.gte': '1500',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('neo-noir', 'Neo-Noir', {
    'with_genres': '${_g('Crime')},${_g('Mystery')}',
    'vote_average.gte': '7.3',
    'vote_count.gte': '700',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('coming-of-age', 'Coming of Age', {
    'with_genres': '${_g('Drama')},${_g('Comedy')}',
    'vote_average.gte': '7.3',
    'vote_count.gte': '600',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('epic-adventure', 'Epic Adventures', {
    'with_genres': '${_g('Adventure')},${_g('Action')}',
    'vote_average.gte': '7.2',
    'vote_count.gte': '1500',
    'sort_by': 'popularity.desc',
  }),
  _Mood('war-stories', 'War Stories', {
    'with_genres': '${_g('War')},${_g('Drama')}',
    'vote_average.gte': '7.4',
    'vote_count.gte': '800',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('westerns', 'Saddle Up', {
    'with_genres': _g('Western'),
    'vote_average.gte': '7.0',
    'vote_count.gte': '300',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('animation-night', 'Animation Night', {
    'with_genres': _g('Animation'),
    'vote_average.gte': '7.4',
    'vote_count.gte': '800',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('musicals', 'Turn It Up', {
    'with_genres': _g('Music'),
    'vote_average.gte': '7.0',
    'vote_count.gte': '200',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('history-buff', 'History Buff', {
    'with_genres': '${_g('History')},${_g('Drama')}',
    'vote_average.gte': '7.4',
    'vote_count.gte': '600',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('mystery-box', 'Whodunit', {
    'with_genres': '${_g('Mystery')},${_g('Thriller')}',
    'vote_average.gte': '7.2',
    'vote_count.gte': '800',
    'sort_by': 'vote_average.desc',
  }),
  _Mood('visually-stunning', 'Eye Candy', {
    'with_genres': '${_g('Adventure')},${_g('Fantasy')},${_g('Sci-Fi')}',
    'vote_average.gte': '7.3',
    'vote_count.gte': '2000',
    'sort_by': 'popularity.desc',
  }),
  _Mood('cult-classics', 'Cult Classics', {
    'primary_release_date.lte': '2005-12-31',
    'vote_average.gte': '7.5',
    'vote_count.gte': '600',
    'sort_by': 'vote_count.desc',
  }),
];

final Map<String, _Mood> _poolById = {for (final m in _pool) m.id: m};

const Map<String, List<String>> _timePrefs = {
  'morning': [
    'feel-good',
    'comfort',
    'laugh',
    'animation-night',
    'coming-of-age',
  ],
  'afternoon': [
    'epic-adventure',
    'fantasy',
    'space',
    'westerns',
    'history-buff',
  ],
  'evening': [
    'date-night',
    'neo-noir',
    'heist',
    'slow-burn',
    'mystery-box',
    'visually-stunning',
  ],
  'late': [
    'after-dark',
    'mind-benders',
    'true-crime',
    'adrenaline',
    'war-stories',
  ],
};

const Map<String, String> _sessionLabel = {
  'morning': 'This Morning',
  'afternoon': 'This Afternoon',
  'evening': 'Tonight',
  'late': 'Late Night',
};

class _Seasonal {
  const _Seasonal({
    required this.id,
    required this.title,
    required this.active,
    required this.params,
    this.relatedPoolId,
  });
  final String id;
  final String title;
  final String? relatedPoolId;
  final bool Function(int month0, int day) active;
  final Map<String, String> Function(DateTime now) params;
}

final List<_Seasonal> _seasonals = [
  _Seasonal(
    id: 'new-year',
    title: 'New Year, New Stories',
    relatedPoolId: 'feel-good',
    active: (m, d) => (m == 11 && d >= 27) || (m == 0 && d <= 4),
    params: (_) => {
      'with_genres': '${_g('Comedy')},${_g('Adventure')}',
      'vote_average.gte': '7.0',
      'vote_count.gte': '1500',
      'sort_by': 'popularity.desc',
    },
  ),
  _Seasonal(
    id: 'valentine',
    title: 'Be My Valentine',
    relatedPoolId: 'date-night',
    active: (m, d) => m == 1 && d <= 15,
    params: (_) => {
      'with_genres': _g('Romance'),
      'vote_average.gte': '7.0',
      'vote_count.gte': '800',
      'sort_by': 'vote_average.desc',
    },
  ),
  _Seasonal(
    id: 'spooky',
    title: 'Spooky Season',
    relatedPoolId: 'after-dark',
    active: (m, d) => m == 9,
    params: (_) => {
      'with_genres': _g('Horror'),
      'vote_average.gte': '6.4',
      'vote_count.gte': '300',
      'sort_by': 'popularity.desc',
    },
  ),
  _Seasonal(
    id: 'holiday',
    title: 'Holiday Warmth',
    relatedPoolId: 'comfort',
    active: (m, d) => m == 11 && d <= 26,
    params: (_) => {
      'with_genres': '${_g('Family')},${_g('Comedy')}',
      'vote_average.gte': '6.8',
      'vote_count.gte': '600',
      'sort_by': 'popularity.desc',
    },
  ),
  _Seasonal(
    id: 'summer',
    title: 'Summer Blockbusters',
    relatedPoolId: 'epic-adventure',
    active: (m, d) => m >= 5 && m <= 7,
    params: (_) => {
      'with_genres': '${_g('Action')},${_g('Adventure')},${_g('Sci-Fi')}',
      'vote_average.gte': '6.8',
      'vote_count.gte': '3000',
      'sort_by': 'popularity.desc',
    },
  ),
  _Seasonal(
    id: 'awards',
    title: 'Awards Contenders',
    relatedPoolId: 'slow-burn',
    active: (m, d) =>
        (m == 0 && d >= 5) || (m == 1 && d >= 16) || (m == 2 && d <= 20),
    params: (now) => {
      'primary_release_date.gte': '${now.year - 2}-01-01',
      'vote_average.gte': '7.3',
      'vote_count.gte': '800',
      'sort_by': 'vote_average.desc',
    },
  ),
  _Seasonal(
    id: 'autumn',
    title: 'Cozy Autumn Nights',
    relatedPoolId: 'slow-burn',
    active: (m, d) => m == 8 || m == 10,
    params: (_) => {
      'with_genres': '${_g('Drama')},${_g('Mystery')}',
      'vote_average.gte': '7.4',
      'vote_count.gte': '800',
      'sort_by': 'vote_average.desc',
    },
  ),
  _Seasonal(
    id: 'spring',
    title: 'Spring Awakening',
    relatedPoolId: 'feel-good',
    active: (m, d) => m == 3 || m == 4 || (m == 2 && d >= 21),
    params: (_) => {
      'with_genres': '${_g('Comedy')},${_g('Adventure')},${_g('Family')}',
      'vote_average.gte': '7.0',
      'vote_count.gte': '800',
      'sort_by': 'popularity.desc',
    },
  ),
];

/// The day-stable seed `YYYYMMDD`, ported from `dailySeed` (Dart's 1-based month
/// already equals the web's `getMonth()+1`).
int dailySeed(DateTime now) => now.year * 10000 + now.month * 100 + now.day;

String _bucketFor(int hour) {
  if (hour < 11) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late';
}

List<T> _rotate<T>(List<T> arr, int by) {
  if (arr.isEmpty) return arr;
  final k = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.sublist(k), ...arr.sublist(0, k)];
}

/// Picks the day + time-of-day mood rows, ported 1:1 from `pickMoodSpecs`: the
/// active seasonal (if any) leads, then the time-bucket preferences rotated by
/// the daily seed, then the whole pool rotated — de-duplicated, capped at
/// [count], titled "{session} · {mood}".
List<MoodSpec> pickMoodSpecs(DateTime now, {int count = 6}) {
  final bucket = _bucketFor(now.hour);
  final label = _sessionLabel[bucket]!;
  final seed = dailySeed(now);
  final bucketIndex = const [
    'morning',
    'afternoon',
    'evening',
    'late',
  ].indexOf(bucket);
  final month0 = now.month - 1; // JS getMonth() is 0-based.

  final out = <MoodSpec>[];
  final used = <String>{};

  _Seasonal? seasonal;
  for (final s in _seasonals) {
    if (s.active(month0, now.day)) {
      seasonal = s;
      break;
    }
  }
  if (seasonal != null) {
    out.add(
      MoodSpec(
        id: 'mood-${seasonal.id}',
        title: seasonal.title,
        params: seasonal.params(now),
      ),
    );
    used.add(seasonal.id);
    if (seasonal.relatedPoolId != null) used.add(seasonal.relatedPoolId!);
  }

  final order = [
    ..._rotate(_timePrefs[bucket]!, seed),
    ..._rotate(_pool.map((m) => m.id).toList(), seed + bucketIndex * 31),
  ];

  for (final id in order) {
    if (out.length >= count) break;
    if (used.contains(id)) continue;
    final mood = _poolById[id];
    if (mood == null) continue;
    used.add(id);
    out.add(
      MoodSpec(
        id: 'mood-$id',
        title: '$label · ${mood.name}',
        params: mood.params,
      ),
    );
  }

  return out.take(count).toList();
}
