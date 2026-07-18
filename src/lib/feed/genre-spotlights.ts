import { dayIndex, mixSeed, mulberry32 } from "./tags";
import { hashStr } from "./daily-rows-types";

export type Spotlight = {
  name: string;
  sub: string;
  query?: string;
  dept?: "Directing" | "Acting" | "Writing";
  presenter?: boolean;
  relatedGenreIds?: number[];
};

const SPOTLIGHT_COUNT = 6;

export const GENRE_SPOTLIGHTS: Record<string, Spotlight[]> = {
  Western: [
    { name: "Clint Eastwood", sub: "Westerns", dept: "Acting" },
    { name: "John Wayne", sub: "His Best", dept: "Acting" },
    { name: "Sergio Leone", sub: "Spaghetti Westerns", dept: "Directing" },
    { name: "John Ford", sub: "Frontier Classics", dept: "Directing" },
    { name: "Kurt Russell", sub: "Modern Saddles", dept: "Acting" },
    { name: "Kevin Costner", sub: "Open Range", dept: "Acting" },
    { name: "Sam Peckinpah", sub: "Wild Bunch Era", dept: "Directing" },
    { name: "Tommy Lee Jones", sub: "Lone Stars", dept: "Acting" },
  ],
  Action: [
    { name: "Arnold Schwarzenegger", sub: "Pure Action", dept: "Acting" },
    { name: "Keanu Reeves", sub: "Modern Classics", dept: "Acting" },
    { name: "Tom Cruise", sub: "Stunts & Spies", dept: "Acting" },
    { name: "Sylvester Stallone", sub: "Old-school Heat", dept: "Acting" },
    { name: "Jackie Chan", sub: "Kung Fu & Chaos", dept: "Acting" },
    { name: "Charlize Theron", sub: "Action Heroine", dept: "Acting" },
    { name: "Jason Statham", sub: "Fast Hands", dept: "Acting" },
    { name: "Bruce Willis", sub: "Hard Boiled", dept: "Acting" },
    { name: "Michelle Yeoh", sub: "Martial Grace", dept: "Acting" },
    { name: "James Cameron", sub: "Blockbuster Maker", dept: "Directing" },
    { name: "John Woo", sub: "Bullet Ballet", dept: "Directing" },
    { name: "Chad Stahelski", sub: "Gun-Fu", dept: "Directing" },
  ],
  Drama: [
    { name: "Martin Scorsese", sub: "Director's Cut", dept: "Directing" },
    { name: "Daniel Day-Lewis", sub: "Three-Time Oscar", dept: "Acting" },
    { name: "Meryl Streep", sub: "Career Drama", dept: "Acting" },
    { name: "Robert De Niro", sub: "Heavy Hitters", dept: "Acting" },
    { name: "Denzel Washington", sub: "Towering Roles", dept: "Acting" },
    { name: "Joaquin Phoenix", sub: "Raw Nerve", dept: "Acting" },
    { name: "Cate Blanchett", sub: "Commanding Range", dept: "Acting" },
    { name: "Al Pacino", sub: "Big Swings", dept: "Acting" },
    { name: "Philip Seymour Hoffman", sub: "Quiet Force", dept: "Acting" },
    { name: "Paul Thomas Anderson", sub: "American Epics", dept: "Directing" },
    { name: "Anthony Hopkins", sub: "Master Class", dept: "Acting" },
    { name: "Frances McDormand", sub: "No Frills", dept: "Acting" },
  ],
  Crime: [
    { name: "Martin Scorsese", sub: "Crime Films", dept: "Directing" },
    { name: "Quentin Tarantino", sub: "Tarantino Picks", dept: "Directing" },
    { name: "Al Pacino", sub: "Mob & Cops", dept: "Acting" },
    { name: "Robert De Niro", sub: "Made Men", dept: "Acting" },
    { name: "Joe Pesci", sub: "Mob Cinema", dept: "Acting" },
    { name: "Michael Mann", sub: "Cool Heists", dept: "Directing" },
    { name: "James Gandolfini", sub: "The Boss", dept: "Acting" },
    { name: "Brian De Palma", sub: "Gangster Opera", dept: "Directing" },
    { name: "Ray Liotta", sub: "Wiseguys", dept: "Acting" },
    { name: "Denzel Washington", sub: "Both Sides of the Law", dept: "Acting" },
  ],
  "Sci-Fi": [
    { name: "Denis Villeneuve", sub: "Modern Sci-Fi", dept: "Directing" },
    { name: "Christopher Nolan", sub: "Mind-benders", dept: "Directing" },
    { name: "Ridley Scott", sub: "Worlds Apart", dept: "Directing" },
    { name: "James Cameron", sub: "Future Worlds", dept: "Directing" },
    { name: "Steven Spielberg", sub: "Wonder & Dread", dept: "Directing" },
    { name: "Sigourney Weaver", sub: "Genre Icon", dept: "Acting" },
    { name: "Harrison Ford", sub: "Spacefarer", dept: "Acting" },
    { name: "Jeff Goldblum", sub: "Chaos Theory", dept: "Acting" },
  ],
  Horror: [
    { name: "John Carpenter", sub: "Genre Master", dept: "Directing" },
    { name: "Jordan Peele", sub: "Modern Horror", dept: "Directing" },
    { name: "Stephen King", sub: "King Adaptations", dept: "Writing" },
    { name: "Mike Flanagan", sub: "Slow Burns", dept: "Directing" },
    { name: "Wes Craven", sub: "Nightmare Maker", dept: "Directing" },
    { name: "James Wan", sub: "Modern Frights", dept: "Directing" },
    { name: "Ari Aster", sub: "Dread Incarnate", dept: "Directing" },
    { name: "Guillermo del Toro", sub: "Beautiful Monsters", dept: "Directing" },
    { name: "Jamie Lee Curtis", sub: "Scream Queen", dept: "Acting" },
    { name: "Toni Collette", sub: "Unraveling", dept: "Acting" },
    { name: "Robert Englund", sub: "The Boogeyman", dept: "Acting" },
  ],
  Comedy: [
    { name: "Jim Carrey", sub: "Rubber-Faced Genius", dept: "Acting" },
    { name: "Adam Sandler", sub: "Sandman Picks", dept: "Acting" },
    { name: "Will Ferrell", sub: "Lead Roles", dept: "Acting" },
    { name: "Steve Carell", sub: "His Comedy", dept: "Acting" },
    { name: "Eddie Murphy", sub: "Live Wire", dept: "Acting" },
    { name: "Seth Rogen", sub: "Stoner Auteur", dept: "Acting" },
    { name: "Jonah Hill", sub: "Fast Mouth", dept: "Acting" },
    { name: "Dave Chappelle", sub: "Sketch & Screen", dept: "Acting" },
    { name: "Bill Murray", sub: "Deadpan King", dept: "Acting" },
    { name: "Ben Stiller", sub: "Awkward Hero", dept: "Acting" },
    { name: "Melissa McCarthy", sub: "Force of Nature", dept: "Acting" },
    { name: "Kristen Wiig", sub: "Sketch Royalty", dept: "Acting" },
    { name: "Mike Myers", sub: "Character Work", dept: "Acting" },
    { name: "Tina Fey", sub: "Sharp Wit", dept: "Acting" },
    { name: "Robin Williams", sub: "Manic Heart", dept: "Acting" },
    { name: "Edgar Wright", sub: "Brit Comedy", dept: "Directing" },
    { name: "Judd Apatow", sub: "Hangout Comedy", dept: "Directing" },
    { name: "Mel Brooks", sub: "Parody Master", dept: "Directing" },
  ],
  Thriller: [
    { name: "Alfred Hitchcock", sub: "The Master", dept: "Directing" },
    { name: "David Fincher", sub: "Dark Thrillers", dept: "Directing" },
    { name: "Denzel Washington", sub: "Tense Performances", dept: "Acting" },
    { name: "Christopher Nolan", sub: "Ticking Clocks", dept: "Directing" },
    { name: "Brian De Palma", sub: "Paranoia", dept: "Directing" },
    { name: "Jake Gyllenhaal", sub: "On Edge", dept: "Acting" },
    { name: "Jodie Foster", sub: "Nerve", dept: "Acting" },
    { name: "Anthony Hopkins", sub: "Quiet Menace", dept: "Acting" },
  ],
  Animation: [
    { name: "Hayao Miyazaki", sub: "Ghibli Magic", dept: "Directing" },
    { name: "Brad Bird", sub: "Pixar Greats", dept: "Directing" },
    { name: "Pete Docter", sub: "Heartstrings", dept: "Directing" },
    { name: "Henry Selick", sub: "Stop-Motion", dept: "Directing" },
    { name: "Makoto Shinkai", sub: "Painted Skies", dept: "Directing" },
    { name: "Andrew Stanton", sub: "Worlds of Wonder", dept: "Directing" },
    { name: "Genndy Tartakovsky", sub: "Kinetic Style", dept: "Directing" },
    { name: "Tim Burton", sub: "Gothic Whimsy", dept: "Directing" },
  ],
  Mystery: [
    { name: "David Fincher", sub: "Whodunits", dept: "Directing" },
    { name: "Rian Johnson", sub: "Modern Mysteries", dept: "Directing" },
    { name: "Alfred Hitchcock", sub: "Classic Mystery", dept: "Directing" },
    { name: "David Lynch", sub: "Dreamlogic", dept: "Directing" },
    { name: "Bong Joon-ho", sub: "Twist Endings", dept: "Directing" },
    { name: "Denis Villeneuve", sub: "Slow Reveal", dept: "Directing" },
  ],
  Romance: [
    { name: "Ryan Gosling", sub: "Heartbreak Chronicles", dept: "Acting" },
    { name: "Julia Roberts", sub: "Leading Lady", dept: "Acting" },
    { name: "Hugh Grant", sub: "Romcom Royalty", dept: "Acting" },
    { name: "Nora Ephron", sub: "Ephron Romcoms", dept: "Directing" },
    { name: "Meg Ryan", sub: "Romcom Sweetheart", dept: "Acting" },
    { name: "Rachel McAdams", sub: "Modern Romance", dept: "Acting" },
    { name: "Richard Linklater", sub: "Before Trilogy", dept: "Directing" },
    { name: "Audrey Hepburn", sub: "Timeless", dept: "Acting" },
  ],
  Adventure: [
    { name: "Steven Spielberg", sub: "Adventure Master", dept: "Directing" },
    { name: "Harrison Ford", sub: "Indy & Beyond", dept: "Acting" },
    { name: "Peter Jackson", sub: "Epic Quests", dept: "Directing" },
    { name: "Chris Pratt", sub: "Modern Explorer", dept: "Acting" },
    { name: "James Cameron", sub: "Uncharted Worlds", dept: "Directing" },
    { name: "Ron Howard", sub: "Grand Journeys", dept: "Directing" },
    { name: "Sam Neill", sub: "Into the Wild", dept: "Acting" },
  ],
  Documentary: [
    { name: "Werner Herzog", sub: "Werner's World", dept: "Directing" },
    { name: "Errol Morris", sub: "Investigative Docs", dept: "Directing" },
    { name: "David Attenborough", sub: "Nature Films", dept: "Acting", presenter: true },
    { name: "Louis Theroux", sub: "Field Reports", dept: "Acting", presenter: true },
    { name: "Michael Moore", sub: "Provocations", dept: "Directing" },
    { name: "Ken Burns", sub: "American History", dept: "Directing" },
    { name: "Asif Kapadia", sub: "Archive Portraits", dept: "Directing" },
  ],
  Fantasy: [
    { name: "Peter Jackson", sub: "Middle-earth Maker", dept: "Directing" },
    { name: "Guillermo del Toro", sub: "Dark Fantasy", dept: "Directing" },
    { name: "Hayao Miyazaki", sub: "Animated Worlds", dept: "Directing" },
    { name: "Tim Burton", sub: "Gothic Tales", dept: "Directing" },
    { name: "Terry Gilliam", sub: "Mad Visions", dept: "Directing" },
    { name: "Ian McKellen", sub: "Wizards & Kings", dept: "Acting" },
  ],
  War: [
    { name: "Steven Spielberg", sub: "War Films", dept: "Directing", relatedGenreIds: [18, 36] },
    { name: "Stanley Kubrick", sub: "Anti-War", dept: "Directing", relatedGenreIds: [18, 35] },
    {
      name: "Kathryn Bigelow",
      sub: "Modern Warfare",
      dept: "Directing",
      relatedGenreIds: [18, 53, 36],
    },
    { name: "Oliver Stone", sub: "Vietnam & After", dept: "Directing", relatedGenreIds: [18, 36] },
    {
      name: "Christopher Nolan",
      sub: "The Home Front",
      dept: "Directing",
      relatedGenreIds: [18, 36, 28],
    },
    { name: "Clint Eastwood", sub: "Both Flags", dept: "Directing", relatedGenreIds: [18, 36] },
    { name: "Sam Mendes", sub: "The Trenches", dept: "Directing", relatedGenreIds: [18, 36] },
    { name: "Mel Gibson", sub: "Frontline Valor", dept: "Directing", relatedGenreIds: [18, 36] },
  ],
  Family: [
    { name: "Steven Spielberg", sub: "For Everyone", dept: "Directing" },
    { name: "Robin Williams", sub: "Family Heart", dept: "Acting" },
    { name: "Tom Hanks", sub: "Family Favorites", dept: "Acting" },
    { name: "Chris Columbus", sub: "Holiday Classics", dept: "Directing" },
    { name: "Brad Bird", sub: "All Ages", dept: "Directing" },
    { name: "Robert Zemeckis", sub: "Movie Magic", dept: "Directing" },
  ],
  History: [
    { name: "Steven Spielberg", sub: "True Stories", dept: "Directing" },
    { name: "Ridley Scott", sub: "Epics & Empires", dept: "Directing" },
    { name: "Daniel Day-Lewis", sub: "Period Greats", dept: "Acting" },
    { name: "Stanley Kubrick", sub: "Grand Canvases", dept: "Directing" },
    { name: "Sam Mendes", sub: "Historical Drama", dept: "Directing" },
    { name: "Anthony Hopkins", sub: "Men of History", dept: "Acting" },
    { name: "Cate Blanchett", sub: "Queens & Icons", dept: "Acting" },
  ],
  Music: [
    { name: "Damien Chazelle", sub: "Jazz & Showbiz", dept: "Directing" },
    { name: "Cameron Crowe", sub: "Music Films", dept: "Directing" },
    { name: "Bradley Cooper", sub: "Music Roles", dept: "Acting" },
    { name: "Baz Luhrmann", sub: "Maximalist Musicals", dept: "Directing" },
    { name: "Austin Butler", sub: "The King", dept: "Acting" },
  ],
};

export function selectSpotlights(genreName: string, now: Date = new Date()): Spotlight[] {
  const pool = GENRE_SPOTLIGHTS[genreName] ?? [];
  if (pool.length <= SPOTLIGHT_COUNT) return pool;
  const rng = mulberry32(mixSeed(dayIndex(now), hashStr(genreName)));
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, SPOTLIGHT_COUNT);
}
