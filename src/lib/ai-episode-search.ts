import { extractJsonArray } from "./ai-search";
import { DEFAULT_AI_MODEL, migrateModelId } from "./ai-models";

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

export type EpisodeRef = { season: number; episode: number };
export type EpisodeCandidate = EpisodeRef & { name?: string; overview?: string };

const SYSTEM_PROMPT =
  'You are an expert on television and anime. A viewer describes an episode from vague memory: a plot point, a scene, a quote, a character moment, or a meme. Identify which episode they mean. Lean on your own knowledge of the show first, then ground the answer in the provided list, which holds the exact seasons, episode numbers, and titles that are available (a short synopsis may follow the title, but it is often brief and omits subplots, so trust your own knowledge of the show when the synopsis does not mention the detail). Reply with ONLY a JSON array (no prose, no markdown) of up to 5 episodes, most likely first, each {"season": number, "episode": number}. Only return season/episode pairs that appear in the list. If nothing plausibly matches, reply with [].';

export async function aiFindEpisodes(
  key: string,
  model: string,
  showName: string,
  episodes: EpisodeCandidate[],
  query: string,
): Promise<EpisodeRef[]> {
  const q = query.trim();
  if (!key.trim() || !q || episodes.length === 0) return [];
  const withOverview = episodes
    .map((e) => `s${e.season}e${e.episode}: ${e.name ?? ""}${e.overview ? ` - ${e.overview}` : ""}`)
    .join("\n");
  const titlesOnly = episodes.map((e) => `s${e.season}e${e.episode}: ${e.name ?? ""}`).join("\n");
  const catalog = withOverview.length <= 24000 ? withOverview : titlesOnly.slice(0, 48000);
  const res = await fetch(OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://harbor.site",
      "X-Title": "Harbor",
    },
    body: JSON.stringify({
      model: migrateModelId(model.trim()) || DEFAULT_AI_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Show: ${showName}\nAvailable episodes (use these exact season and episode numbers):\n${catalog}\n\nWhich episode does this describe: ${q}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI episode search failed (${res.status}). ${detail.slice(0, 160)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseRefs(data?.choices?.[0]?.message?.content ?? "");
}

function parseRefs(content: string): EpisodeRef[] {
  const span = extractJsonArray(content);
  if (!span) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(span);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: EpisodeRef[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const season = typeof o.season === "number" ? Math.round(o.season) : NaN;
    const episode = typeof o.episode === "number" ? Math.round(o.episode) : NaN;
    if (!Number.isFinite(season) || !Number.isFinite(episode)) continue;
    const key = `${season}-${episode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ season, episode });
    if (out.length >= 8) break;
  }
  return out;
}
