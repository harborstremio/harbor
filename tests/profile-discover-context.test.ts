import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactDom from "react-dom";
import * as lucide from "lucide-react";
import ts from "typescript";
import * as contextMenu from "../src/lib/context-menu.tsx";
import { dispatchKeyboardContextMenu } from "../src/lib/context-content.ts";

function componentLoader(extra: Record<string, unknown> = {}) {
  const wrap = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children);
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "react-dom": ReactDom,
    "lucide-react": lucide,
    "@/lib/context-menu": contextMenu,
    "@/lib/i18n": { useT: () => (key: string) => key },
    "@/components/poster": {
      Poster: ({ src }: { src?: string }) => React.createElement("img", { src, alt: "Poster" }),
    },
    "@/components/arrowed-scroll-row": { ArrowedScrollRow: wrap },
    "@/components/row": { Row: wrap },
    "@/lib/ratings/poster": {
      useRatingPoster: (_id: string, _type: string, _title: string, poster?: string) => poster,
    },
    "./section-header": { SectionHeader: () => null },
    "./list-heart": { ListHeart: () => null },
    "./list-share-button": { ListShareButton: () => null },
    "./save-list-button": { SaveListButton: () => null },
    ...extra,
  };
  const files: Record<string, string> = {
    "@/components/ratings/rating-poster": "src/components/ratings/rating-poster.tsx",
    "@/components/context-menu/use-title-context":
      "src/components/context-menu/use-title-context.ts",
    "@/components/context-menu/meta-context-button":
      "src/components/context-menu/meta-context-button.tsx",
    "@/lib/social/profile-media-meta": "src/lib/social/profile-media-meta.ts",
    "./critics-pick/still": "src/components/critics-pick/still.tsx",
  };
  const cache: Record<string, unknown> = {};
  const load = (file: string): any => {
    if (cache[file]) return cache[file];
    const { outputText } = ts.transpileModule(
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    );
    const module = { exports: {} };
    new Function("require", "module", "exports", outputText)(
      (name: string) => {
        if (files[name]) return load(files[name]);
        assert.ok(Object.hasOwn(deps, name), `Unexpected dependency in ${file}: ${name}`);
        return deps[name];
      },
      module,
      module.exports,
    );
    cache[file] = module.exports;
    return module.exports;
  };
  return load;
}

async function fixture() {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let menu!: ReturnType<typeof contextMenu.useContextMenu>;
  const Observer = () => {
    menu = contextMenu.useContextMenu();
    return null;
  };
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  return {
    dom,
    menu: () => menu,
    render: async (node: React.ReactNode) =>
      React.act(async () => {
        root.render(
          React.createElement(
            contextMenu.ContextMenuProvider,
            null,
            React.createElement(Observer),
            node,
          ),
        );
      }),
    rightClick: async (node: Element) =>
      React.act(() => {
        node.dispatchEvent(
          new dom.window.MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 8,
            clientY: 8,
          }),
        );
      }),
    close: async () => {
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("profile Ratings poster and label carry the same title as left-click without profile-owner permissions", async () => {
  const h = await fixture();
  try {
    const { RatingsCard } = componentLoader()("src/views/profile/ratings-card.tsx");
    const opens: unknown[][] = [];
    const rating = {
      itemKey: "tt1234567",
      mediaType: "series",
      title: "Fixture show",
      posterUrl: "https://fixture.invalid/rating.jpg",
      score: 8,
      at: 1,
    };
    await h.render(
      React.createElement(RatingsCard, {
        ratings: { count: 1, avg: 8, recent: [rating] },
        isOwner: false,
        onViewAll() {},
        onOpenMeta: (...args: unknown[]) => opens.push(args),
      }),
    );
    const poster = document.querySelector("img")!;
    await React.act(() => (poster.closest("button") as HTMLElement).click());
    assert.deepEqual(opens[0], [
      rating.itemKey,
      rating.mediaType,
      { name: rating.title, poster: rating.posterUrl },
    ]);
    await h.rightClick(poster);
    assert.equal(
      h.menu().state?.target.kind,
      "meta",
      "known ratings must not degrade to image-only context",
    );
    const target = h.menu().state!.target;
    if (target.kind !== "meta") throw new Error("Expected title target");
    assert.equal(target.meta.id, rating.itemKey);
    assert.equal(target.meta.type, "series");
    assert.equal(target.image?.src, rating.posterUrl);
    assert.equal(
      target.membership,
      undefined,
      "viewing another profile is not ownership of its lists",
    );
    assert.equal(target.extra, undefined);
    await React.act(() => dispatchKeyboardContextMenu(poster.closest("button") as HTMLElement));
    assert.equal(h.menu().state?.target.kind, "meta");
  } finally {
    await h.close();
  }
});

test("shared-list page posters retain their stable media identity", async () => {
  const h = await fixture();
  try {
    const { SharedListPosters } = componentLoader()(
      "src/views/shared-list/shared-list-posters.tsx",
    );
    await h.render(
      React.createElement(SharedListPosters, {
        items: [
          {
            id: "tt-shared",
            type: "tv",
            name: "Shared",
            poster: "https://fixture.invalid/shared.png",
          },
        ],
        onOpenMeta() {},
      }),
    );
    await h.rightClick(document.querySelector("img")!);
    const target = h.menu().state?.target;
    assert.equal(target?.kind, "meta");
    assert.equal(target?.kind === "meta" && target.meta.type, "series");
    assert.equal(target?.kind === "meta" && target.membership, undefined);
  } finally {
    await h.close();
  }
});

test("profile View all list posters keep title context inside their modal", async () => {
  const h = await fixture();
  try {
    const { ProfileViewAll } = componentLoader({
      "./profile-bits": { timeAgo: () => "" },
      "./recent-activity": { ACTIVITY_VERB: {}, ActivityGlyph: () => null },
    })("src/views/profile/profile-view-all.tsx");
    await h.render(
      React.createElement(ProfileViewAll, {
        section: "lists",
        lists: [
          {
            id: "owned-by-another",
            name: "Other list",
            items: [
              {
                id: "tt-viewall",
                type: "series",
                name: "View all",
                poster: "https://fixture.invalid/list.png",
              },
            ],
          },
        ],
        badges: [],
        activity: [],
        onOpenMeta() {},
        onClose() {},
      }),
    );
    await h.rightClick(document.querySelector("img")!);
    const target = h.menu().state?.target;
    assert.equal(target?.kind, "meta");
    assert.equal(target?.kind === "meta" && target.meta.id, "tt-viewall");
    assert.equal(target?.kind === "meta" && target.membership, undefined);
  } finally {
    await h.close();
  }
});

test("profile media IDs use the existing navigation type conventions", () => {
  const { profileMediaMeta } = componentLoader()("src/lib/social/profile-media-meta.ts");
  for (const [id, kind, expected] of [
    ["tt1", "movie", "movie"],
    ["tt2", "tv", "series"],
    ["mal:5", undefined, "series"],
    ["anilist:7", "anime", "series"],
    ["anilist:8", "manga", "manga"],
  ]) {
    assert.deepEqual(profileMediaMeta(id, kind, { name: "Title", poster: "poster" }), {
      id,
      type: expected,
      name: "Title",
      poster: "poster",
    });
  }
});

test("expanded public ratings bind both poster and title without changing the displayed user's rating", async () => {
  const h = await fixture();
  try {
    const { UserRatings } = componentLoader({
      "@/components/ratings/rating-stars": { RatingStars: () => null },
      "@/lib/social/ratings-api": {
        fetchUserRatings: async () => ({
          items: [
            {
              itemKey: "tt-public",
              mediaType: "series",
              title: "Public rating",
              posterUrl: "https://fixture.invalid/public.jpg",
              score: 7,
              at: 1,
            },
          ],
          counts: { total: 1, movie: 0, series: 1, anime: 0, manga: 0 },
        }),
      },
      "@/views/profile/profile-bits": { timeAgo: () => "" },
    })("src/views/ratings/user-ratings.tsx");
    await h.render(
      React.createElement(UserRatings, {
        handle: "someone-else",
        alias: "Other",
        onOpenMeta() {},
        onClose() {},
      }),
    );
    for (const targetNode of [
      document.querySelector("img")!,
      Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent === "Public rating",
      )!,
    ]) {
      await h.rightClick(targetNode);
      const target = h.menu().state?.target;
      assert.equal(target?.kind, "meta");
      assert.equal(target?.kind === "meta" && target.meta.id, "tt-public");
      assert.equal(target?.kind === "meta" && target.membership, undefined);
    }
  } finally {
    await h.close();
  }
});

test("profile My Lists posters use shared title semantics, preserve manga, and do not inherit another person's membership", async () => {
  const h = await fixture();
  try {
    const { MyListsShowcase } = componentLoader()("src/views/profile/my-lists-showcase.tsx");
    const items = [
      {
        id: "kitsu:345",
        type: "anime",
        name: "Anime fixture",
        poster: "https://fixture.invalid/anime.png",
      },
      {
        id: "manga:67",
        type: "manga",
        name: "Manga fixture",
        poster: "https://fixture.invalid/manga.png",
      },
    ];
    await h.render(
      React.createElement(MyListsShowcase, {
        lists: [{ id: "other-owner-list", name: "Other list", items }],
        handle: "other-owner",
        isOwner: false,
        signedIn: true,
        onOpenMeta() {},
      }),
    );
    for (const [index, img] of Array.from(document.querySelectorAll("img")).entries()) {
      await h.rightClick(img);
      const target = h.menu().state?.target;
      assert.equal(target?.kind, "meta");
      if (target?.kind !== "meta") throw new Error("Expected title target");
      assert.equal(target.meta.id, items[index].id);
      assert.equal(target.meta.type, index === 0 ? "series" : "manga");
      assert.equal(target.membership, undefined);
      assert.equal(target.image?.src, items[index].poster);
    }
  } finally {
    await h.close();
  }
});

test("Discover large card captures its title and backdrop while nested arrows stay independent", async () => {
  const h = await fixture();
  try {
    const load = componentLoader({
      "@/components/nav-arrow": {
        NavArrow: ({ label, onClick }: { label: string; onClick: () => void }) =>
          React.createElement("button", { onClick }, label),
      },
      "@/lib/logo": { peekCachedLogo: () => null, resolveLogo: async () => undefined },
      "@/lib/providers/tmdb": { useTmdbImdbId: () => undefined },
      "@/lib/use-reduced-motion": { useReducedMotion: () => true },
      "@/lib/settings": { useSettings: () => ({ settings: { tmdbKey: "" } }) },
      "@/lib/view": { useView: () => ({ openMeta() {} }) },
      "../meta-awards-corner": { MetaAwardsCorner: () => null },
      "./thumbs-dock": {
        ThumbsDock: () => React.createElement("button", null, "Independent rating"),
      },
      "./types": { FADE_MS: 180, upsizeTmdb: (src: string) => src },
    });
    const { BigCardStack } = load("src/components/featured-banner/big-card-stack.tsx");
    const items = [
      {
        id: "tt-first",
        type: "movie",
        name: "First",
        poster: "https://fixture.invalid/first-poster.jpg",
        background: "https://fixture.invalid/first-backdrop.jpg",
      },
      {
        id: "tt-next",
        type: "series",
        name: "Next",
        background: "https://fixture.invalid/next.jpg",
      },
    ];
    const render = (active: number) =>
      h.render(React.createElement(BigCardStack, { items, active, onPrev() {}, onNext() {} }));
    await render(0);
    await h.rightClick(document.querySelector("[role=button]")!);
    const first = h.menu().state!;
    assert.equal(first?.target.kind, "meta");
    if (first.target.kind !== "meta") throw new Error("Expected title target");
    assert.equal(first.target.meta.id, "tt-first");
    assert.equal(first.target.image?.src, items[0].background);
    await render(1);
    assert.equal(
      first.target.isValid?.() === false,
      false,
      "a slide change is not invalidation of the opened title/image snapshot",
    );
    assert.equal(h.menu().state!.target, first.target);
    for (const button of document.querySelectorAll("button")) {
      await h.rightClick(button);
      assert.equal(
        h.menu().state?.session,
        first.session,
        "independent controls must not open the outer title menu",
      );
    }
    await React.act(() =>
      dispatchKeyboardContextMenu(document.querySelector("[role=button]") as HTMLElement),
    );
    assert.equal(
      h.menu().state?.target.kind === "meta" && h.menu().state!.target.meta.id,
      "tt-next",
    );
  } finally {
    await h.close();
  }
});

test("Discover stills keep the exact clicked image and title snapshot across carousel changes", async () => {
  const h = await fixture();
  try {
    let resolveNext!: (urls: string[]) => void;
    const load = componentLoader({
      "@/lib/feed/tags": { pickRandom: (urls: string[]) => urls.slice(0, 4) },
      "@/lib/providers/tmdb": {
        tmdbMovieImages: (_key: string, id: string) =>
          id === "tt-first"
            ? Promise.resolve([1, 2, 3, 4].map((n) => `https://fixture.invalid/still-${n}.jpg`))
            : new Promise<string[]>((resolve) => {
                resolveNext = resolve;
              }),
      },
      "@/lib/settings": { useSettings: () => ({ settings: { tmdbKey: "fixture-only" } }) },
      "@/lib/use-localized-overview": { useLocalizedOverview: () => "" },
      "@/lib/live-imdb": { useLiveImdbRating: () => ({ value: null }) },
      "../icons/imdb-icon": { ImdbIcon: () => null },
    });
    const { SidePanel } = load("src/components/featured-banner/side-panel.tsx");
    const first = {
      id: "tt-first",
      type: "movie",
      name: "First",
      background: "https://fixture.invalid/backdrop.jpg",
    };
    let lightbox: unknown;
    const render = (meta = first) =>
      h.render(
        React.createElement(SidePanel, {
          meta,
          activeIndex: 0,
          total: 2,
          onOpenLightbox: (state: unknown) => {
            lightbox = state;
          },
        }),
      );
    await render();
    const buttons = Array.from(document.querySelectorAll("button"));
    assert.equal(buttons.length, 4);
    for (const [index, button] of buttons.entries()) {
      await React.act(() => button.click());
      assert.equal(
        (lightbox as { startIndex: number }).startIndex,
        index,
        "ordinary click retains the existing lightbox workflow",
      );
      await h.rightClick(button.querySelector("div[aria-hidden]")!);
      const target = h.menu().state?.target;
      assert.equal(target?.kind, "meta");
      if (target?.kind !== "meta") throw new Error("Expected title target");
      assert.equal(target.meta.id, first.id);
      assert.equal(target.image?.src, `https://fixture.invalid/still-${index + 1}.jpg`);
    }
    const captured = h.menu().state!.target;
    await render({
      ...first,
      id: "tt-next",
      name: "Next",
      background: "https://fixture.invalid/next.jpg",
    });
    assert.equal(captured.isValid?.() === false, false);
    assert.equal(captured.image?.src, "https://fixture.invalid/still-4.jpg");
    assert.equal(
      document.querySelector("img")?.src,
      "https://fixture.invalid/next.jpg",
      "old-title stills must not be paired with the new title while its request is pending",
    );
    await React.act(async () => {
      resolveNext(["https://fixture.invalid/next-still.jpg"]);
    });
  } finally {
    await h.close();
  }
});

function criticsLoader(
  options: {
    images?: (key: string, id: string) => Promise<string[]>;
    openMeta?: (meta: unknown) => void;
    openPerson?: (id: number) => void;
  } = {},
) {
  const settings = { tmdbKey: "fixture-only", rpdbKey: "", showRtBadge: false };
  return componentLoader({
    "@/components/icons/play-filled": { Play: () => null },
    "@/lib/cinemeta": { narrowMediaType: (type: string) => type },
    "@/lib/feed/tags": { pickRandom: (urls: string[]) => urls.slice(0, 4) },
    "@/lib/imdb-rating": { useImdbRating: () => undefined },
    "@/lib/logo": { peekCachedLogo: () => null, resolveLogo: async () => undefined },
    "@/lib/providers/omdb": { useOmdbScores: () => null },
    "@/lib/providers/rpdb": {
      rpdbPoster: (_key: string, id: string) => `https://fixture.invalid/provider-${id}.jpg`,
    },
    "@/lib/providers/tmdb": {
      useTmdbImdbId: () => undefined,
      tmdbMovieImages:
        options.images ??
        (async () => [1, 2, 3, 4].map((n) => `https://fixture.invalid/critic-still-${n}.jpg`)),
      tmdbCriticData: async () => ({
        cast: [{ id: 42, name: "Fixture performer" }],
        crew: [],
        director: { id: 43, name: "Fixture director" },
        genres: [],
        reviews: [],
      }),
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/view": {
      useView: () => ({
        openMeta: options.openMeta ?? (() => {}),
        openPerson: options.openPerson ?? (() => {}),
        openPicker() {},
      }),
    },
    "@/lib/window": { openUrl() {} },
    "./critics-pick/cast-chip": {
      CastChip: ({ member, onClick }: { member: { name: string }; onClick: () => void }) =>
        React.createElement("button", { onClick }, member.name),
    },
    "./critics-pick/linked-review": { LinkedReview: ({ text }: { text: string }) => text },
    "./critics-pick/overview-modal": { OverviewModal: () => null },
    "./critics-pick/lightbox": {
      Lightbox: (props: { images: string[]; startIndex: number; onClose: () => void }) =>
        React.createElement(
          "button",
          { "data-lightbox-image": props.images[props.startIndex], onClick: props.onClose },
          "Close fixture lightbox",
        ),
    },
    "./critics-pick/utils": {
      excerptReview: (text: string) => text,
      upsizeTmdb: (src: string) => src,
    },
    "./icons/imdb-icon": { ImdbIcon: () => null },
    "./meta-awards-corner": { MetaAwardsCorner: () => null },
    "./poster": { Poster: () => null },
    "./rt-badge": { RtBadge: () => null },
  });
}

test("Critics main image, overlay and title resolve its own title and displayed provider artwork", async () => {
  const h = await fixture();
  try {
    const opens: unknown[] = [];
    const { CriticsPick } = criticsLoader({ openMeta: (meta) => opens.push(meta) })(
      "src/components/critics-pick.tsx",
    );
    const meta = {
      id: "tt-critic",
      type: "movie",
      name: "Critic fixture",
      background: "https://fixture.invalid/critic-backdrop.jpg",
    };
    await h.render(React.createElement(CriticsPick, { meta }));
    const main = document.querySelector("section > div > button") as HTMLButtonElement;
    assert.ok(main);
    await React.act(() => main.click());
    assert.equal((opens[0] as typeof meta).id, meta.id);
    for (const node of [
      main,
      main.querySelector("img")!,
      main.querySelector("[aria-hidden]")!,
      main.querySelector("h3")!,
    ]) {
      await h.rightClick(node);
      const target = h.menu().state?.target;
      assert.equal(target?.kind, "meta");
      if (target?.kind !== "meta") throw new Error("Expected Critics title");
      assert.equal(target.meta.id, meta.id);
      assert.equal(target.meta.type, meta.type);
      assert.equal(target.image?.src, "https://fixture.invalid/provider-tt-critic.jpg");
      assert.equal(target.membership, undefined);
      assert.equal(opens.length, 1, "right click must not activate the left-click command");
    }
    await React.act(() => dispatchKeyboardContextMenu(main));
    assert.equal(h.menu().state?.target.kind, "meta");
    const session = h.menu().state?.session;
    const person = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Fixture performer",
    )!;
    await h.rightClick(person);
    assert.equal(h.menu().state?.session, session, "cast controls must not inherit title context");
  } finally {
    await h.close();
  }
});

test("Critics supporting stills preserve each image and ordinary lightbox index", async () => {
  const h = await fixture();
  try {
    const { CriticsPick } = criticsLoader()("src/components/critics-pick.tsx");
    await h.render(
      React.createElement(CriticsPick, {
        meta: { id: "tt-critic", type: "movie", name: "Critic fixture" },
      }),
    );
    const stills = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[aria-label^='Expand']"),
    );
    assert.equal(stills.length, 4);
    for (const [index, still] of stills.entries()) {
      const src = `https://fixture.invalid/critic-still-${index + 1}.jpg`;
      await React.act(() => still.click());
      const lightbox = document.querySelector<HTMLButtonElement>("[data-lightbox-image]")!;
      assert.equal(lightbox.dataset.lightboxImage, src);
      await React.act(() => lightbox.click());
      for (const node of [still.querySelector("img")!, still.querySelector("[aria-hidden]")!]) {
        await h.rightClick(node);
        const target = h.menu().state?.target;
        assert.equal(target?.kind, "meta");
        if (target?.kind !== "meta") throw new Error("Expected Critics title");
        assert.equal(target.meta.id, "tt-critic");
        assert.equal(target.image?.src, src);
      }
      await React.act(() => dispatchKeyboardContextMenu(still));
      assert.equal(h.menu().state?.target.image?.src, src);
    }
  } finally {
    await h.close();
  }
});

test("Critics still requests cannot pair old artwork with a changed title or media type", async () => {
  const h = await fixture();
  try {
    const requests: Array<{ id: string; resolve: (images: string[]) => void }> = [];
    const { CriticsPick } = criticsLoader({
      images: (_key, id) => new Promise((resolve) => requests.push({ id, resolve })),
    })("src/components/critics-pick.tsx");
    const render = (id: string, type: string) =>
      h.render(
        React.createElement(CriticsPick, {
          meta: { id, type, name: id, background: `https://fixture.invalid/${id}-${type}.jpg` },
        }),
      );
    const stillImage = () =>
      document.querySelector<HTMLImageElement>("button[aria-label^='Expand'] img")!;
    await render("tt-first", "movie");
    await React.act(async () => requests[0].resolve(["https://fixture.invalid/loaded-first.jpg"]));
    assert.equal(stillImage().src, "https://fixture.invalid/loaded-first.jpg");
    await h.rightClick(stillImage());
    const captured = h.menu().state?.target;
    await render("tt-second", "movie");
    assert.equal(stillImage().src, "https://fixture.invalid/tt-second-movie.jpg");
    await render("tt-second", "series");
    assert.equal(stillImage().src, "https://fixture.invalid/tt-second-series.jpg");
    assert.equal(
      requests.length,
      3,
      "media type changes must invalidate the pending still request",
    );
    await React.act(async () => requests[1].resolve(["https://fixture.invalid/stale-movie.jpg"]));
    assert.equal(stillImage().src, "https://fixture.invalid/tt-second-series.jpg");
    await React.act(async () =>
      requests[2].resolve(["https://fixture.invalid/current-series.jpg"]),
    );
    assert.equal(stillImage().src, "https://fixture.invalid/current-series.jpg");
    assert.equal(captured?.image?.src, "https://fixture.invalid/loaded-first.jpg");
    assert.equal(
      h.menu().state?.target,
      captured,
      "a redraw preserves the opened semantic snapshot",
    );
  } finally {
    await h.close();
  }
});
