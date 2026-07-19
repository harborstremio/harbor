/// A keyword-driven topic rail within a genre — e.g. "True Crime" inside Crime.
/// Ported 1:1 from the web `Topic`.
class Topic {
  const Topic({
    required this.id,
    required this.title,
    required this.kicker,
    required this.keywords,
    this.genreIds = const [],
    this.voteCount,
    this.mediaType,
  });

  final String id;
  final String title;
  final String kicker;
  final List<String> keywords;

  /// Extra genre ids to AND into the discover query (e.g. Documentary `99`).
  final List<int> genreIds;
  final int? voteCount;

  /// `movie` or `tv`; null means the filter's own media type.
  final String? mediaType;
}

/// The per-genre topic rails, ported 1:1 from `GENRE_TOPICS`.
const Map<String, List<Topic>> kGenreTopics = {
  'Western': [
    Topic(
      id: 'spaghetti-westerns',
      title: 'Spaghetti Westerns',
      kicker: 'Leone, Corbucci, dust and dynamite',
      keywords: ['spaghetti western', 'italian western'],
      voteCount: 5,
    ),
    Topic(
      id: 'revisionist-westerns',
      title: 'Revisionist Westerns',
      kicker: 'The myth, reconsidered',
      keywords: ['revisionist western', 'anti-western', 'neo-western'],
      voteCount: 5,
    ),
    Topic(
      id: 'outlaw-westerns',
      title: 'Outlaws & Bounty Hunters',
      kicker: 'Wanted dead or alive',
      keywords: ['outlaw', 'bounty hunter', 'gunslinger', 'wild west'],
      voteCount: 10,
    ),
  ],
  'Sci-Fi': [
    Topic(
      id: 'ufo-disclosure',
      title: 'UFOs & Disclosure',
      kicker: 'Sightings, contact, the unknown',
      keywords: [
        'ufo',
        'alien encounter',
        'extraterrestrial',
        'alien abduction',
      ],
      genreIds: [99],
      voteCount: 3,
    ),
    Topic(
      id: 'space-exploration',
      title: 'Space Exploration',
      kicker: 'Real journeys beyond Earth',
      keywords: ['space program', 'nasa', 'astronaut', 'moon landing', 'mars'],
      genreIds: [99],
      voteCount: 5,
    ),
    Topic(
      id: 'ai-future',
      title: 'AI & The Future',
      kicker: 'Where machines are taking us',
      keywords: ['artificial intelligence', 'robot', 'cybernetic', 'future'],
      genreIds: [99],
      voteCount: 5,
    ),
  ],
  'Horror': [
    Topic(
      id: 'true-paranormal',
      title: 'Paranormal Cases',
      kicker: 'Reportedly real',
      keywords: ['haunted house', 'paranormal', 'supernatural', 'exorcism'],
      genreIds: [99],
      voteCount: 3,
    ),
  ],
  'Crime': [
    Topic(
      id: 'true-crime',
      title: 'True Crime',
      kicker: 'Real cases, real consequences',
      keywords: ['true crime', 'serial killer', 'investigation', 'murder'],
      genreIds: [99],
      voteCount: 10,
    ),
  ],
  'Music': [
    Topic(
      id: 'concert-films',
      title: 'Concert Films',
      kicker: 'Front row seat',
      keywords: ['concert', 'live performance', 'music tour'],
      voteCount: 10,
    ),
    Topic(
      id: 'music-docs',
      title: 'Music Documentaries',
      kicker: 'Behind the sound',
      keywords: ['musician', 'band', 'music industry'],
      genreIds: [99],
      voteCount: 8,
    ),
  ],
  'War': [
    Topic(
      id: 'wwii-docs',
      title: 'WWII on Film',
      kicker: 'The real footage',
      keywords: ['world war ii', 'nazi', 'holocaust'],
      genreIds: [99],
      voteCount: 8,
    ),
    Topic(
      id: 'modern-war-docs',
      title: 'Modern Warfare',
      kicker: 'Wars of our time',
      keywords: ['iraq war', 'afghanistan war', 'vietnam war'],
      genreIds: [99],
      voteCount: 8,
    ),
  ],
  'History': [
    Topic(
      id: 'ancient-civ',
      title: 'Ancient Civilizations',
      kicker: 'Lost worlds rediscovered',
      keywords: [
        'ancient rome',
        'ancient egypt',
        'ancient greece',
        'archaeology',
      ],
      genreIds: [99],
      voteCount: 5,
    ),
  ],
};
