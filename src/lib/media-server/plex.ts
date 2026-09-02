import { mediaServerToken } from "./connections";
import { mediaServerRequest, normalizeServerOrigin } from "./transport";
import type {
  AuthResult,
  MediaIdentity,
  MediaServerAdapter,
  MediaServerConnection,
  MediaServerItem,
  MediaServerLibrary,
  MediaServerPlayback,
  MediaServerProgress,
  SyncPage,
} from "./types";
import type { MediaServerPlaybackRequest } from "./types";
import { qualityPreset, versionFitsQuality } from "./quality";
import { parseEpisodeSpan } from "@/lib/episode-span";

type PlexNode = Record<string, any>;
const epochMs = (value: unknown) => (typeof value === "number" ? value * 1000 : undefined);

function guidIdentity(raw: PlexNode): MediaIdentity {
  const ids = (
    raw.type === "episode" && raw.grandparentGuid ? [{ id: raw.grandparentGuid }] : (raw.Guid ?? [])
  ).map((entry: PlexNode) => String(entry.id ?? ""));
  const pick = (scheme: string) =>
    ids.find((id: string) => id.startsWith(`${scheme}://`))?.slice(scheme.length + 3);
  const tmdb = Number(pick("tmdb"));
  const tvdb = Number(pick("tvdb"));
  return {
    tmdbId: Number.isFinite(tmdb) && tmdb > 0 ? tmdb : undefined,
    imdbId: pick("imdb") || undefined,
    tvdbId: Number.isFinite(tvdb) && tvdb > 0 ? tvdb : undefined,
    season: raw.type === "episode" ? raw.parentIndex : undefined,
    episode: raw.type === "episode" ? raw.index : undefined,
  };
}

function normalizePlexItem(
  connectionId: string,
  library: MediaServerLibrary,
  raw: PlexNode,
): MediaServerItem | null {
  const kinds: Record<string, MediaServerItem["kind"]> = {
    movie: "movie",
    show: "series",
    season: "season",
    episode: "episode",
  };
  const kind = kinds[raw.type];
  if (!kind || raw.ratingKey == null) return null;
  const versions = (raw.Media ?? []).flatMap((media: PlexNode) =>
    (media.Part ?? []).map((part: PlexNode) => {
      const filename =
        String(part.file ?? "")
          .split(/[\\/]/)
          .pop() || undefined;
      const span = parseEpisodeSpan(filename ?? "");
      return {
        id: String(part.key),
        name: media.title ?? filename,
        filename,
        season: span?.season,
        episode: span?.episode,
        episodeEnd: span?.episodeEnd,
        container: media.container ?? part.container,
        videoCodec: media.videoCodec,
        audioCodec: media.audioCodec,
        width: media.width,
        height: media.height,
        videoProfile: media.videoProfile,
        hdr:
          media.videoDynamicRange && media.videoDynamicRange !== "SDR"
            ? media.videoDynamicRange
            : undefined,
        dolbyVisionProfile: /dolby.?vision|dovi/i.test(
          `${media.videoDynamicRange ?? ""} ${media.videoProfile ?? ""}`,
        )
          ? (media.videoProfile ?? media.videoDynamicRange)
          : undefined,
        audioProfile: media.audioProfile,
        atmos: /atmos/i.test(`${media.audioProfile ?? ""} ${media.audioCodec ?? ""}`),
        channels: media.audioChannels,
        resolution: media.videoResolution
          ? `${media.videoResolution}${media.videoResolution === "4k" ? "" : "p"}`
          : undefined,
        bitrateKbps: media.bitrate,
        sizeBytes: part.size,
        edition: media.editionTitle ?? raw.editionTitle,
        runtimeMs: media.duration ?? raw.duration,
        directPlayable: true,
        subtitles: (part.Stream ?? [])
          .filter(
            (stream: PlexNode) =>
              (Number(stream.streamType) === 3 || stream.type === "subtitle") && !!stream.key,
          )
          .map((stream: PlexNode) => ({
            id: String(stream.id ?? stream.index),
            language: stream.languageCode ?? stream.language,
            title: stream.title ?? stream.displayTitle,
            url: String(stream.key),
            index: stream.index,
            codec: stream.codec,
          })),
      };
    }),
  );
  return {
    id: String(raw.ratingKey),
    connectionId,
    libraryId: library.id,
    libraryName: library.name,
    parentId:
      kind === "episode"
        ? raw.grandparentRatingKey != null
          ? String(raw.grandparentRatingKey)
          : undefined
        : raw.parentRatingKey != null
          ? String(raw.parentRatingKey)
          : undefined,
    kind,
    title: raw.title ?? "Untitled",
    year: raw.year,
    identity: guidIdentity(raw),
    versions,
    progress:
      raw.viewOffset != null || raw.viewCount
        ? {
            positionMs: raw.viewOffset ?? 0,
            durationMs: raw.duration,
            played: (raw.viewCount ?? 0) > 0,
            updatedAt: epochMs(raw.lastViewedAt) ?? Date.now(),
          }
        : undefined,
    addedAt: epochMs(raw.addedAt),
    updatedAt: epochMs(raw.updatedAt) ?? Date.now(),
  };
}

export class PlexAdapter implements MediaServerAdapter {
  readonly provider = "plex" as const;
  constructor(private origin: string) {
    this.origin = normalizeServerOrigin(origin);
  }
  private headers(connection?: MediaServerConnection, token?: string) {
    const auth = token ?? (connection ? mediaServerToken(connection) : null);
    return {
      Accept: "application/json",
      "X-Plex-Product": "Harbor",
      "X-Plex-Client-Identifier": "harbor",
      "X-Plex-Version": "1",
      ...(auth ? { "X-Plex-Token": auth } : {}),
    };
  }
  async authenticate(input: Record<string, string>): Promise<AuthResult> {
    if (!input.token) throw new Error("Complete Plex PIN authorization before connecting");
    const r = await mediaServerRequest<any>(this.origin, "/", {
      headers: this.headers(undefined, input.token),
    });
    return {
      userId: input.userId ?? "plex",
      userName: r.body?.MediaContainer?.friendlyName ?? "Plex",
      token: input.token,
    };
  }
  async libraries(connection: MediaServerConnection): Promise<MediaServerLibrary[]> {
    const r = await mediaServerRequest<any>(connection.origin, "/library/sections", {
      headers: this.headers(connection),
    });
    return (r.body?.MediaContainer?.Directory ?? [])
      .filter((x: any) => x.type === "movie" || x.type === "show")
      .map((x: any) => ({
        id: String(x.key),
        connectionId: connection.id,
        name: x.title,
        kind: x.type === "show" ? "series" : "movie",
        enabled: true,
      }));
  }
  async synchronize(
    connection: MediaServerConnection,
    library: MediaServerLibrary,
    cursor?: string,
  ): Promise<SyncPage> {
    const stages = library.kind === "series" ? [2, 3, 4] : [1];
    const [rawType, rawStart] = cursor?.includes(":")
      ? cursor.split(":")
      : [String(stages[0]), cursor ?? "0"];
    const plexType = Number(rawType);
    const start = Number(rawStart);
    const size = 200;
    const r = await mediaServerRequest<PlexNode>(
      connection.origin,
      `/library/sections/${encodeURIComponent(library.id)}/all?includeGuids=1&includeMedia=1&includeExternalMedia=1&type=${plexType}`,
      {
        headers: {
          ...this.headers(connection),
          "X-Plex-Container-Start": String(start),
          "X-Plex-Container-Size": String(size),
        },
      },
    );
    const container = r.body?.MediaContainer ?? {};
    const raw: PlexNode[] = container.Metadata ?? [];
    const total = Number(container.totalSize ?? container.size ?? raw.length);
    const stageIndex = stages.indexOf(plexType);
    const next =
      start + raw.length < total
        ? `${plexType}:${start + raw.length}`
        : stageIndex >= 0 && stageIndex + 1 < stages.length
          ? `${stages[stageIndex + 1]}:0`
          : undefined;
    return {
      items: raw
        .map((entry) => normalizePlexItem(connection.id, library, entry))
        .filter((entry): entry is MediaServerItem => !!entry),
      cursor: next,
      processed: Math.min(total, start + raw.length),
      total,
    };
  }
  async lookup(
    connection: MediaServerConnection,
    identity: MediaIdentity,
  ): Promise<MediaServerItem[]> {
    const libraries = await this.libraries(connection);
    const out: MediaServerItem[] = [];
    for (const library of libraries) {
      let cursor: string | undefined;
      do {
        const page = await this.synchronize(connection, library, cursor);
        out.push(...page.items);
        cursor = page.cursor;
      } while (cursor);
    }
    return out
      .filter(
        (item) =>
          (identity.tmdbId != null && identity.tmdbId === item.identity.tmdbId) ||
          (!!identity.imdbId && identity.imdbId === item.identity.imdbId) ||
          (identity.tvdbId != null && identity.tvdbId === item.identity.tvdbId),
      )
      .filter(
        (item) =>
          identity.season == null ||
          (identity.season === item.identity.season && identity.episode === item.identity.episode),
      );
  }
  async playback(
    connection: MediaServerConnection,
    item: MediaServerItem,
    request: MediaServerPlaybackRequest,
  ): Promise<MediaServerPlayback> {
    const versionId = request.versionId;
    let versions = item.versions;
    const cachedVersion = versions.find((entry) => entry.id === versionId) ?? versions[0];
    if (!cachedVersion?.subtitles?.length) {
      try {
        const response = await mediaServerRequest<PlexNode>(
          connection.origin,
          `/library/metadata/${encodeURIComponent(item.id)}?includeGuids=1&includeMedia=1&includeExternalMedia=1`,
          { headers: this.headers(connection) },
        );
        const raw = response.body?.MediaContainer?.Metadata?.[0];
        const refreshed = raw
          ? normalizePlexItem(
              connection.id,
              {
                id: item.libraryId,
                connectionId: connection.id,
                name: item.libraryName ?? "",
                kind: item.kind,
                enabled: true,
              },
              raw,
            )
          : null;
        if (refreshed?.versions.length) versions = refreshed.versions;
      } catch {
        // Cached playback remains usable when the server cannot refresh details.
      }
    }
    const version = versions.find((v) => v.id === versionId) ?? versions[0];
    if (!version) throw new Error("No playable media version");
    const token = mediaServerToken(connection) ?? "";
    const subtitles = (version.subtitles ?? [])
      .filter((subtitle) => !!subtitle.url)
      .map((subtitle) => ({
        id: subtitle.id,
        language: subtitle.language,
        title: subtitle.title,
        url: new URL(subtitle.url!, `${connection.origin}/`).toString(),
      }));
    const direct =
      version.directPlayable &&
      connection.directPlay &&
      versionFitsQuality(version, request.quality);
    if (direct)
      return {
        url: new URL(version.id, `${connection.origin}/`).toString(),
        protocol: "http",
        direct: true,
        versionId: version.id,
        headers: { "X-Plex-Token": token },
        subtitles,
        effectiveQuality: request.quality,
        decision: "direct-play",
      };
    if (!connection.transcodeFallback)
      throw new Error("Transcoding is disabled for this server. Choose Original quality.");
    const preset = qualityPreset(request.quality);
    const sessionId = request.playbackSessionId ?? crypto.randomUUID();
    const profile =
      "add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mpegts&videoCodec=h264&audioCodec=aac&replace=true)";
    const params = new URLSearchParams({
      path: `/library/metadata/${item.id}`,
      mediaIndex: "0",
      partIndex: "0",
      protocol: "hls",
      directPlay: "0",
      directStream: "0",
      hasMDE: "1",
      fastSeek: "1",
      subtitleSize: "100",
      subtitles: "none",
      audioBoost: "100",
      location: "lan",
      session: sessionId,
      offset: String(Math.max(0, Math.floor((request.startPositionMs ?? 0) / 1000))),
      maxVideoBitrate: String(preset.maxBitrateKbps ?? 100_000),
      videoResolution: `${preset.maxWidth ?? 3840}x${preset.maxHeight ?? 2160}`,
      "X-Plex-Client-Identifier": "harbor",
      "X-Plex-Product": "Harbor",
      "X-Plex-Platform": "Generic",
      "X-Plex-Device": "Harbor",
      "X-Plex-Client-Profile-Name": "Generic",
      "X-Plex-Client-Profile-Extra": profile,
      "X-Plex-Token": token,
    });
    // Do not replace a working stream unless Plex has accepted the requested
    // profile. The start endpoint otherwise fails asynchronously inside mpv.
    await mediaServerRequest(connection.origin, `video/:/transcode/universal/decision?${params}`, {
      headers: this.headers(connection),
    });
    return {
      url: new URL(
        `video/:/transcode/universal/start.m3u8?${params}`,
        `${connection.origin}/`,
      ).toString(),
      protocol: "hls",
      direct: false,
      versionId: version.id,
      headers: { "X-Plex-Token": token },
      subtitles,
      effectiveQuality: request.quality,
      playbackSessionId: sessionId,
      decision: "transcode",
      transcodeReason: "quality-limit",
    };
  }
  async reportProgress(
    connection: MediaServerConnection,
    item: MediaServerItem,
    progress: MediaServerProgress,
  ) {
    await mediaServerRequest(
      connection.origin,
      `/:/timeline?ratingKey=${encodeURIComponent(item.id)}&key=${encodeURIComponent(item.id)}&state=playing&time=${progress.positionMs}`,
      { headers: this.headers(connection) },
    );
  }
  async stopPlayback(
    connection: MediaServerConnection,
    _item: MediaServerItem,
    playbackSessionId: string,
  ) {
    await mediaServerRequest(
      connection.origin,
      `/video/:/transcode/universal/stop?session=${encodeURIComponent(playbackSessionId)}`,
      { headers: this.headers(connection) },
    );
  }
  async setWatched(connection: MediaServerConnection, item: MediaServerItem, watched: boolean) {
    await mediaServerRequest(
      connection.origin,
      `/:/${watched ? "scrobble" : "unscrobble"}?key=${encodeURIComponent(item.id)}&identifier=com.plexapp.plugins.library`,
      { headers: this.headers(connection) },
    );
  }
}
