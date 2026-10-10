import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { MusicTrack } from "../src/lib/music/types.ts";

type ProfileModule = typeof import("../src/lib/music/recording-profile.ts");
function client(fetcher: typeof fetch): ProfileModule {
  const source = readFileSync(
    new URL("../src/lib/music/recording-profile.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.equal(name, "@/lib/safe-fetch");
      return { safeFetch: fetcher };
    },
    module,
    module.exports,
  );
  return module.exports as ProfileModule;
}
const track: MusicTrack = {
  id: "video-123",
  sourceId: "video-123",
  connectorId: "youtube",
  mediaKind: "video",
  title: "Song",
  artist: "Artist",
  album: "",
  artwork: "https://i.ytimg.com/vi/video-123/hqdefault.jpg",
  durationSeconds: 330,
  durationLabel: "5:30",
  quality: { codec: "opus", bitrateKbps: 128 },
};
const isrc = "USSM11914962";
const recordingId = "11111111-1111-4111-8111-111111111111";
const artistId = "22222222-2222-4222-8222-222222222222";
const workId = "33333333-3333-4333-8333-333333333333";
function deezer(id = 21, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: "track",
    title: "Song",
    duration: 237,
    artist: { id: 5, name: "Artist" },
    album: {
      id: 8,
      title: "Actual Album",
      cover_xl: "https://cdn-images.dzcdn.net/images/cover/actual/1000.jpg",
    },
    contributors: [
      { id: 5, name: "Artist", role: "Main" },
      { id: 7, name: "Guest", role: "Featured" },
    ],
    ...extra,
  };
}
const direct = {
  ...track,
  id: "deezer:track:21",
  connectorId: "catalog",
  mediaKind: "audio" as const,
  durationSeconds: 237,
};

test("unique title and artist supply separate catalog/album identities without changing video transport", async () => {
  const calls: string[] = [];
  const c = client(async (url) => {
    calls.push(String(url));
    return Response.json(
      String(url).includes("/search?")
        ? {
            total: 2,
            data: [deezer(), deezer(22, { artist: { id: 99, name: "Unrelated Artist" } })],
          }
        : deezer(),
    );
  });
  const original = structuredClone(track);
  const profile = await c.loadRecordingProfile(Object.freeze(track));
  assert.equal(profile?.catalogTrack.id, "deezer:track:21");
  assert.equal(profile?.album.id, "deezer:album:8");
  assert.equal(profile?.primaryArtist.id, "deezer:artist:5");
  assert.equal(
    profile?.catalogTrack.durationSeconds,
    237,
    "video duration differences are allowed",
  );
  assert.equal(profile?.catalogTrack.quality, undefined);
  assert.equal(profile?.catalogTrack.playbackUrl, undefined);
  assert.equal(profile?.catalogTrack.mediaKind, undefined);
  assert.deepEqual(
    profile?.credits.map((person) => [person.name, person.role]),
    [
      ["Artist", "main artist"],
      ["Guest", "featured artist"],
    ],
  );
  assert.equal(profile?.provenance[0].matchedBy, "unique-title-artist");
  assert.deepEqual(track, original);
  profile!.album.title = "Consumer mutation";
  assert.equal((await c.loadRecordingProfile(track))?.album.title, "Actual Album");
  assert.equal(calls.length, 2);
});

test("presentation labels normalize but remix/live/acoustic/version identity remains distinct", () => {
  const c = client(async () => {
    throw new Error("unused");
  });
  assert.ok(
    c.matchesRecordingCandidate(
      { ...track, title: "Artist - Song (Official Music Video) ft. Guest" },
      deezer(21, { title: "Song (feat. Guest)" }),
    ),
  );
  assert.ok(
    c.matchesRecordingCandidate(
      { ...track, title: "Song (with Guest) [Official Video]" },
      deezer(21, { title: "Song (feat. Guest)" }),
    ),
  );
  for (const suffix of ["(Remix)", "(Live)", "(Acoustic)", "(Radio Edit)", "(2020 Remaster)"]) {
    assert.equal(
      c.matchesRecordingCandidate(track, deezer(21, { title: `Song ${suffix}` })),
      false,
      suffix,
    );
    assert.equal(
      c.matchesRecordingCandidate({ ...track, title: `Song ${suffix}` }, deezer()),
      false,
      suffix,
    );
  }
  assert.equal(c.matchesRecordingCandidate(track, deezer(21, { title_version: "(Remix)" })), false);
  assert.equal(
    c.matchesRecordingCandidate(track, deezer(21, { title: "Song feat. Guest (Remix)" })),
    false,
  );
  assert.equal(
    c.matchesRecordingCandidate(track, deezer(21, { title: "Song ft. Guest - Acoustic" })),
    false,
  );
  assert.equal(c.matchesRecordingCandidate({ ...track, artist: "Stranger" }, deezer()), false);
  assert.equal(
    c.matchesRecordingCandidate({ ...track, artist: "Artist feat. Another guest" }, deezer()),
    false,
  );
  assert.equal(
    c.matchesRecordingCandidate(
      { ...track, connectorId: "local", mediaKind: "audio", durationSeconds: 90 },
      deezer(),
    ),
    false,
  );
  assert.ok(
    c.matchesRecordingCandidate(
      { ...track, artist: "Earth, Wind & Fire" },
      deezer(21, { artist: { id: 8, name: "Earth, Wind & Fire" } }),
    ),
  );
});

test("ambiguous releases and incomplete search sets return null instead of the first result", async () => {
  const candidates = [deezer(), deezer(22, { album: { id: 9, title: "Another Release" } })];
  const c = client(async (url) =>
    Response.json(
      String(url).includes("/search?")
        ? { total: 2, data: candidates }
        : String(url).endsWith("/22")
          ? candidates[1]
          : candidates[0],
    ),
  );
  assert.equal(await c.loadRecordingProfile(track), null);
  assert.equal(
    (await c.loadRecordingProfile({ ...track, album: "Actual Album" }))?.album.id,
    "deezer:album:8",
  );
  let calls = 0;
  const capped = client(async () => {
    calls++;
    return Response.json({
      total: 201,
      data: [deezer()],
      next: "https://api.deezer.com/search?index=100",
    });
  });
  assert.equal(await capped.loadRecordingProfile(track), null);
  assert.equal(calls, 1);
});

test("explicit featured identity can disambiguate recordings but unavailable candidates cannot be ignored", async () => {
  const records = [
    deezer(21, { title: "Song (with Guest)" }),
    deezer(22, { contributors: [{ id: 5, name: "Artist", role: "Main" }] }),
  ];
  const c = client(async (url) =>
    Response.json(
      String(url).includes("/search?")
        ? { total: 2, data: records }
        : String(url).endsWith("/22")
          ? records[1]
          : records[0],
    ),
  );
  assert.equal(
    (await c.loadRecordingProfile({ ...track, title: "Song (with Guest)" }))?.catalogTrack.id,
    "deezer:track:21",
  );
  const unavailable = client(async (url) =>
    String(url).endsWith("/22")
      ? new Response("", { status: 503 })
      : Response.json(String(url).includes("/search?") ? { total: 2, data: records } : records[0]),
  );
  assert.equal(
    await unavailable.loadRecordingProfile({ ...track, title: "Song (with Guest)" }),
    null,
  );
});

test("provider IDs and ISRC take precedence, reject mismatched responses, and retry without poisoned cache", async () => {
  let calls = 0;
  const c = client(async (url) => {
    assert.equal(String(url), "https://api.deezer.com/track/21");
    return Response.json(deezer(++calls === 1 ? 99 : 21));
  });
  assert.equal(await c.loadRecordingProfile(direct), null);
  assert.equal((await c.loadRecordingProfile(direct))?.provenance[0].matchedBy, "provider-id");
  const urls: string[] = [];
  const exact = client(async (url) => {
    urls.push(String(url));
    return String(url).includes("musicbrainz.org")
      ? new Response("", { status: 503 })
      : Response.json(deezer(21, { isrc }));
  });
  assert.equal(
    (await exact.loadRecordingProfile({ ...track, isrc: "US-SM1-19-14962" }))?.provenance[0]
      .matchedBy,
    "isrc",
  );
  assert.equal(urls[0], `https://api.deezer.com/track/isrc:${isrc}`);
  assert.ok(urls.every((url) => !url.includes("/search?")));
  const mismatch = client(async () => Response.json(deezer(21, { isrc: "USSM11914963" })));
  assert.equal(await mismatch.loadRecordingProfile({ ...track, isrc }), null);
});

test("MusicBrainz credits require exact ISRC, recording identity and actual role-bearing recording/work relations", () => {
  const c = client(async () => {
    throw new Error("unused");
  });
  const data = {
    id: recordingId,
    title: "Song",
    length: 237000,
    isrcs: [isrc],
    "artist-credit": [{ artist: { id: artistId, name: "Artist" } }],
    relations: [
      { type: "producer", artist: { id: artistId, name: "Actual Producer" } },
      {
        type: "vocal",
        artist: { id: artistId, name: "Actual Singer" },
        attributes: ["lead vocals"],
      },
      { type: "member of band", artist: { id: artistId, name: "Unrelated membership" } },
      {
        type: "performance",
        work: {
          id: workId,
          title: "Written Work",
          relations: [
            { type: "composer", artist: { id: artistId, name: "Actual Composer" } },
            { type: "lyricist", artist: { id: artistId, name: "Actual Lyricist" } },
          ],
        },
      },
      {
        type: "medley",
        work: {
          id: workId,
          title: "Unverified Link",
          relations: [{ type: "composer", artist: { id: artistId, name: "Wrong Person" } }],
        },
      },
    ],
  };
  const credits = c.parseMusicBrainzRecordingCredits(data, recordingId, isrc, direct);
  assert.deepEqual(
    credits.map((person) => person.role),
    ["producer", "vocal", "composer", "lyricist"],
  );
  assert.equal(credits[2].sourceUrl, `https://musicbrainz.org/work/${workId}`);
  assert.equal(credits[2].workTitle, "Written Work");
  for (const invalid of [
    { ...data, id: artistId },
    { ...data, isrcs: [] },
    { ...data, title: "Song (Live)" },
  ]) {
    assert.deepEqual(c.parseMusicBrainzRecordingCredits(invalid, recordingId, isrc, direct), []);
  }
  assert.equal(
    c.parseDeezerRecording(
      deezer(21, { contributors: [{ id: 5, name: "Unspecified credit" }] }),
      21,
      "provider-id",
    )?.credits.length,
    0,
  );
});

test("ISRC relations enrich the matched profile while the original source and metadata remain separate", async () => {
  const requests: string[] = [];
  const c = client(async (url) => {
    requests.push(String(url));
    if (String(url).includes("api.deezer.com")) return Response.json(deezer(21, { isrc }));
    const recording = {
      id: recordingId,
      title: "Song",
      length: 237000,
      isrcs: [isrc],
      "artist-credit": [{ artist: { id: artistId, name: "Artist" } }],
      relations: [{ type: "producer", artist: { id: artistId, name: "Verified Producer" } }],
    };
    return Response.json(
      String(url).includes("/isrc/") ? { isrc, recordings: [recording] } : recording,
    );
  });
  const profile = await c.loadRecordingProfile(direct);
  assert.equal(profile?.credits.at(-1)?.role, "producer");
  assert.equal(profile?.provenance.at(-1)?.matchedBy, "isrc");
  assert.equal(requests.length, 3);
});

test("shared lookups deduplicate requests and one aborted subscriber cannot cancel another", async () => {
  let finish!: (value: Response) => void;
  let underlying: AbortSignal | undefined;
  let calls = 0;
  const c = client(async (_url, options) => {
    calls++;
    underlying = options?.signal ?? undefined;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  const controller = new AbortController();
  const first = c.loadRecordingProfile(direct, controller.signal);
  const firstRejected = assert.rejects(first, { name: "AbortError" });
  const second = c.loadRecordingProfile(direct);
  controller.abort();
  assert.equal(underlying?.aborted, false);
  finish(Response.json(deezer()));
  await firstRejected;
  assert.equal((await second)?.catalogTrack.id, "deezer:track:21");
  assert.equal(calls, 1);
});

test("aborting every subscriber cancels the fetch and a late result cannot be reused", async () => {
  let finish!: (value: Response) => void;
  let underlying: AbortSignal | undefined;
  let calls = 0;
  const c = client(async (_url, options) => {
    calls++;
    underlying = options?.signal ?? undefined;
    return calls === 1
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : Response.json(deezer());
  });
  const controller = new AbortController();
  const pending = c.loadRecordingProfile(direct, controller.signal);
  const rejected = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  assert.equal(underlying?.aborted, true);
  finish(Response.json(deezer(99)));
  await rejected;
  assert.equal((await c.loadRecordingProfile(direct))?.catalogTrack.id, "deezer:track:21");
  assert.equal(calls, 2);
});

test("declared and streamed oversized JSON is canceled instead of cached", async () => {
  let canceled = 0;
  const c = client(
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(300_000));
          },
          cancel() {
            canceled++;
          },
        }),
      ),
  );
  assert.equal(await c.loadRecordingProfile(direct), null);
  assert.equal(canceled, 1);
  const declared = client(
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            canceled++;
          },
        }),
        { headers: { "Content-Length": "600000" } },
      ),
  );
  assert.equal(await declared.loadRecordingProfile(direct), null);
  assert.equal(canceled, 2);
});
