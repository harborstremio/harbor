import '../catalog/show_hero.dart' show mulberry32;
import 'feed_seed.dart';

/// A person spotlight within a genre — a director/actor/writer whose films in
/// that genre form a curated rail. Ported 1:1 from the web `Spotlight`.
class Spotlight {
  const Spotlight({
    required this.name,
    required this.sub,
    this.query,
    this.dept,
    this.presenter = false,
    this.relatedGenreIds = const [],
  });

  final String name;
  final String sub;
  final String? query;

  /// `Directing`, `Acting`, or `Writing`.
  final String? dept;
  final bool presenter;
  final List<int> relatedGenreIds;
}

const int _spotlightCount = 6;

/// The per-genre spotlight people, ported 1:1 from `GENRE_SPOTLIGHTS`.
const Map<String, List<Spotlight>> kGenreSpotlights = {
  'Western': [
    Spotlight(name: 'Clint Eastwood', sub: 'Westerns', dept: 'Acting'),
    Spotlight(name: 'John Wayne', sub: 'His Best', dept: 'Acting'),
    Spotlight(
      name: 'Sergio Leone',
      sub: 'Spaghetti Westerns',
      dept: 'Directing',
    ),
    Spotlight(name: 'John Ford', sub: 'Frontier Classics', dept: 'Directing'),
    Spotlight(name: 'Kurt Russell', sub: 'Modern Saddles', dept: 'Acting'),
    Spotlight(name: 'Kevin Costner', sub: 'Open Range', dept: 'Acting'),
    Spotlight(name: 'Sam Peckinpah', sub: 'Wild Bunch Era', dept: 'Directing'),
    Spotlight(name: 'Tommy Lee Jones', sub: 'Lone Stars', dept: 'Acting'),
  ],
  'Action': [
    Spotlight(
      name: 'Arnold Schwarzenegger',
      sub: 'Pure Action',
      dept: 'Acting',
    ),
    Spotlight(name: 'Keanu Reeves', sub: 'Modern Classics', dept: 'Acting'),
    Spotlight(name: 'Tom Cruise', sub: 'Stunts & Spies', dept: 'Acting'),
    Spotlight(
      name: 'Sylvester Stallone',
      sub: 'Old-school Heat',
      dept: 'Acting',
    ),
    Spotlight(name: 'Jackie Chan', sub: 'Kung Fu & Chaos', dept: 'Acting'),
    Spotlight(name: 'Charlize Theron', sub: 'Action Heroine', dept: 'Acting'),
    Spotlight(name: 'Jason Statham', sub: 'Fast Hands', dept: 'Acting'),
    Spotlight(name: 'Bruce Willis', sub: 'Hard Boiled', dept: 'Acting'),
    Spotlight(name: 'Michelle Yeoh', sub: 'Martial Grace', dept: 'Acting'),
    Spotlight(
      name: 'James Cameron',
      sub: 'Blockbuster Maker',
      dept: 'Directing',
    ),
    Spotlight(name: 'John Woo', sub: 'Bullet Ballet', dept: 'Directing'),
    Spotlight(name: 'Chad Stahelski', sub: 'Gun-Fu', dept: 'Directing'),
  ],
  'Drama': [
    Spotlight(
      name: 'Martin Scorsese',
      sub: "Director's Cut",
      dept: 'Directing',
    ),
    Spotlight(
      name: 'Daniel Day-Lewis',
      sub: 'Three-Time Oscar',
      dept: 'Acting',
    ),
    Spotlight(name: 'Meryl Streep', sub: 'Career Drama', dept: 'Acting'),
    Spotlight(name: 'Robert De Niro', sub: 'Heavy Hitters', dept: 'Acting'),
    Spotlight(name: 'Denzel Washington', sub: 'Towering Roles', dept: 'Acting'),
    Spotlight(name: 'Joaquin Phoenix', sub: 'Raw Nerve', dept: 'Acting'),
    Spotlight(name: 'Cate Blanchett', sub: 'Commanding Range', dept: 'Acting'),
    Spotlight(name: 'Al Pacino', sub: 'Big Swings', dept: 'Acting'),
    Spotlight(
      name: 'Philip Seymour Hoffman',
      sub: 'Quiet Force',
      dept: 'Acting',
    ),
    Spotlight(
      name: 'Paul Thomas Anderson',
      sub: 'American Epics',
      dept: 'Directing',
    ),
    Spotlight(name: 'Anthony Hopkins', sub: 'Master Class', dept: 'Acting'),
    Spotlight(name: 'Frances McDormand', sub: 'No Frills', dept: 'Acting'),
  ],
  'Crime': [
    Spotlight(name: 'Martin Scorsese', sub: 'Crime Films', dept: 'Directing'),
    Spotlight(
      name: 'Quentin Tarantino',
      sub: 'Tarantino Picks',
      dept: 'Directing',
    ),
    Spotlight(name: 'Al Pacino', sub: 'Mob & Cops', dept: 'Acting'),
    Spotlight(name: 'Robert De Niro', sub: 'Made Men', dept: 'Acting'),
    Spotlight(name: 'Joe Pesci', sub: 'Mob Cinema', dept: 'Acting'),
    Spotlight(name: 'Michael Mann', sub: 'Cool Heists', dept: 'Directing'),
    Spotlight(name: 'James Gandolfini', sub: 'The Boss', dept: 'Acting'),
    Spotlight(name: 'Brian De Palma', sub: 'Gangster Opera', dept: 'Directing'),
    Spotlight(name: 'Ray Liotta', sub: 'Wiseguys', dept: 'Acting'),
    Spotlight(
      name: 'Denzel Washington',
      sub: 'Both Sides of the Law',
      dept: 'Acting',
    ),
  ],
  'Sci-Fi': [
    Spotlight(
      name: 'Denis Villeneuve',
      sub: 'Modern Sci-Fi',
      dept: 'Directing',
    ),
    Spotlight(
      name: 'Christopher Nolan',
      sub: 'Mind-benders',
      dept: 'Directing',
    ),
    Spotlight(name: 'Ridley Scott', sub: 'Worlds Apart', dept: 'Directing'),
    Spotlight(name: 'James Cameron', sub: 'Future Worlds', dept: 'Directing'),
    Spotlight(
      name: 'Steven Spielberg',
      sub: 'Wonder & Dread',
      dept: 'Directing',
    ),
    Spotlight(name: 'Sigourney Weaver', sub: 'Genre Icon', dept: 'Acting'),
    Spotlight(name: 'Harrison Ford', sub: 'Spacefarer', dept: 'Acting'),
    Spotlight(name: 'Jeff Goldblum', sub: 'Chaos Theory', dept: 'Acting'),
  ],
  'Horror': [
    Spotlight(name: 'John Carpenter', sub: 'Genre Master', dept: 'Directing'),
    Spotlight(name: 'Jordan Peele', sub: 'Modern Horror', dept: 'Directing'),
    Spotlight(name: 'Stephen King', sub: 'King Adaptations', dept: 'Writing'),
    Spotlight(name: 'Mike Flanagan', sub: 'Slow Burns', dept: 'Directing'),
    Spotlight(name: 'Wes Craven', sub: 'Nightmare Maker', dept: 'Directing'),
    Spotlight(name: 'James Wan', sub: 'Modern Frights', dept: 'Directing'),
    Spotlight(name: 'Ari Aster', sub: 'Dread Incarnate', dept: 'Directing'),
    Spotlight(
      name: 'Guillermo del Toro',
      sub: 'Beautiful Monsters',
      dept: 'Directing',
    ),
    Spotlight(name: 'Jamie Lee Curtis', sub: 'Scream Queen', dept: 'Acting'),
    Spotlight(name: 'Toni Collette', sub: 'Unraveling', dept: 'Acting'),
    Spotlight(name: 'Robert Englund', sub: 'The Boogeyman', dept: 'Acting'),
  ],
  'Comedy': [
    Spotlight(name: 'Jim Carrey', sub: 'Rubber-Faced Genius', dept: 'Acting'),
    Spotlight(name: 'Adam Sandler', sub: 'Sandman Picks', dept: 'Acting'),
    Spotlight(name: 'Will Ferrell', sub: 'Lead Roles', dept: 'Acting'),
    Spotlight(name: 'Steve Carell', sub: 'His Comedy', dept: 'Acting'),
    Spotlight(name: 'Eddie Murphy', sub: 'Live Wire', dept: 'Acting'),
    Spotlight(name: 'Seth Rogen', sub: 'Stoner Auteur', dept: 'Acting'),
    Spotlight(name: 'Jonah Hill', sub: 'Fast Mouth', dept: 'Acting'),
    Spotlight(name: 'Dave Chappelle', sub: 'Sketch & Screen', dept: 'Acting'),
    Spotlight(name: 'Bill Murray', sub: 'Deadpan King', dept: 'Acting'),
    Spotlight(name: 'Ben Stiller', sub: 'Awkward Hero', dept: 'Acting'),
    Spotlight(name: 'Melissa McCarthy', sub: 'Force of Nature', dept: 'Acting'),
    Spotlight(name: 'Kristen Wiig', sub: 'Sketch Royalty', dept: 'Acting'),
    Spotlight(name: 'Mike Myers', sub: 'Character Work', dept: 'Acting'),
    Spotlight(name: 'Tina Fey', sub: 'Sharp Wit', dept: 'Acting'),
    Spotlight(name: 'Robin Williams', sub: 'Manic Heart', dept: 'Acting'),
    Spotlight(name: 'Edgar Wright', sub: 'Brit Comedy', dept: 'Directing'),
    Spotlight(name: 'Judd Apatow', sub: 'Hangout Comedy', dept: 'Directing'),
    Spotlight(name: 'Mel Brooks', sub: 'Parody Master', dept: 'Directing'),
  ],
  'Thriller': [
    Spotlight(name: 'Alfred Hitchcock', sub: 'The Master', dept: 'Directing'),
    Spotlight(name: 'David Fincher', sub: 'Dark Thrillers', dept: 'Directing'),
    Spotlight(
      name: 'Denzel Washington',
      sub: 'Tense Performances',
      dept: 'Acting',
    ),
    Spotlight(
      name: 'Christopher Nolan',
      sub: 'Ticking Clocks',
      dept: 'Directing',
    ),
    Spotlight(name: 'Brian De Palma', sub: 'Paranoia', dept: 'Directing'),
    Spotlight(name: 'Jake Gyllenhaal', sub: 'On Edge', dept: 'Acting'),
    Spotlight(name: 'Jodie Foster', sub: 'Nerve', dept: 'Acting'),
    Spotlight(name: 'Anthony Hopkins', sub: 'Quiet Menace', dept: 'Acting'),
  ],
  'Animation': [
    Spotlight(name: 'Hayao Miyazaki', sub: 'Ghibli Magic', dept: 'Directing'),
    Spotlight(name: 'Brad Bird', sub: 'Pixar Greats', dept: 'Directing'),
    Spotlight(name: 'Pete Docter', sub: 'Heartstrings', dept: 'Directing'),
    Spotlight(name: 'Henry Selick', sub: 'Stop-Motion', dept: 'Directing'),
    Spotlight(name: 'Makoto Shinkai', sub: 'Painted Skies', dept: 'Directing'),
    Spotlight(
      name: 'Andrew Stanton',
      sub: 'Worlds of Wonder',
      dept: 'Directing',
    ),
    Spotlight(
      name: 'Genndy Tartakovsky',
      sub: 'Kinetic Style',
      dept: 'Directing',
    ),
    Spotlight(name: 'Tim Burton', sub: 'Gothic Whimsy', dept: 'Directing'),
  ],
  'Mystery': [
    Spotlight(name: 'David Fincher', sub: 'Whodunits', dept: 'Directing'),
    Spotlight(name: 'Rian Johnson', sub: 'Modern Mysteries', dept: 'Directing'),
    Spotlight(
      name: 'Alfred Hitchcock',
      sub: 'Classic Mystery',
      dept: 'Directing',
    ),
    Spotlight(name: 'David Lynch', sub: 'Dreamlogic', dept: 'Directing'),
    Spotlight(name: 'Bong Joon-ho', sub: 'Twist Endings', dept: 'Directing'),
    Spotlight(name: 'Denis Villeneuve', sub: 'Slow Reveal', dept: 'Directing'),
  ],
  'Romance': [
    Spotlight(
      name: 'Ryan Gosling',
      sub: 'Heartbreak Chronicles',
      dept: 'Acting',
    ),
    Spotlight(name: 'Julia Roberts', sub: 'Leading Lady', dept: 'Acting'),
    Spotlight(name: 'Hugh Grant', sub: 'Romcom Royalty', dept: 'Acting'),
    Spotlight(name: 'Nora Ephron', sub: 'Ephron Romcoms', dept: 'Directing'),
    Spotlight(name: 'Meg Ryan', sub: 'Romcom Sweetheart', dept: 'Acting'),
    Spotlight(name: 'Rachel McAdams', sub: 'Modern Romance', dept: 'Acting'),
    Spotlight(
      name: 'Richard Linklater',
      sub: 'Before Trilogy',
      dept: 'Directing',
    ),
    Spotlight(name: 'Audrey Hepburn', sub: 'Timeless', dept: 'Acting'),
  ],
  'Adventure': [
    Spotlight(
      name: 'Steven Spielberg',
      sub: 'Adventure Master',
      dept: 'Directing',
    ),
    Spotlight(name: 'Harrison Ford', sub: 'Indy & Beyond', dept: 'Acting'),
    Spotlight(name: 'Peter Jackson', sub: 'Epic Quests', dept: 'Directing'),
    Spotlight(name: 'Chris Pratt', sub: 'Modern Explorer', dept: 'Acting'),
    Spotlight(
      name: 'James Cameron',
      sub: 'Uncharted Worlds',
      dept: 'Directing',
    ),
    Spotlight(name: 'Ron Howard', sub: 'Grand Journeys', dept: 'Directing'),
    Spotlight(name: 'Sam Neill', sub: 'Into the Wild', dept: 'Acting'),
  ],
  'Documentary': [
    Spotlight(name: 'Werner Herzog', sub: "Werner's World", dept: 'Directing'),
    Spotlight(
      name: 'Errol Morris',
      sub: 'Investigative Docs',
      dept: 'Directing',
    ),
    Spotlight(
      name: 'David Attenborough',
      sub: 'Nature Films',
      dept: 'Acting',
      presenter: true,
    ),
    Spotlight(
      name: 'Louis Theroux',
      sub: 'Field Reports',
      dept: 'Acting',
      presenter: true,
    ),
    Spotlight(name: 'Michael Moore', sub: 'Provocations', dept: 'Directing'),
    Spotlight(name: 'Ken Burns', sub: 'American History', dept: 'Directing'),
    Spotlight(
      name: 'Asif Kapadia',
      sub: 'Archive Portraits',
      dept: 'Directing',
    ),
  ],
  'Fantasy': [
    Spotlight(
      name: 'Peter Jackson',
      sub: 'Middle-earth Maker',
      dept: 'Directing',
    ),
    Spotlight(
      name: 'Guillermo del Toro',
      sub: 'Dark Fantasy',
      dept: 'Directing',
    ),
    Spotlight(
      name: 'Hayao Miyazaki',
      sub: 'Animated Worlds',
      dept: 'Directing',
    ),
    Spotlight(name: 'Tim Burton', sub: 'Gothic Tales', dept: 'Directing'),
    Spotlight(name: 'Terry Gilliam', sub: 'Mad Visions', dept: 'Directing'),
    Spotlight(name: 'Ian McKellen', sub: 'Wizards & Kings', dept: 'Acting'),
  ],
  'War': [
    Spotlight(
      name: 'Steven Spielberg',
      sub: 'War Films',
      dept: 'Directing',
      relatedGenreIds: [18, 36],
    ),
    Spotlight(
      name: 'Stanley Kubrick',
      sub: 'Anti-War',
      dept: 'Directing',
      relatedGenreIds: [18, 35],
    ),
    Spotlight(
      name: 'Kathryn Bigelow',
      sub: 'Modern Warfare',
      dept: 'Directing',
      relatedGenreIds: [18, 53, 36],
    ),
    Spotlight(
      name: 'Oliver Stone',
      sub: 'Vietnam & After',
      dept: 'Directing',
      relatedGenreIds: [18, 36],
    ),
    Spotlight(
      name: 'Christopher Nolan',
      sub: 'The Home Front',
      dept: 'Directing',
      relatedGenreIds: [18, 36, 28],
    ),
    Spotlight(
      name: 'Clint Eastwood',
      sub: 'Both Flags',
      dept: 'Directing',
      relatedGenreIds: [18, 36],
    ),
    Spotlight(
      name: 'Sam Mendes',
      sub: 'The Trenches',
      dept: 'Directing',
      relatedGenreIds: [18, 36],
    ),
    Spotlight(
      name: 'Mel Gibson',
      sub: 'Frontline Valor',
      dept: 'Directing',
      relatedGenreIds: [18, 36],
    ),
  ],
  'Family': [
    Spotlight(name: 'Steven Spielberg', sub: 'For Everyone', dept: 'Directing'),
    Spotlight(name: 'Robin Williams', sub: 'Family Heart', dept: 'Acting'),
    Spotlight(name: 'Tom Hanks', sub: 'Family Favorites', dept: 'Acting'),
    Spotlight(
      name: 'Chris Columbus',
      sub: 'Holiday Classics',
      dept: 'Directing',
    ),
    Spotlight(name: 'Brad Bird', sub: 'All Ages', dept: 'Directing'),
    Spotlight(name: 'Robert Zemeckis', sub: 'Movie Magic', dept: 'Directing'),
  ],
  'History': [
    Spotlight(name: 'Steven Spielberg', sub: 'True Stories', dept: 'Directing'),
    Spotlight(name: 'Ridley Scott', sub: 'Epics & Empires', dept: 'Directing'),
    Spotlight(name: 'Daniel Day-Lewis', sub: 'Period Greats', dept: 'Acting'),
    Spotlight(
      name: 'Stanley Kubrick',
      sub: 'Grand Canvases',
      dept: 'Directing',
    ),
    Spotlight(name: 'Sam Mendes', sub: 'Historical Drama', dept: 'Directing'),
    Spotlight(name: 'Anthony Hopkins', sub: 'Men of History', dept: 'Acting'),
    Spotlight(name: 'Cate Blanchett', sub: 'Queens & Icons', dept: 'Acting'),
  ],
  'Music': [
    Spotlight(
      name: 'Damien Chazelle',
      sub: 'Jazz & Showbiz',
      dept: 'Directing',
    ),
    Spotlight(name: 'Cameron Crowe', sub: 'Music Films', dept: 'Directing'),
    Spotlight(name: 'Bradley Cooper', sub: 'Music Roles', dept: 'Acting'),
    Spotlight(
      name: 'Baz Luhrmann',
      sub: 'Maximalist Musicals',
      dept: 'Directing',
    ),
    Spotlight(name: 'Austin Butler', sub: 'The King', dept: 'Acting'),
  ],
};

/// The day-rotated set of up to six spotlights for [genreName], ported 1:1 from
/// `selectSpotlights`: a genre pool of six or fewer returns unchanged, otherwise
/// a day-seeded Fisher-Yates shuffle picks six.
List<Spotlight> selectSpotlights(String genreName, {DateTime? now}) {
  final pool = kGenreSpotlights[genreName] ?? const [];
  if (pool.length <= _spotlightCount) return pool;
  final rng = mulberry32(
    mixSeed(dayIndex(now ?? DateTime.now()), hashStr(genreName)),
  );
  final arr = [...pool];
  for (var i = arr.length - 1; i > 0; i--) {
    final j = (rng() * (i + 1)).floor();
    final tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.sublist(0, _spotlightCount);
}
