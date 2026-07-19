// @ts-nocheck -- Node's test modules are not included in the application tsconfig.
import assert from "node:assert/strict";
import test from "node:test";
import { createParentalGuideClient, type ParentalGuide } from "../src/lib/parental-guide-client.ts";

const BASE = "https://parental-guide.test";

function guide(id: string, itemCount: number): ParentalGuide {
  return {
    id,
    mpa_rating: "PG-13",
    mpa_rating_reason: null,
    categories: [
      {
        id: "violence",
        title: "Violence & Gore",
        severity: null,
        severity_breakdown: [],
        total_severity_votes: 0,
        total_items: itemCount,
        items: Array.from({ length: itemCount }, (_, index) => ({
          id: `violence-${index + 1}`,
          is_spoiler: false,
          text: `Note ${index + 1}`,
          html: "",
        })),
      },
    ],
  };
}

function response(body: ParentalGuide, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

test("does not cache failed parental-guide requests", async () => {
  let calls = 0;
  const client = createParentalGuideClient(async () => {
    calls += 1;
    return calls === 1 ? response(guide("tt1234567", 5), false) : response(guide("tt1234567", 5));
  }, BASE);

  assert.equal(await client.fetchParentalGuide("tt1234567", "movie"), null);
  assert.equal((await client.fetchParentalGuide("tt1234567", "movie"))?.id, "tt1234567");
  assert.equal(calls, 2);
});

test("deduplicates concurrent initial guide requests", async () => {
  let calls = 0;
  let resolveResponse!: (value: Response) => void;
  const pendingResponse = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const client = createParentalGuideClient(async () => {
    calls += 1;
    return pendingResponse;
  }, BASE);

  const first = client.fetchParentalGuide("tt1234567", "movie");
  const second = client.fetchParentalGuide("tt1234567", "movie");
  resolveResponse(response(guide("tt1234567", 5)));

  assert.equal((await first)?.id, "tt1234567");
  assert.equal((await second)?.id, "tt1234567");
  assert.equal(calls, 1);
});

test("refreshes guide recency before evicting the least recently used entry", async () => {
  const calls = new Map<string, number>();
  const client = createParentalGuideClient(
    async (input) => {
      const id = new URL(String(input)).pathname.split("/")[2];
      calls.set(id, (calls.get(id) ?? 0) + 1);
      return response(guide(id, 5));
    },
    BASE,
    2,
  );

  await client.fetchParentalGuide("tt0000001", "movie");
  await client.fetchParentalGuide("tt0000002", "movie");
  await client.fetchParentalGuide("tt0000001", "movie");
  await client.fetchParentalGuide("tt0000003", "movie");
  await client.fetchParentalGuide("tt0000002", "movie");

  assert.equal(calls.get("tt0000001"), 1);
  assert.equal(calls.get("tt0000002"), 2);
  assert.equal(calls.get("tt0000003"), 1);
});

test("retains expanded guide results and avoids fetching them again", async () => {
  let calls = 0;
  const client = createParentalGuideClient(async (input) => {
    calls += 1;
    const limit = Number(new URL(String(input)).searchParams.get("items_per_category"));
    return response(guide("tt1234567", limit));
  }, BASE);

  assert.equal(
    (await client.fetchParentalGuide("tt1234567", "movie"))?.categories[0].items.length,
    5,
  );
  assert.equal(
    (
      await client.fetchParentalGuideMore("tt1234567", "movie", [
        { id: "violence", total_items: 10 },
      ])
    )?.categories[0].items.length,
    10,
  );
  assert.equal(
    (await client.fetchParentalGuide("tt1234567", "movie"))?.categories[0].items.length,
    10,
  );
  await client.fetchParentalGuideMore("tt1234567", "movie", [{ id: "violence", total_items: 10 }]);

  assert.equal(calls, 2);
});

test("retries a failed expanded-guide request without discarding cached items", async () => {
  let calls = 0;
  const client = createParentalGuideClient(async (input) => {
    calls += 1;
    const limit = Number(new URL(String(input)).searchParams.get("items_per_category"));
    return calls === 2
      ? response(guide("tt1234567", limit), false)
      : response(guide("tt1234567", limit));
  }, BASE);

  await client.fetchParentalGuide("tt1234567", "movie");
  assert.equal(
    await client.fetchParentalGuideMore("tt1234567", "movie", [
      { id: "violence", total_items: 10 },
    ]),
    null,
  );
  assert.equal(
    (await client.fetchParentalGuide("tt1234567", "movie"))?.categories[0].items.length,
    5,
  );
  assert.equal(
    (
      await client.fetchParentalGuideMore("tt1234567", "movie", [
        { id: "violence", total_items: 10 },
      ])
    )?.categories[0].items.length,
    10,
  );
  assert.equal(calls, 3);
});
