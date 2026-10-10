// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  createVisionStore,
  espnLeagueFromPath,
  parseTemplate,
  parseTheme,
  pickArtwork,
} from "../src/lib/jl/sports/vision-branding.ts";

const VIEWER = "11111111-2222-3333-4444-555555555555";
const THEME = {
  conference: "big-ten",
  sport: "football",
  team_slug: "michigan",
  primary_hex: "#00274C",
  secondary_hex: "#FFCB05",
  accent_hex: "#FFCB05",
  gradient_start_hex: "#00274C",
  gradient_end_hex: "#0B1220",
  glow_hex: "#FFCB05",
  background_hex: "#050A14",
  text_dark_hex: "#0B1220",
  text_light_hex: "#FFFFFF",
  glass_blur_px: 20,
  glass_opacity: 0.3,
};

test("league path segment is ESPN's provider league", () => {
  assert.equal(espnLeagueFromPath("football/college-football"), "college-football");
  assert.equal(espnLeagueFromPath("football/nfl"), "nfl");
  assert.equal(espnLeagueFromPath(undefined), null);
});

test("a palette needs every colour; colours lose their '#'", () => {
  assert.equal(parseTheme(THEME)?.primary, "00274c");
  assert.equal(parseTheme({ ...THEME, glow_hex: null }), null);
});

test("templates keep valid zones in z order", () => {
  const tpl = parseTemplate({
    template_slug: "team-hero-banner",
    template_type: "hero",
    canvas_width: 3840,
    canvas_height: 2160,
    layout_json: {
      zones: [
        { id: "logo", kind: "team_logo", z: 5, rect: { x: 60, y: 10, w: 30, h: 60 } },
        { id: "bg", kind: "generated_background", z: 0, rect: { x: 0, y: 0, w: 100, h: 100 } },
        { id: "bad", kind: "text", z: 1, rect: { x: 0 } },
      ],
    },
  });
  assert.deepEqual(
    tpl?.zones.map((z) => z.id),
    ["bg", "logo"],
  );
});

test("own artwork beats shared; primary, then newest", () => {
  const team = { conference: "big-ten", sport: "football", team_slug: "michigan" };
  const art = pickArtwork(
    [
      { ...team, slot: "hero", storage_path: `${VIEWER}/old.png`, created_at: "2026-01-01" },
      { ...team, slot: "hero", storage_path: `${VIEWER}/new.png`, created_at: "2026-02-01" },
      {
        ...team,
        slot: "card",
        storage_path: `${VIEWER}/c1.png`,
        is_primary: true,
        created_at: "2026-01-01",
      },
      { ...team, slot: "card", storage_path: `${VIEWER}/c2.png`, created_at: "2026-03-01" },
    ],
    [
      { ...team, slot: "hero", storage_path: "published/michigan/hero.png" },
      { ...team, slot: "wallpaper", storage_path: "published/michigan/wall.png" },
      { ...team, slot: "logo", storage_path: "published/michigan/logo.png" },
    ],
  );
  const slots = art.get("big-ten/football/michigan");
  assert.equal(slots?.get("hero"), `${VIEWER}/new.png`);
  assert.equal(slots?.get("card"), `${VIEWER}/c1.png`);
  assert.equal(slots?.get("wallpaper"), "published/michigan/wall.png");
  assert.equal(slots?.size, 3);
});

function fakePorts(signedIn = true) {
  const tables: Record<string, unknown[]> = {
    sports_groups: [
      { slug: "nfl", name: "NFL", league: "nfl", group_type: "league", parent_slug: null },
      {
        slug: "nfl-nfc",
        name: "NFC",
        league: "nfl",
        group_type: "nfl_conference",
        parent_slug: "nfl",
      },
      {
        slug: "nfl-nfc-west",
        name: "NFC West",
        league: "nfl",
        group_type: "division",
        parent_slug: "nfl-nfc",
      },
      {
        slug: "big-ten",
        name: "Big Ten",
        league: "ncaa-fbs",
        group_type: "conference",
        parent_slug: null,
      },
    ],
    sports_teams: [
      {
        conference: "big-ten",
        sport: "football",
        team_slug: "michigan",
        team_name: "Michigan",
        mascot: "Wolverines",
        league: "ncaa-fbs",
        logo_path: "logos/big-ten/michigan.png",
        provider_ids: [{ provider: "espn", league: "college-football", id: "130" }],
      },
      {
        conference: "nfl-nfc-west",
        sport: "football",
        team_slug: "seattle-seahawks",
        team_name: "Seattle Seahawks",
        league: "nfl",
        logo_path: null,
        provider_ids: [{ provider: "espn", league: "nfl", id: "26" }],
      },
    ],
    sports_team_themes: [THEME],
    sports_templates: [],
    sports_published_art: [],
    sports_my_artwork: [],
  };
  const calls: string[] = [];
  return {
    calls,
    ports: {
      context: () => (signedIn ? { userId: VIEWER, generation: 1 } : null),
      rest: async (path: string) => {
        calls.push(path);
        return new Response(JSON.stringify(tables[path.split("?")[0]] ?? []), { status: 200 });
      },
      storage: async (_path: string, init?: RequestInit) => {
        const { paths } = JSON.parse(String(init?.body)) as { paths: string[] };
        return new Response(
          JSON.stringify(
            paths.map((p) => ({ path: p, signedURL: `/object/sign/media-art/${p}?token=t` })),
          ),
          { status: 200 },
        );
      },
      storageUrl: (relative: string) => `https://accounts.example.com/storage/v1${relative}`,
    },
  };
}

test("the store matches teams by provider id and walks NFL divisions", async () => {
  const { ports } = fakePorts();
  const store = createVisionStore(ports);
  await store.load();
  assert.equal(store.status(), "ready");
  const michigan = store.byProvider("espn", "college-football", "130");
  assert.equal(michigan?.name, "Michigan");
  assert.equal(store.byProvider("espn", "nfl", "130"), null);
  assert.equal(store.theme(michigan!.key)?.secondary, "ffcb05");
  assert.match(store.logoUrl(michigan!.key) ?? "", /logos\/big-ten\/michigan\.png\?token=t$/);
  assert.deepEqual(
    store.teams("nfl").map((t) => t.slug),
    ["seattle-seahawks"],
  );
  const seattle = store.byProvider("espn", "nfl", "26");
  assert.equal(store.theme(seattle!.key), null);
  assert.equal(store.logoUrl(seattle!.key), null);
});

test("signed out, nothing is read and every lookup is empty", async () => {
  const { ports, calls } = fakePorts(false);
  const store = createVisionStore(ports);
  await store.load();
  assert.equal(store.status(), "signed-out");
  assert.equal(calls.length, 0);
  assert.equal(store.byProvider("espn", "college-football", "130"), null);
  assert.deepEqual(store.groups(), []);
});
