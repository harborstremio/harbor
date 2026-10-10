import { loadBillboardChart, type BillboardRanking } from "./discovery-billboard";
import { artistCreditParts } from "./search-artists";

const HOT_100 = "hot-100";

let pending: Promise<BillboardRanking> | null = null;

/** A list mounts many rows at once, and the chart loader dedupes by cache only once it is warm. */
function hot100(): Promise<BillboardRanking> {
  if (!pending) {
    pending = loadBillboardChart(HOT_100).finally(() => {
      pending = null;
    });
  }
  return pending;
}

function key(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function titleKeys(title: string): string[] {
  const bare = title.replace(/\s*[([][^)\]]*[)\]]\s*$/, "").trim();
  return [...new Set([key(title), key(bare)])].filter(Boolean);
}

/** Billboard credits every feature in one artist string, so the lead is matched inside it. */
export async function billboardHot100Rank(track: {
  title: string;
  artist: string;
}): Promise<number | null> {
  const wanted = titleKeys(track.title);
  const lead = key(artistCreditParts(track.artist)[0] ?? track.artist);
  if (!wanted.length || lead.length < 3) return null;
  const chart = await hot100();
  for (const entry of chart.entries) {
    if (entry.item.kind !== "track") continue;
    if (!titleKeys(entry.item.title).some((value) => wanted.includes(value))) continue;
    const credited = key(entry.item.artist);
    if (credited.includes(lead) || lead.includes(credited)) return entry.rank;
  }
  return null;
}
