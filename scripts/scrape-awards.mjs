// Scrapes Wikipedia award category pages into a clean per-year winners DB. pls use responsibly


import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const ACTION_API = "https://en.wikipedia.org/w/api.php";
const OUTPUT = path.resolve("src/data/awards.json");
const POLITE_DELAY_MS = 1800;
const MAX_RETRIES = 5;

const CATALOG = {
  oscar: [
    { key: "best_picture", name: "Best Picture", page: "Academy_Award_for_Best_Picture", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Academy_Award_for_Best_Director", focus: "person_with_work" },
    { key: "best_actor", name: "Best Actor", page: "Academy_Award_for_Best_Actor", focus: "person_with_work" },
    { key: "best_actress", name: "Best Actress", page: "Academy_Award_for_Best_Actress", focus: "person_with_work" },
    { key: "best_supporting_actor", name: "Best Supporting Actor", page: "Academy_Award_for_Best_Supporting_Actor", focus: "person_with_work" },
    { key: "best_supporting_actress", name: "Best Supporting Actress", page: "Academy_Award_for_Best_Supporting_Actress", focus: "person_with_work" },
    { key: "best_animated_feature", name: "Best Animated Feature", page: "Academy_Award_for_Best_Animated_Feature", focus: "work" },
    { key: "best_international_feature", name: "Best International Feature Film", page: "Academy_Award_for_Best_International_Feature_Film", focus: "work" },
    { key: "best_adapted_screenplay", name: "Best Adapted Screenplay", page: "Academy_Award_for_Best_Adapted_Screenplay", focus: "work" },
    { key: "best_original_screenplay", name: "Best Original Screenplay", page: "Academy_Award_for_Best_Original_Screenplay", focus: "work" },
  ],
  emmy: [
    { key: "outstanding_drama_series", name: "Outstanding Drama Series", page: "Primetime_Emmy_Award_for_Outstanding_Drama_Series", focus: "work" },
    { key: "outstanding_comedy_series", name: "Outstanding Comedy Series", page: "Primetime_Emmy_Award_for_Outstanding_Comedy_Series", focus: "work" },
    { key: "outstanding_limited_series", name: "Outstanding Limited or Anthology Series", page: "Primetime_Emmy_Award_for_Outstanding_Limited_or_Anthology_Series", focus: "work" },
    { key: "lead_actor_drama", name: "Lead Actor in a Drama Series", page: "Primetime_Emmy_Award_for_Outstanding_Lead_Actor_in_a_Drama_Series", focus: "person_with_work" },
    { key: "lead_actress_drama", name: "Lead Actress in a Drama Series", page: "Primetime_Emmy_Award_for_Outstanding_Lead_Actress_in_a_Drama_Series", focus: "person_with_work" },
    { key: "lead_actor_comedy", name: "Lead Actor in a Comedy Series", page: "Primetime_Emmy_Award_for_Outstanding_Lead_Actor_in_a_Comedy_Series", focus: "person_with_work" },
    { key: "lead_actress_comedy", name: "Lead Actress in a Comedy Series", page: "Primetime_Emmy_Award_for_Outstanding_Lead_Actress_in_a_Comedy_Series", focus: "person_with_work" },
  ],
  golden_globe: [
    { key: "best_picture_drama", name: "Best Motion Picture · Drama", page: "Golden_Globe_Award_for_Best_Motion_Picture_%E2%80%93_Drama", focus: "work" },
    { key: "best_picture_musical_comedy", name: "Best Motion Picture · Musical or Comedy", page: "Golden_Globe_Award_for_Best_Motion_Picture_%E2%80%93_Musical_or_Comedy", focus: "work" },
    { key: "best_tv_drama", name: "Best Television Series · Drama", page: "Golden_Globe_Award_for_Best_Television_Series_%E2%80%93_Drama", focus: "work" },
    { key: "best_tv_musical_comedy", name: "Best Television Series · Musical or Comedy", page: "Golden_Globe_Award_for_Best_Television_Series_%E2%80%93_Musical_or_Comedy", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Golden_Globe_Award_for_Best_Director", focus: "person_with_work" },
    { key: "best_actor_drama", name: "Best Actor · Drama", page: "Golden_Globe_Award_for_Best_Actor_%E2%80%93_Motion_Picture_Drama", focus: "person_with_work" },
    { key: "best_actress_drama", name: "Best Actress · Drama", page: "Golden_Globe_Award_for_Best_Actress_%E2%80%93_Motion_Picture_Drama", focus: "person_with_work" },
  ],
  bafta: [
    { key: "best_film", name: "Best Film", page: "BAFTA_Award_for_Best_Film", focus: "work" },
    { key: "best_director", name: "Best Director", page: "BAFTA_Award_for_Best_Direction", focus: "person_with_work" },
    { key: "best_actor", name: "Best Actor in a Leading Role", page: "BAFTA_Award_for_Best_Actor_in_a_Leading_Role", focus: "person_with_work" },
    { key: "best_actress", name: "Best Actress in a Leading Role", page: "BAFTA_Award_for_Best_Actress_in_a_Leading_Role", focus: "person_with_work" },
  ],
  sag: [
    { key: "outstanding_cast_motion_picture", name: "Outstanding Cast in a Motion Picture", page: "Screen_Actors_Guild_Award_for_Outstanding_Performance_by_a_Cast_in_a_Motion_Picture", focus: "work" },
    { key: "outstanding_drama_ensemble", name: "Outstanding Ensemble in a Drama Series", page: "Screen_Actors_Guild_Award_for_Outstanding_Performance_by_an_Ensemble_in_a_Drama_Series", focus: "work" },
    { key: "outstanding_comedy_ensemble", name: "Outstanding Ensemble in a Comedy Series", page: "Screen_Actors_Guild_Award_for_Outstanding_Performance_by_an_Ensemble_in_a_Comedy_Series", focus: "work" },
    { key: "lead_actor_motion_picture", name: "Outstanding Male Actor in a Leading Role", page: "Screen_Actors_Guild_Award_for_Outstanding_Performance_by_a_Male_Actor_in_a_Leading_Role", focus: "person_with_work" },
    { key: "lead_actress_motion_picture", name: "Outstanding Female Actor in a Leading Role", page: "Screen_Actors_Guild_Award_for_Outstanding_Performance_by_a_Female_Actor_in_a_Leading_Role", focus: "person_with_work" },
  ],
  critics_choice: [
    { key: "best_picture", name: "Best Picture", page: "Critics%27_Choice_Movie_Award_for_Best_Picture", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Critics%27_Choice_Movie_Award_for_Best_Director", focus: "person_with_work" },
    { key: "best_actor", name: "Best Actor", page: "Critics%27_Choice_Movie_Award_for_Best_Actor", focus: "person_with_work" },
    { key: "best_actress", name: "Best Actress", page: "Critics%27_Choice_Movie_Award_for_Best_Actress", focus: "person_with_work" },
    { key: "best_drama_series", name: "Best Drama Series", page: "Critics%27_Choice_Television_Award_for_Best_Drama_Series", focus: "work" },
    { key: "best_comedy_series", name: "Best Comedy Series", page: "Critics%27_Choice_Television_Award_for_Best_Comedy_Series", focus: "work" },
  ],
  cannes: [
    { key: "palme_dor", name: "Palme d'Or", page: "Palme_d%27Or", focus: "work" },
    { key: "grand_prix", name: "Grand Prix", page: "Grand_Prix_(Cannes_Film_Festival)", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Best_Director_Award_(Cannes_Film_Festival)", focus: "person_with_work" },
  ],
  venice: [
    { key: "golden_lion", name: "Golden Lion", page: "Golden_Lion", focus: "work" },
    { key: "silver_lion_director", name: "Silver Lion · Best Director", page: "Silver_Lion", focus: "person_with_work" },
  ],
  berlin: [
    { key: "golden_bear", name: "Golden Bear", page: "Golden_Bear", focus: "work" },
    { key: "silver_bear_director", name: "Silver Bear for Best Director", page: "Silver_Bear_for_Best_Director", focus: "person_with_work" },
  ],
  bafta_tv: [
    { key: "best_drama_series", name: "Best Drama Series", page: "British_Academy_Television_Award_for_Best_Drama_Series", focus: "work" },
    { key: "best_scripted_comedy", name: "Best Scripted Comedy", page: "British_Academy_Television_Award_for_Best_Scripted_Comedy", focus: "work" },
    { key: "best_actor", name: "Best Actor", page: "British_Academy_Television_Award_for_Best_Actor", focus: "person_with_work" },
    { key: "best_actress", name: "Best Actress", page: "British_Academy_Television_Award_for_Best_Actress", focus: "person_with_work" },
    { key: "best_international", name: "Best International Programme", page: "British_Academy_Television_Award_for_Best_International_Programme", focus: "work" },
  ],
  annie: [
    { key: "best_animated_feature", name: "Best Animated Feature", page: "Annie_Award_for_Best_Animated_Feature", focus: "work" },
    { key: "best_tv_production", name: "Best Animated Television Production", page: "Annie_Award_for_Best_Animated_Television_Production", focus: "work" },
  ],
  spirit: [
    { key: "best_film", name: "Best Feature", page: "Independent_Spirit_Award_for_Best_Film", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Independent_Spirit_Award_for_Best_Director", focus: "person_with_work" },
    { key: "best_first_film", name: "Best First Feature", page: "Independent_Spirit_Award_for_Best_First_Film", focus: "work" },
  ],
  saturn: [
    { key: "best_scifi_film", name: "Best Science Fiction Film", page: "Saturn_Award_for_Best_Science_Fiction_Film", focus: "work" },
    { key: "best_fantasy_film", name: "Best Fantasy Film", page: "Saturn_Award_for_Best_Fantasy_Film", focus: "work" },
    { key: "best_horror_film", name: "Best Horror Film", page: "Saturn_Award_for_Best_Horror_Film", focus: "work" },
  ],
  cesar: [
    { key: "best_film", name: "Best Film", page: "C%C3%A9sar_Award_for_Best_Film", focus: "work" },
    { key: "best_director", name: "Best Director", page: "C%C3%A9sar_Award_for_Best_Director", focus: "person_with_work" },
  ],
  goya: [
    { key: "best_film", name: "Best Film", page: "Goya_Award_for_Best_Film", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Goya_Award_for_Best_Director", focus: "person_with_work" },
  ],
  blue_dragon: [
    { key: "best_film", name: "Best Film", page: "Blue_Dragon_Film_Award_for_Best_Film", focus: "work" },
    { key: "best_director", name: "Best Director", page: "Blue_Dragon_Film_Award_for_Best_Director", focus: "person_with_work" },
  ],
  baeksang: [
    { key: "best_film", name: "Best Film", page: "Baeksang_Arts_Award_for_Best_Film", focus: "work" },
    { key: "best_drama", name: "Best Drama", page: "Baeksang_Arts_Award_for_Best_Drama", focus: "work" },
  ],
  bifa: [
    { key: "best_film", name: "Best British Independent Film", page: "British_Independent_Film_Award_for_Best_British_Independent_Film", focus: "work" },
  ],
};

const WIKIPEDIA_NOISE = new Set([
  "[a]", "[b]", "[c]", "[d]", "[e]", "[f]",
  "[edit]", "(edit)", "Wikipedia", "Cite this page",
]);

function cleanText(s) {
  if (!s) return "";
  return s
    .replace(/\[[^\]]*\]/g, "") // [1], [a], [edit]
    .replace(/[‡†§¶♦◊‖¤★]/g, "") // wikipedia footnote markers
    .replace(/\s+/g, " ")
    .trim();
}

function wikiTitleFromHref(href) {
  if (!href || !href.startsWith("/wiki/")) return null;
  const raw = href.slice("/wiki/".length).split("#")[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseYearFromText(text) {
  if (!text) return null;
  const m = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (y < 1900 || y > 2100) return null;
  return y;
}

function isPersonOrFilmLink($, $a) {
  const href = $a.attr("href") ?? "";

  if (!href || href.startsWith("#") || href.includes("cite_") || href.includes("edit&")) return false;
  if (href.startsWith("/wiki/Wikipedia:")) return false;
  if (href.startsWith("/wiki/Help:")) return false;
  if (href.startsWith("/wiki/File:")) return false;
  if (href.startsWith("/wiki/Special:")) return false;
  // Has visible text
  const text = cleanText($a.text());
  if (!text) return false;
  if (WIKIPEDIA_NOISE.has(text)) return false;
  if (text.length < 2) return false;
  return true;
}

function classifyLinks($, $row, includeFirstCell = false) {
  const films = [];
  const filmWikis = [];
  const people = [];
  const seen = new Set();

  const selector = includeFirstCell
    ? "> td a, > th a"
    : "> td:not(:first-child) a, > th:not(:first-child) a";
  $row.find(selector).each((_, a) => {
    const $a = $(a);
    if (!isPersonOrFilmLink($, $a)) return;
    const text = cleanText($a.text());
    if (seen.has(text)) return;

    if (/^\d{4}(\s*[(\[].*)?$/.test(text)) return;
    if (/^\d+(st|nd|rd|th)$/i.test(text)) return;
    if (/^\(.+\)$/.test(text)) return;
    seen.add(text);
    const inItalic = $a.parents("i").length > 0;
    if (inItalic) {
      films.push(text);
      filmWikis.push(wikiTitleFromHref($a.attr("href")));
    } else {
      people.push(text);
    }
  });

  return { films, filmWikis, people };
}

function classifyTextOnly($, $row) {
  
  const films = [];
  const people = [];
  $row.find("i").each((_, i) => {
    const text = cleanText($(i).text());
    if (text) films.push(text);
  });
  return { films, people };
}

function extractRow($, $row, focus, includeFirstCell = false) {
  let { films, filmWikis, people } = classifyLinks($, $row, includeFirstCell);
  // Winner rows often italicize the title as plain text (no link) while linking the
  // season/people; pull the italic text title whenever the links gave us no film.
  if (films.length === 0) {
    const fallback = classifyTextOnly($, $row);
    if (fallback.films.length > 0) {
      films = fallback.films;
      filmWikis = fallback.films.map(() => null);
    }
    if (people.length === 0 && fallback.people.length > 0) people = fallback.people;
  }

  if (focus === "work") {
    if (films.length === 0) return null;
    return {
      workTitle: films[0],
      workWiki: filmWikis[0] ?? null,
      recipients: people.slice(0, 6),
    };
  }

  // person_with_work
  if (people.length === 0 && films.length === 0) return null;
  return {
    workTitle: films[0] ?? null,
    workWiki: filmWikis[0] ?? null,
    recipients: people.length > 0 ? [people[0]] : [],
  };
}

function isHeaderRow($row) {
  // All cells are <th>
  const cells = $row.find("> th, > td");
  if (cells.length === 0) return true;
  const ths = $row.find("> th");
  return ths.length === cells.length;
}

function findCellYear($, $cell) {

  const sortValue = $cell.attr("data-sort-value");
  if (sortValue) {
    const y = parseYearFromText(sortValue);
    if (y) return y;
  }
  return parseYearFromText(cleanText($cell.text()));
}

async function fetchPageHtml(pageTitle) {
  const decoded = decodeURIComponent(pageTitle);
  const params = new URLSearchParams({
    action: "parse",
    page: decoded,
    format: "json",
    prop: "text",
    formatversion: "2",
    redirects: "1",
  });
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${ACTION_API}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "harbor-awards-scraper/1.0 (https://harbor.local)",
      },
    });
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 * (attempt + 1);
      console.warn(`    [retry] HTTP ${res.status}, waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.warn(`    [skip] HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (json?.error) {
      console.warn(`    [skip] api error: ${json.error.info ?? json.error.code}`);
      return null;
    }
    return json?.parse?.text ?? null;
  }
  console.warn(`    [skip] exhausted retries`);
  return null;
}

const WINNER_HIGHLIGHT_RX =
  /background(?:-color)?\s*:\s*(#(?:faeb86|eedd82|f0e68c|ffff99|ffd700|ffdead|fdd|cfc|ccffcc|b0c4de|d4af37|f9f9a0|e5d5a0|ffe4b5|f5deb3|f0f8a0|fadb86|ffffcc|d5f5d5|ccff99|e6ee9c)|gold|khaki)/i;

function rowIsHighlighted($, $row) {
  const rowStyle = ($row.attr("style") ?? "").toLowerCase();
  if (WINNER_HIGHLIGHT_RX.test(rowStyle)) return true;
  let hit = false;
  $row.find("> td, > th").each((_, c) => {
    const style = ($(c).attr("style") ?? "").toLowerCase();
    if (WINNER_HIGHLIGHT_RX.test(style)) hit = true;
  });
  return hit;
}

async function scrapeCategory(category) {
  console.log(`  → ${category.key}: ${category.page}`);
  const html = await fetchPageHtml(category.page);
  if (!html) return [];
  const $ = cheerio.load(html);

  const winners = [];
  const seenYears = new Set();
  const nomineeCount = new Map();
  const seenPairs = new Set();
  const MAX_NOMINEES_PER_YEAR = 8;

  $("table.wikitable").each((_, table) => {
    let carryYear = null;
    let carryRowsLeft = 0;
    let tableUsesHighlight = false;
    $(table)
      .find("> tbody > tr, > tr")
      .each((_, row) => {
        if (!tableUsesHighlight && rowIsHighlighted($, $(row))) tableUsesHighlight = true;
      });

    $(table)
      .find("> tbody > tr, > tr")
      .each((_, row) => {
        const $row = $(row);
        const soloCells = $row.find("> th, > td");
        if (soloCells.length === 1 && soloCells.eq(0).is("th")) {
          const soloYear = findCellYear($, soloCells.eq(0));
          if (soloYear) {
            const span = parseInt(soloCells.eq(0).attr("rowspan") ?? "1", 10);
            carryYear = soloYear;
            carryRowsLeft = Math.max(0, span - 1);
            return;
          }
        }
        if (isHeaderRow($row)) return;
        const cells = $row.find("> th, > td");
        if (cells.length === 0) return;

        const $first = cells.eq(0);
        const candidateYear = findCellYear($, $first);
        if (candidateYear) {
          const span = parseInt($first.attr("rowspan") ?? "1", 10);
          carryYear = candidateYear;
          carryRowsLeft = Math.max(0, span - 1);
        }

        
        if (cells.length === 1) return;

        let year = null;
        if (candidateYear) {
          year = candidateYear;
        } else if (carryRowsLeft > 0 && carryYear != null) {
          year = carryYear;
          carryRowsLeft--;
        }
        if (!year) return;
        const isWinner = tableUsesHighlight
          ? rowIsHighlighted($, $row) && !seenYears.has(year)
          : !seenYears.has(year);

        const data = extractRow($, $row, category.focus, !candidateYear);
        if (!data) return;
        if (!data.workTitle && data.recipients.length === 0) return;

        const pairKey = `${year}|${(data.workTitle ?? data.recipients[0] ?? "").toLowerCase()}`;
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        if (isWinner) {
          seenYears.add(year);
          winners.push({
            year,
            title: data.workTitle ?? null,
            wiki: data.workWiki ?? null,
            recipients: data.recipients,
            won: true,
          });
        } else {
          const n = nomineeCount.get(year) ?? 0;
          if (n >= MAX_NOMINEES_PER_YEAR) return;
          nomineeCount.set(year, n + 1);
          winners.push({
            year,
            title: data.workTitle ?? null,
            wiki: data.workWiki ?? null,
            recipients: data.recipients,
            won: false,
          });
        }
      });
  });

  winners.sort((a, b) => b.year - a.year || (b.won === true ? 1 : 0) - (a.won === true ? 1 : 0));
  return winners;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const only = process.env.ONLY_TYPE || null;
  let out = {};
  if (only) {
    out = JSON.parse(await readFile(OUTPUT, "utf8"));
  }
  let total = 0;
  for (const [type, categories] of Object.entries(CATALOG)) {
    if (only && type !== only) continue;
    out[type] = {};
    console.log(`\n[${type}]`);
    for (const cat of categories) {
      try {
        const entries = await scrapeCategory(cat);
        out[type][cat.key] = {
          name: cat.name,
          entries,
        };
        total += entries.length;
        console.log(`    ${entries.length} entries`);
      } catch (e) {
        console.warn(`    [error] ${e.message}`);
        out[type][cat.key] = { name: cat.name, entries: [] };
      }
      await sleep(POLITE_DELAY_MS);
    }
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${total} entries across ${Object.values(out).reduce((n, t) => n + Object.keys(t).length, 0)} categories → ${OUTPUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
