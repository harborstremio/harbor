const GROUPS = [
  ["Director", ["director", "directors", "co-director", "codirector", "director/producer"]],
  ["Screenplay", ["screenplay", "screenwriter", "screen writer", "written by", "writer", "writers", "scenario", "story", "adaptation", "dialogue", "screen story", "script"]],
  ["Based on", ["literary source", "novel", "play", "book", "short story", "source material", "comic strip", "musical", "opera", "poem", "libretto"]],
  ["Cinematography", ["cinematographer", "cinematography", "director of photography", "camera", "cameraman", "camera operator", "cinematographer(seq)", "photography", "additional photography", "aerial photography"]],
  ["Editing", ["editor", "editing", "film editor", "supervising editor", "editors", "supervising film editor"]],
  ["Production design", ["production design", "production designer", "art direction", "art director", "set design", "set designer", "set decoration", "set decorator", "settings", "art directors", "production designers"]],
  ["Costumes", ["costumes", "costume design", "costume designer", "wardrobe", "gowns", "costume"]],
  ["Music", ["music", "original music", "musical score", "music composer", "composer", "music direction", "score", "songs", "song", "lyrics", "music supervisor", "musical direction", "music (uncredited)", "original score"]],
  ["Sound", ["sound", "sound design", "sound designer", "sound recording", "sound re-recording mixer", "sound effects", "sound editor", "sound mixer"]],
  ["Animation", ["animation", "animator", "animators", "animation director", "animation supervisor", "animation design"]],
  ["Visual effects", ["visual effects", "special effects", "special photographic effects", "optical effects", "visual effects supervisor", "special visual effects"]],
  ["Choreography", ["choreography", "choreographer", "dance director"]],
  ["Titles", ["titles", "title design", "title designer", "main titles"]],
  ["Producer", ["producer", "producers", "executive producer", "associate producer", "co-producer", "coproducer", "executive producers"]],
];

const PERFORMER = new Set([
  "actor", "actress", "actors", "actresses", "voice", "performer", "performers", "narrator",
  "appearance", "himself", "herself", "themselves", "self", "cast", "actor (voice)",
  "actress (voice)", "actor?", "actress?", "musical performer", "host", "commentator",
  "interviewee", "subject", "interviewer", "guest", "singer", "dancer", "voices",
]);

const lookup = new Map();
for (const [label, names] of GROUPS) for (const n of names) lookup.set(n, label);

const ORDER = new Map(GROUPS.map(([label], i) => [label, i]));

function normal(role) {
  return String(role ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function variants(role) {
  const base = normal(role);
  const out = [base];
  const bare = base.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (bare && bare !== base) out.push(bare);
  for (const v of [...out]) {
    const byless = v.replace(/\s+by$/, "").trim();
    if (byless && byless !== v) out.push(byless);
  }
  return out;
}

function classify(role) {
  for (const v of variants(role)) {
    if (PERFORMER.has(v)) return null;
    const label = lookup.get(v);
    if (label) return label;
  }
  return undefined;
}

const CREDENTIAL = /^(?:[A-Z]\.?){2,5}$/;

export function displayName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  const parts = name.split(",").map((p) => p.trim());
  while (parts.length > 1 && CREDENTIAL.test(parts[parts.length - 1])) parts.pop();
  if (parts.length !== 2) return parts.join(", ");
  const [surname, given] = parts;
  if (!surname || !given) return name;
  return `${given} ${surname}`;
}

export function craftCredits(contributors) {
  const byRole = new Map();
  for (const c of contributors ?? []) {
    const label = classify(c.role);
    if (!label) continue;
    const name = displayName(c.name);
    if (!name) continue;
    const arr = byRole.get(label) ?? [];
    if (!arr.includes(name)) arr.push(name);
    byRole.set(label, arr);
  }
  return [...byRole.entries()]
    .sort((a, b) => (ORDER.get(a[0]) ?? 99) - (ORDER.get(b[0]) ?? 99))
    .map(([label, names]) => [label, names]);
}

export function roleCoverage(items) {
  let kept = 0;
  let performers = 0;
  let dropped = 0;
  const unknown = new Map();
  for (const it of items) {
    for (const c of it.contributors ?? []) {
      const label = classify(c.role);
      if (label === null) performers += 1;
      else if (label) kept += 1;
      else {
        dropped += 1;
        const key = normal(c.role);
        unknown.set(key, (unknown.get(key) ?? 0) + 1);
      }
    }
  }
  return { kept, performers, dropped, unknown };
}
