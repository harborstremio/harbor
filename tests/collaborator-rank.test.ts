import assert from "node:assert/strict";
import test from "node:test";
import {
  BILLING_CAP,
  COLLAB_RAIL_MAX,
  MIN_SHARED_TITLES,
  rankCollaborators,
  type CollaboratorTitle,
} from "../src/views/person/collaborator-rank.ts";
import type { TitleCreditPerson } from "../src/lib/providers/tmdb/tmdb-title-credits.ts";

const SUBJECT = 1;

function actor(
  id: number,
  over: Partial<TitleCreditPerson> = {},
): TitleCreditPerson {
  return {
    id,
    name: `Actor ${id}`,
    profilePath: `/p${id}.jpg`,
    popularity: 1,
    order: id,
    ...over,
  };
}

function title(key: string, cast: TitleCreditPerson[], crew: TitleCreditPerson[] = []): CollaboratorTitle {
  return { key, cast: [actor(SUBJECT, { order: 0 }), ...cast], crew };
}

test("empty input returns empty", () => {
  assert.deepEqual(rankCollaborators([], SUBJECT), []);
});

test("the person is never their own collaborator", () => {
  const ranked = rankCollaborators(
    [
      title("movie:10", [actor(2), actor(3)]),
      title("movie:11", [actor(2), actor(3)]),
      title("movie:12", [actor(2), actor(3)]),
    ],
    SUBJECT,
  );
  assert.equal(
    ranked.find((c) => c.id === SUBJECT),
    undefined,
  );
  assert.deepEqual(ranked.map((c) => c.id), [2, 3]);
});

test("a single shared title is dropped", () => {
  const ranked = rankCollaborators(
    [title("movie:10", [actor(2), actor(3)]), title("movie:11", [actor(2), actor(4)])],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.id), [2]);
  assert.equal(ranked[0].titles, MIN_SHARED_TITLES);
});

test("shared-title count outranks popularity", () => {
  const regular = (order: number) => actor(2, { name: "Regular", popularity: 3, order });
  const star = (order: number) => actor(3, { name: "Star", popularity: 900, order });
  const ranked = rankCollaborators(
    [
      title("movie:10", [regular(1), star(2)]),
      title("movie:11", [regular(1), star(2)]),
      title("movie:12", [regular(1)]),
    ],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.name), ["Regular", "Star"]);
  assert.deepEqual(ranked.map((c) => c.titles), [3, 2]);
});

test("popularity only breaks a tie on equal counts", () => {
  const shared = (id: number, popularity: number, order: number) =>
    actor(id, { name: `P${id}`, popularity, order });
  const ranked = rankCollaborators(
    [
      title("movie:10", [shared(2, 5, 1), shared(3, 80, 2)]),
      title("movie:11", [shared(2, 5, 1), shared(3, 80, 2)]),
    ],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.id), [3, 2]);
});

test("only the top-billed cast is counted", () => {
  const deepCast = Array.from({ length: 40 }, (_, i) => actor(100 + i, { order: i + 1 }));
  const ranked = rankCollaborators(
    [title("movie:10", deepCast), title("movie:11", deepCast)],
    SUBJECT,
  );
  assert.equal(ranked.length, BILLING_CAP);
  const lastBilled = 100 + BILLING_CAP - 1;
  assert.ok(ranked.some((c) => c.id === lastBilled));
  assert.ok(!ranked.some((c) => c.id === lastBilled + 1));
});

test("a second credit for the same actor does not eat a billing slot", () => {
  const others = BILLING_CAP - 1;
  const doubled = [
    actor(2, { order: 1 }),
    actor(2, { order: 2 }),
    ...Array.from({ length: others }, (_, i) => actor(100 + i, { order: i + 3 })),
  ];
  const ranked = rankCollaborators(
    [title("movie:10", doubled), title("movie:11", doubled)],
    SUBJECT,
  );
  assert.equal(ranked.filter((c) => c.id === 2).length, 1);
  assert.equal(ranked.find((c) => c.id === 2)?.titles, 2);
  assert.equal(ranked.length, BILLING_CAP);
  assert.ok(ranked.some((c) => c.id === 100 + others - 1));
});

test("a title counted twice still counts once", () => {
  const cast = [actor(2), actor(3)];
  const ranked = rankCollaborators(
    [title("movie:10", cast), title("movie:10", cast), title("movie:11", cast)],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.titles), [2, 2]);
});

test("recurring directors and writers rank alongside cast and carry a role", () => {
  const goldberg = (job: string) =>
    actor(9, { name: "Evan Goldberg", job, order: undefined, popularity: 10 });
  const ranked = rankCollaborators(
    [
      title("movie:10", [actor(2)], [goldberg("Director"), goldberg("Screenplay")]),
      title("movie:11", [actor(2)], [goldberg("Screenplay")]),
      title("movie:12", [], [goldberg("Director")]),
    ],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.name), ["Evan Goldberg", "Actor 2"]);
  assert.deepEqual(ranked.map((c) => c.titles), [3, 2]);
  assert.equal(ranked[0].role, "Director");
  assert.equal(ranked[1].role, null);
});

test("cast wins a tie against crew", () => {
  const director = actor(9, { name: "Aaa Director", job: "Director", order: undefined, popularity: 500 });
  const ranked = rankCollaborators(
    [
      title("movie:10", [actor(2, { name: "Zzz Actor", popularity: 1 })], [director]),
      title("movie:11", [actor(2, { name: "Zzz Actor", popularity: 1 })], [director]),
    ],
    SUBJECT,
  );
  assert.deepEqual(ranked.map((c) => c.name), ["Zzz Actor", "Aaa Director"]);
});

test("producers are not treated as collaborators", () => {
  const exec = actor(9, { name: "Exec", job: "Executive Producer", order: undefined });
  const ranked = rankCollaborators(
    [title("movie:10", [], [exec]), title("movie:11", [], [exec]), title("movie:12", [], [exec])],
    SUBJECT,
  );
  assert.deepEqual(ranked, []);
});

test("the rail is capped", () => {
  const wide = Array.from({ length: BILLING_CAP }, (_, i) => actor(100 + i, { order: i + 1 }));
  const more = Array.from({ length: BILLING_CAP }, (_, i) => actor(200 + i, { order: i + 1 }));
  const ranked = rankCollaborators(
    [
      title("movie:10", wide),
      title("movie:11", wide),
      title("movie:12", more),
      title("movie:13", more),
    ],
    SUBJECT,
  );
  assert.equal(ranked.length, COLLAB_RAIL_MAX);
});
