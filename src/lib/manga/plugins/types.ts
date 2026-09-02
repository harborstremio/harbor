export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  lang: string;
  nsfw: boolean;
  icon?: string;
  entry: string;
};

export type ForeignRepoKind = "tachiyomi" | "mangayomi" | "paperback" | "unknown";

export type PluginRepo = {
  name: string;
  url: string;
  plugins: PluginManifest[];
  foreign?: { kind: ForeignRepoKind; count: number };
};

export type InstalledPlugin = {
  id: string;
  name: string;
  version: string;
  lang: string;
  nsfw: boolean;
  icon?: string;
  repoUrl: string;
  baseUrl?: string;
  source: string;
  hash: string;
  enabled: boolean;
  hasTags: boolean;
  config?: Record<string, unknown>;
};

export type PluginMeta = { id: string; name: string; hasTags: boolean; methods?: string[] };

export type PluginHttpResponseType = "text" | "json" | "base64";

export type PluginHttpOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  responseType?: PluginHttpResponseType;
  timeoutMs?: number;
  allowReferer?: string;
  allowCookie?: string;
};

export type PluginHttpResult = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
};

export type PluginGrpcOpts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  mode?: "grpc" | "grpc-web";
  allowReferer?: string;
  allowCookie?: string;
};

export type PluginGrpcResult = PluginHttpResult & {
  messages: string[];
  trailers: Record<string, string>;
  grpcStatus?: number;
  grpcMessage?: string;
};

export type HNode = { t: string; a: Record<string, string>; x: string; c: HNode[] } | { x: string };

export type ToWorker =
  | { type: "init"; source: string; config: Record<string, unknown> }
  | { type: "call"; id: string; method: string; args: unknown[] }
  | { type: "bridgeResult"; id: string; ok: boolean; value?: unknown; error?: string }
  | { type: "ping" }
  | { type: "dispose" };

export type FromWorker =
  | { type: "ready"; meta: PluginMeta }
  | { type: "initError"; error: string }
  | { type: "result"; id: string; value: unknown }
  | { type: "error"; id: string; error: string }
  | { type: "http"; id: string; payload: { url: string; opts: PluginHttpOpts } }
  | {
      type: "grpc";
      id: string;
      payload: { url: string; requestBase64: string; opts: PluginGrpcOpts };
    }
  | { type: "parse"; id: string; payload: { html: string } }
  | { type: "log"; level: string; args: unknown[] }
  | { type: "pong" };
