const ARTICLE = /^(the|a|an)\s+/;

function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/&/g, " and ")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/'/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function titleKeys(title) {
  const base = fold(title);
  const out = new Set([base, base.replace(ARTICLE, "")]);
  const trailing = base.match(/^(.*?) (the|a|an)$/);
  if (trailing) {
    out.add(`${trailing[2]} ${trailing[1]}`);
    out.add(trailing[1]);
  }
  return [...out].filter(Boolean);
}

export function titleForms(title, sortTitle) {
  const raw = [title, sortTitle].filter(Boolean).map((s) => String(s).replace(/\s+/g, " ").trim());
  const out = new Set(raw);
  for (const t of raw) {
    out.add(t.replace(/\s+aka\s+.*$/i, "").trim());
    const aka = t.match(/\s+aka\s+(.+)$/i)?.[1];
    if (aka) out.add(aka.trim());
    out.add(t.replace(/\s*\[[^\]]*\]/g, "").trim());
    const bracket = t.match(/\[(?:aka\s*)?([^\]]+)\]/i)?.[1];
    if (bracket) out.add(bracket.trim());
    out.add(t.replace(/\s*\([^)]*\)/g, "").trim());
    const paren = t.match(/\((?:aka\s*)?([^)]+)\)/i)?.[1];
    if (paren && paren.split(" ").length > 1) out.add(paren.trim());
    out.add(t.replace(/:.*$/, "").trim());
    out.add(t.replace(/\s*#.*$/, "").trim());
  }
  return [...out].filter((s) => s.length > 1);
}

export function yearSpan(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const years = [];
  let last = null;
  for (const m of text.matchAll(/(\d{4})(s)?|-\s*(\d{2})\b/g)) {
    if (m[1]) {
      const year = Number(m[1]);
      years.push(year);
      if (m[2]) years.push(year + 9);
      last = year;
    } else if (m[3] && last != null) {
      years.push(Math.floor(last / 100) * 100 + Number(m[3]));
    }
  }
  return years.length === 0 ? null : [Math.min(...years), Math.max(...years)];
}

export function buildIndex(bindings, titleFields) {
  const index = new Map();
  for (const row of bindings) {
    const imdb = row.imdbId?.value ?? row.imdb?.value ?? null;
    if (!imdb || !/^tt\d+$/.test(imdb)) continue;
    const entry = {
      imdb,
      tmdb: row.tmdbId?.value ? Number(row.tmdbId.value) : null,
      year: row.year?.value ? Number(row.year.value) : null,
    };
    const titles = [];
    for (const field of titleFields) {
      const value = row[field]?.value;
      if (!value) continue;
      if (field === "alts") titles.push(...value.split("|"));
      else titles.push(value);
    }
    for (const title of titles.filter(Boolean)) {
      for (const key of titleKeys(title)) {
        const bucket = index.get(key) ?? [];
        bucket.push(entry);
        index.set(key, bucket);
      }
    }
  }
  return index;
}

export function resolve(film, index) {
  const span = yearSpan(film.year_released);
  const candidates = new Map();
  for (const form of titleForms(film.title, film.sort_title)) {
    for (const key of titleKeys(form)) {
      for (const entry of index.get(key) ?? []) candidates.set(entry.imdb, entry);
    }
  }
  const pool = [...candidates.values()];
  if (pool.length === 0) return null;
  if (!span) return pool.length === 1 ? pool[0] : null;
  const near = pool.filter((e) => e.year != null && e.year >= span[0] - 1 && e.year <= span[1] + 1);
  if (near.length === 1) return near[0];
  if (near.length === 0 && pool.length === 1 && pool[0].year == null) return pool[0];
  return null;
}
