import { selectSpotlights, type Spotlight } from "@/lib/feed/genre-spotlights";
import { GENRE_TOPICS, type Topic } from "@/lib/feed/genre-topics";
import { GENRE_MOVIE_TO_TV, GENRE_TV_TO_MOVIE, MOVIE_GENRES } from "@/lib/feed/tags";
import type { MetaFilter } from "@/lib/view";
import { languageRails } from "./language-rails";

export type StandardRail = {
  kind: "standard";
  id: string;
  title: string;
  kicker: string;
  params: Record<string, string>;
  mediaType?: "movie" | "tv";
  noDedup?: boolean;
};

export type SpotlightRail = {
  kind: "spotlight";
  id: string;
  spotlight: Spotlight;
  genreId: number;
};

export type TopicRail = {
  kind: "topic";
  id: string;
  topic: Topic;
  mediaType: "movie" | "tv";
};

export type AnyRail = StandardRail | SpotlightRail | TopicRail;

export function runtimeRange(value: number): { lo: number; hi: number } {
  if (value <= 80) return { lo: 60, hi: 90 };
  if (value <= 110) return { lo: 80, hi: 120 };
  if (value <= 140) return { lo: 110, hi: 150 };
  if (value <= 180) return { lo: 140, hi: 200 };
  return { lo: 180, hi: 360 };
}

export function railsForFilter(f: MetaFilter): AnyRail[] {
  if (f.kind === "year") {
    const y = String(f.value);
    return [
      {
        kind: "standard",
        id: "trending",
        title: "Most popular",
        kicker: "What people watched most",
        params: {
          [f.mediaType === "movie" ? "primary_release_year" : "first_air_date_year"]: y,
          sort_by: "popularity.desc",
          "vote_count.gte": "50",
        },
      },
      {
        kind: "standard",
        id: "top",
        title: "Highest rated",
        kicker: "Critics + audiences",
        params: {
          [f.mediaType === "movie" ? "primary_release_year" : "first_air_date_year"]: y,
          sort_by: "vote_average.desc",
          "vote_count.gte": "300",
        },
      },
      {
        kind: "standard",
        id: "gems",
        title: "Hidden gems",
        kicker: "Loved, just not loud about it",
        params: {
          [f.mediaType === "movie" ? "primary_release_year" : "first_air_date_year"]: y,
          sort_by: "vote_average.desc",
          "vote_count.gte": "60",
          "vote_count.lte": "1500",
          "vote_average.gte": "7",
        },
      },
    ];
  }
  if (f.kind === "runtime") {
    const r = runtimeRange(f.value);
    return [
      {
        kind: "standard",
        id: "popular",
        title: "Popular",
        kicker: "What people are watching",
        params: {
          "with_runtime.gte": String(r.lo),
          "with_runtime.lte": String(r.hi),
          sort_by: "popularity.desc",
          "vote_count.gte": "200",
        },
      },
      {
        kind: "standard",
        id: "rated",
        title: "Highest rated",
        kicker: "Time well spent",
        params: {
          "with_runtime.gte": String(r.lo),
          "with_runtime.lte": String(r.hi),
          sort_by: "vote_average.desc",
          "vote_count.gte": "500",
        },
      },
      {
        kind: "standard",
        id: "recent",
        title: "Recent picks",
        kicker: "Last few years",
        params: {
          "with_runtime.gte": String(r.lo),
          "with_runtime.lte": String(r.hi),
          [f.mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte"]:
            "2020-01-01",
          sort_by: "popularity.desc",
          "vote_count.gte": "200",
        },
      },
    ];
  }
  if (f.kind === "studio") {
    const id = String(f.id);
    return [
      {
        kind: "standard",
        id: "popular",
        title: "Most popular",
        kicker: `Biggest hits from ${f.name}`,
        params: { with_companies: id, sort_by: "popularity.desc", "vote_count.gte": "100" },
      },
      {
        kind: "standard",
        id: "rated",
        title: "Highest rated",
        kicker: `Critic and audience favorites`,
        params: { with_companies: id, sort_by: "vote_average.desc", "vote_count.gte": "500" },
      },
      {
        kind: "standard",
        id: "recent",
        title: "Recent releases",
        kicker: "Fresh from the studio",
        params: {
          with_companies: id,
          [f.mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte"]:
            "2020-01-01",
          sort_by: "popularity.desc",
          "vote_count.gte": "30",
        },
      },
      {
        kind: "standard",
        id: "gems",
        title: "Hidden gems",
        kicker: "Loved, just quieter",
        params: {
          with_companies: id,
          sort_by: "vote_average.desc",
          "vote_count.gte": "80",
          "vote_count.lte": "1500",
          "vote_average.gte": "7",
        },
      },
    ];
  }
  if (f.kind === "country") {
    return [
      {
        kind: "standard",
        id: "popular",
        title: "Most popular",
        kicker: `From ${f.name}`,
        params: {
          with_origin_country: f.iso,
          sort_by: "popularity.desc",
          "vote_count.gte": "100",
        },
      },
      {
        kind: "standard",
        id: "rated",
        title: "Highest rated",
        kicker: "Acclaimed across critics and audiences",
        params: {
          with_origin_country: f.iso,
          sort_by: "vote_average.desc",
          "vote_count.gte": "500",
        },
      },
      {
        kind: "standard",
        id: "gems",
        title: "Hidden gems",
        kicker: "Smaller releases worth surfacing",
        params: {
          with_origin_country: f.iso,
          sort_by: "vote_average.desc",
          "vote_count.gte": "60",
          "vote_count.lte": "1500",
          "vote_average.gte": "7",
        },
      },
    ];
  }
  if (f.kind === "language") {
    return languageRails(f.iso, f.name);
  }
  if (f.kind === "network") {
    const id = String(f.id);
    return [
      {
        kind: "standard",
        id: "popular",
        title: "Most popular",
        kicker: `On ${f.name}`,
        params: { with_networks: id, sort_by: "popularity.desc", "vote_count.gte": "50" },
      },
      {
        kind: "standard",
        id: "rated",
        title: "Highest rated",
        kicker: "Network's best",
        params: { with_networks: id, sort_by: "vote_average.desc", "vote_count.gte": "200" },
      },
      {
        kind: "standard",
        id: "recent",
        title: "Currently airing",
        kicker: "What's new on the network",
        params: {
          with_networks: id,
          "first_air_date.gte": new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          sort_by: "popularity.desc",
          "vote_count.gte": "10",
        },
      },
    ];
  }

  const g = String(f.id);
  const spotlights = selectSpotlights(f.name);
  const dateField = f.mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const docId = MOVIE_GENRES.Documentary;
  const isDoc = f.id === docId;
  const vc = (n: number) => String(isDoc ? Math.max(10, Math.round(n * 0.2)) : n);
  const interleavable: AnyRail[] = [];

  interleavable.push({
    kind: "standard",
    id: "trending",
    title: `Trending in ${f.name}`,
    kicker: "What's hot right now",
    params: { with_genres: g, sort_by: "popularity.desc", "vote_count.gte": vc(50) },
  });
  interleavable.push({
    kind: "standard",
    id: "top",
    title: `Top Rated ${f.name}`,
    kicker: "All-time bests",
    params: { with_genres: g, sort_by: "vote_average.desc", "vote_count.gte": vc(400) },
  });

  for (let i = 0; i < spotlights.length; i++) {
    interleavable.push({
      kind: "spotlight",
      id: `spotlight-${i}-${spotlights[i].name}`,
      spotlight: spotlights[i],
      genreId: f.id,
    });
  }

  interleavable.push({
    kind: "standard",
    id: "recent",
    title: `Recent ${f.name}`,
    kicker: "Last 5 years",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: fiveYearsAgo,
      sort_by: "popularity.desc",
      "vote_count.gte": vc(150),
    },
  });

  const companionId = f.mediaType === "movie" ? GENRE_MOVIE_TO_TV[f.id] : GENRE_TV_TO_MOVIE[f.id];
  if (companionId) {
    const companionType: "movie" | "tv" = f.mediaType === "movie" ? "tv" : "movie";
    const word = companionType === "tv" ? "Series" : "Movies";
    const cg = String(companionId);
    const companionDate = companionType === "movie" ? "primary_release_date" : "first_air_date";
    interleavable.push({
      kind: "standard",
      id: "companion-trending",
      mediaType: companionType,
      title: `Trending ${f.name} ${word}`,
      kicker: "What's hot right now",
      params: { with_genres: cg, sort_by: "popularity.desc", "vote_count.gte": vc(40) },
    });
    interleavable.push({
      kind: "standard",
      id: "companion-top",
      mediaType: companionType,
      title: `Top Rated ${f.name} ${word}`,
      kicker: "Critics + audiences",
      params: { with_genres: cg, sort_by: "vote_average.desc", "vote_count.gte": vc(200) },
    });
    interleavable.push({
      kind: "standard",
      id: "companion-recent",
      mediaType: companionType,
      title: `Recent ${f.name} ${word}`,
      kicker: "Last 5 years",
      params: {
        with_genres: cg,
        [`${companionDate}.gte`]: fiveYearsAgo,
        sort_by: "popularity.desc",
        "vote_count.gte": vc(80),
      },
    });
  }

  if (f.mediaType === "movie" && f.id !== docId) {
    interleavable.push({
      kind: "standard",
      id: "documentaries",
      title: `${f.name} Documentaries`,
      kicker: "True stories",
      params: {
        with_genres: `${g},${docId}`,
        sort_by: "vote_average.desc",
        "vote_count.gte": "10",
      },
    });
  }

  const topics = GENRE_TOPICS[f.name] ?? [];
  for (const topic of topics) {
    if (topic.mediaType && topic.mediaType !== f.mediaType) continue;
    interleavable.push({
      kind: "topic",
      id: `topic-${topic.id}`,
      topic,
      mediaType: f.mediaType,
    });
  }

  interleavable.push({
    kind: "standard",
    id: "decade-2010s",
    title: `The 2010s in ${f.name}`,
    kicker: "Defining moments",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "2010-01-01",
      [`${dateField}.lte`]: "2019-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(300),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-2000s",
    title: `2000s ${f.name}`,
    kicker: "Millennium picks",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "2000-01-01",
      [`${dateField}.lte`]: "2009-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(250),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-90s",
    title: `90s ${f.name}`,
    kicker: "VHS-era classics",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "1990-01-01",
      [`${dateField}.lte`]: "1999-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(200),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-80s",
    title: `80s ${f.name}`,
    kicker: "Golden-era cuts",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "1980-01-01",
      [`${dateField}.lte`]: "1989-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(150),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-70s",
    title: `70s ${f.name}`,
    kicker: "New Hollywood",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "1970-01-01",
      [`${dateField}.lte`]: "1979-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(100),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-60s",
    title: `60s ${f.name}`,
    kicker: "Golden Years",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "1960-01-01",
      [`${dateField}.lte`]: "1969-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(50),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-50s",
    title: `Best of the 50s ${f.name}`,
    kicker: "Classic Hollywood",
    params: {
      with_genres: g,
      [`${dateField}.gte`]: "1950-01-01",
      [`${dateField}.lte`]: "1959-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(30),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "decade-pre50",
    title: `Pre-1950 ${f.name}`,
    kicker: "The originals",
    params: {
      with_genres: g,
      [`${dateField}.lte`]: "1949-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(20),
    },
  });

  interleavable.push({
    kind: "standard",
    id: "gems",
    title: `Hidden ${f.name} Gems`,
    kicker: "Quiet favorites",
    noDedup: true,
    params: {
      with_genres: g,
      sort_by: "vote_average.desc",
      "vote_count.gte": vc(40),
      "vote_count.lte": "2500",
      "vote_average.gte": "6.5",
    },
  });

  interleavable.push({
    kind: "standard",
    id: "international",
    title: `International ${f.name}`,
    kicker: "Beyond Hollywood",
    noDedup: true,
    params: {
      with_genres: g,
      with_original_language: "fr|ja|ko|es|it|de|zh|ru|hi|pt|sv|da|no|fi|pl|tr",
      sort_by: "vote_average.desc",
      "vote_count.gte": "30",
    },
  });

  interleavable.push({
    kind: "standard",
    id: "japanese",
    title: `Japanese ${f.name}`,
    kicker: "From Japan",
    noDedup: true,
    params: {
      with_genres: g,
      with_original_language: "ja",
      sort_by: "popularity.desc",
    },
  });

  interleavable.push({
    kind: "standard",
    id: "korean",
    title: `Korean ${f.name}`,
    kicker: "From Korea",
    noDedup: true,
    params: {
      with_genres: g,
      with_original_language: "ko",
      sort_by: "popularity.desc",
    },
  });

  return interleavable;
}
