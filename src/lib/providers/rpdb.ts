let posterBase = "";

export function setPosterBaseUrl(url: string): void {
  posterBase = url.trim().replace(/\/+$/, "");
}

type ParsedId = {
  imdb?: string;
  tmdbId?: string;
  tvdbId?: string;
  mediaType: "movie" | "series";
};

function parseMetaId(metaId: string): ParsedId | undefined {
  if (!metaId) return undefined;
  if (metaId.startsWith("tt")) return { imdb: metaId, mediaType: "movie" };
  const tmdb = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (tmdb) {
    return { tmdbId: tmdb[2], mediaType: tmdb[1] === "tv" ? "series" : "movie" };
  }
  const tvdb = metaId.match(/^tvdb:(\d+)$/);
  if (tvdb) {
    return { tvdbId: tvdb[1], mediaType: "series" };
  }
  return undefined;
}

function fillTemplate(template: string, id: ParsedId): string | undefined {
  const idToken = id.imdb ?? (id.tmdbId ? `${id.mediaType}-${id.tmdbId}` : undefined);
  if (!idToken) return undefined;
  let out = template;
  const sub = (token: string, value: string | undefined): boolean => {
    if (!out.includes(token)) return true;
    if (!value) return false;
    out = out.split(token).join(value);
    return true;
  };
  if (!sub("{imdbId}", id.imdb)) return undefined;
  if (!sub("{imdb_id}", id.imdb)) return undefined;
  if (!sub("{tmdbId}", id.tmdbId)) return undefined;
  if (!sub("{tmdb_id}", id.tmdbId)) return undefined;
  sub("{type}", id.mediaType);
  sub("{mediaType}", id.mediaType);
  if (!sub("{id}", idToken)) return undefined;
  return out;
}

function rpdbPath(base: string, key: string, id: ParsedId): string | undefined {
  if (!key) return undefined;
  const keySeg = key;
  if (id.imdb) {
    return `${base}/${keySeg}/imdb/poster-default/${id.imdb}.jpg?fallback=true`;
  }
  if (id.tmdbId) {
    return `${base}/${keySeg}/tmdb/poster-default/${id.mediaType}-${id.tmdbId}.jpg?fallback=true`;
  }
  if (id.tvdbId) {
    return `${base}/${keySeg}/tvdb/poster-default/series-${id.tvdbId}.jpg?fallback=true`;
  }
  return undefined;
}

function betterPostersPath(base: string, id: ParsedId): string | undefined {
  if (!id.imdb) return undefined;
  return `${base}/poster/imdb/poster-default/${id.imdb}.jpg`;
}

function postersPlusPath(base: string, id: ParsedId): string | undefined {
  if (!id.imdb || !id.tmdbId) return undefined;
  const root = base.replace(/\/poster$/i, "");
  const type = id.mediaType === "series" ? "series" : "movie";
  return `${root}/poster?tmdb_id=${id.tmdbId}&imdb_id=${id.imdb}&type=${type}`;
}

function mergeAlt(id: ParsedId, altId?: string): ParsedId {
  if (!altId) return id;
  const other = parseMetaId(altId);
  if (!other) return id;
  const typed = id.tmdbId ? id : other.tmdbId ? other : id;
  return {
    imdb: id.imdb ?? other.imdb,
    tmdbId: id.tmdbId ?? other.tmdbId,
    tvdbId: id.tvdbId ?? other.tvdbId,
    mediaType: typed.mediaType,
  };
}

export function rpdbPoster(
  key: string,
  metaId: string,
  fallback?: string,
  altId?: string,
): string | undefined {
  const parsed = parseMetaId(metaId);
  if (!parsed) return fallback;
  const id = mergeAlt(parsed, altId);

  if (posterBase.includes("{")) {
    return fillTemplate(posterBase, id) ?? fallback;
  }

  if (!posterBase) {
    if (!key) return fallback;
    return rpdbPath("https://api.ratingposterdb.com", key, id) ?? fallback;
  }

  const host = posterBase.toLowerCase();
  if (host.includes("ratingposterdb.com")) {
    return rpdbPath(posterBase, key, id) ?? fallback;
  }
  if (host.includes("btttr.cc")) {
    return betterPostersPath(posterBase, id) ?? fallback;
  }
  if (host.includes("postersplus") || host.includes("elfhosted")) {
    return postersPlusPath(posterBase, id) ?? fallback;
  }

  if (key) return rpdbPath(posterBase, key, id) ?? fallback;
  return fallback;
}

export function needsImdbForPoster(key: string, metaId: string): boolean {
  if (rpdbPoster(key, metaId)) return false;
  if (!posterBase && !key) return false;
  return /^tmdb:(movie|tv):\d+$/.test(metaId);
}

export function needsTmdbForPoster(key: string, metaId: string): boolean {
  if (rpdbPoster(key, metaId)) return false;
  if (!posterBase) return false;
  return typeof metaId === "string" && metaId.startsWith("tt");
}
