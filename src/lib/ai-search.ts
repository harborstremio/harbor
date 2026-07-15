import { searchCinemeta } from "./search";
import { DEFAULT_AI_MODEL, migrateModelId, providerForModel } from "./ai-models";
import type { Meta } from "./cinemeta";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_SUGGESTIONS = 12;

export type AiSuggestion = {
  title: string;
  year?: number;
  type?: "movie" | "series";
  season?: number;
  episode?: number;
  episodeTitle?: string;
};

export type AiResult = {
  meta: Meta;
  season?: number;
  episode?: number;
  episodeTitle?: string;
};

const SYSTEM_PROMPT =
  "You are a film and TV discovery engine for a media app. The user describes what they want to watch in natural language. Reply with ONLY a JSON array (no prose, no markdown code fences) of up to 12 specific, real movies or TV shows that best match, most relevant first. Each element is an object: {\"title\": string, \"year\": number, \"type\": \"movie\" or \"series\"}. If the user is clearly asking about a SPECIFIC EPISODE (by plot, scene, character, quote, or meme, for example 'the south park episode with kanye west'), return that show as the first result and add its \"season\" and \"episode\" numbers plus \"episodeTitle\", like {\"title\": \"South Park\", \"type\": \"series\", \"season\": 13, \"episode\": 5, \"episodeTitle\": \"Fishsticks\"}. Use your own knowledge of the show to pick the exact episode. Use the original or most internationally recognized title. Never repeat a title. When live web context is provided below, treat it as authoritative ground truth for fact-grounded queries (people's filmographies, box office, recency, regional titles, memes, current seasons/episodes) — use it as your primary source and cite the exact title/year it mentions rather than guessing from training data.";

export async function aiSuggest(
  key: string,
  model: string,
  query: string,
  webContext?: string,
): Promise<AiSuggestion[]> {
  const q = query.trim();
  if (!key.trim() || !q) return [];
  const isGroq = providerForModel(model) === "groq";
  const url = isGroq ? GROQ_URL : OPENROUTER_URL;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key.trim()}`,
    "Content-Type": "application/json",
  };
  if (!isGroq) {
    headers["HTTP-Referer"] = (import.meta.env.VITE_APP_URL as string | undefined) || "http://localhost:1420";
    headers["X-Title"] = "Harbor";
  }
  const systemPrompt = webContext?.trim()
    ? `${SYSTEM_PROMPT}\n\nLive web context for this query (use it when relevant, fall back to your own knowledge otherwise):\n${webContext}`
    : SYSTEM_PROMPT;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: migrateModelId(model.trim()) || DEFAULT_AI_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: q },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI search failed (${res.status}). ${detail.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseSuggestions(data?.choices?.[0]?.message?.content ?? "");
}

export function extractJsonArray(raw: string): string | null {
  const s = raw.replace(/```(?:json)?/gi, "");
  const m = /\[\s*\{/.exec(s);
  if (!m) return null;
  const start = m.index;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseSuggestions(content: string): AiSuggestion[] {
  const span = extractJsonArray(content);
  if (!span) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(span);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: AiSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const dedup = title.toLowerCase();
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    const year =
      typeof o.year === "number" && Number.isFinite(o.year) ? Math.round(o.year) : undefined;
    const type = o.type === "series" || o.type === "movie" ? o.type : undefined;
    const season =
      typeof o.season === "number" && Number.isFinite(o.season) ? Math.round(o.season) : undefined;
    const episode =
      typeof o.episode === "number" && Number.isFinite(o.episode) ? Math.round(o.episode) : undefined;
    const episodeTitle =
      typeof o.episodeTitle === "string" && o.episodeTitle.trim() ? o.episodeTitle.trim() : undefined;
    out.push({ title, year, type, season, episode, episodeTitle });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickBest(pool: Meta[], suggestion: AiSuggestion): Meta | null {
  const target = norm(suggestion.title);
  if (!target) return null;
  let best: Meta | null = null;
  let bestScore = 0;
  for (const m of pool) {
    const name = norm(m.name ?? "");
    if (!name) continue;
    let nameScore = 0;
    if (name === target) nameScore = 5;
    else if (target.length >= 4 && name.includes(target)) nameScore = 3;
    if (nameScore === 0) continue;
    let score = nameScore;
    if (suggestion.type && m.type === suggestion.type) score += 1;
    if (suggestion.year && m.releaseInfo && m.releaseInfo.includes(String(suggestion.year)))
      score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export async function resolveAiSuggestions(suggestions: AiSuggestion[]): Promise<AiResult[]> {
  const resolved = await Promise.all(
    suggestions.map(async (s): Promise<AiResult | null> => {
      try {
        const c = await searchCinemeta(s.title);
        const meta = pickBest([...c.movies, ...c.series], s);
        if (!meta) return null;
        const isEpisode = meta.type === "series" && s.season != null && s.episode != null;
        return {
          meta,
          season: isEpisode ? s.season : undefined,
          episode: isEpisode ? s.episode : undefined,
          episodeTitle: isEpisode ? s.episodeTitle : undefined,
        };
      } catch {
        return null;
      }
    }),
  );
  const out: AiResult[] = [];
  const seen = new Set<string>();
  for (const r of resolved) {
    if (!r) continue;
    const key =
      r.season != null && r.episode != null ? `${r.meta.id}:${r.season}:${r.episode}` : r.meta.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
