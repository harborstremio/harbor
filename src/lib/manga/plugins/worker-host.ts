import { SANDBOX_SOURCE } from "./sandbox";
import { runPluginGrpc, runPluginHttp, type PluginHttpPolicy } from "./host-http";
import { serializeHtml } from "./host-parse";
import type {
  InstalledPlugin,
  PluginGrpcOpts,
  PluginMeta,
  FromWorker,
  ToWorker,
  PluginHttpOpts,
} from "./types";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  cancelTimer?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
};

export type PluginWorkerOptions = {
  onLog?: (level: string, args: unknown[]) => void;
  onHttpRequest?: (url: string) => void;
  httpPolicy?: PluginHttpPolicy & { sameSiteHeaders?: boolean };
  readyTimeoutMs?: number;
  denyHttp?: boolean;
};

const MAX_CONCURRENT_HTTP = 6;
const MAX_GLOBAL_HTTP = 16;
let globalHttpInflight = 0;
const globalHttpQueue: Array<() => void> = [];
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const CANCEL_ACK_MS = 250;

export class PluginWorker {
  private plugin: InstalledPlugin;
  private opts: PluginWorkerOptions;
  private worker: Worker | null = null;
  private url: string | null = null;
  private ready: Promise<PluginMeta> | null = null;
  private readyResolve: ((m: PluginMeta) => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private calls = new Map<string, Pending>();
  private seq = 0;
  private httpInflight = 0;
  private httpQueue: Array<() => void> = [];

  constructor(plugin: InstalledPlugin, opts: PluginWorkerOptions = {}) {
    this.plugin = plugin;
    this.opts = opts;
  }

  meta(): Promise<PluginMeta> {
    return this.ensure();
  }

  pendingCalls(): number {
    return this.calls.size;
  }

  private ensure(): Promise<PluginMeta> {
    if (!this.ready) this.ready = this.spawn();
    return this.ready;
  }

  private spawn(): Promise<PluginMeta> {
    const blob = new Blob([SANDBOX_SOURCE], { type: "text/javascript" });
    this.url = URL.createObjectURL(blob);
    const w = new Worker(this.url);
    this.worker = w;
    w.onmessage = (e) => this.onMessage(e.data as FromWorker);
    w.onerror = () => this.crash("worker runtime error");
    w.onmessageerror = () => this.crash("worker message clone error");
    return new Promise<PluginMeta>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      if (this.opts.readyTimeoutMs) {
        this.readyTimer = setTimeout(() => {
          this.readyTimer = null;
          if (this.readyReject) this.crash("did not start in time");
        }, this.opts.readyTimeoutMs);
      }
      w.postMessage({
        type: "init",
        source: this.plugin.source,
        config: this.plugin.config ?? {},
      } satisfies ToWorker);
    });
  }

  async call(
    method: string,
    args: unknown[],
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted) throw abortError();
    await this.ensure();
    const w = this.worker;
    if (!w) throw new Error("plugin worker unavailable");
    if (signal?.aborted) throw abortError();
    const id = "c" + ++this.seq;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.calls.delete(id);
        this.crash(method + " timed out");
        reject(new Error(method + " timed out"));
      }, timeoutMs);
      const pending: Pending = { resolve, reject, timer, signal };
      if (signal) {
        pending.onAbort = () => this.cancel(id, method);
        signal.addEventListener("abort", pending.onAbort, { once: true });
      }
      this.calls.set(id, pending);
      w.postMessage({ type: "call", id, method, args } satisfies ToWorker);
    });
  }

  private cancel(id: string, method: string): void {
    const p = this.calls.get(id);
    if (!p) return;
    this.send({ type: "cancel", id });
    p.cancelTimer = setTimeout(() => {
      if (!this.calls.has(id)) return;
      this.calls.delete(id);
      clearTimeout(p.timer);
      p.reject(abortError());
      this.crash(method + " cancelled");
    }, CANCEL_ACK_MS);
  }

  private send(msg: ToWorker): void {
    try {
      this.worker?.postMessage(msg);
    } catch {
      /* worker gone */
    }
  }

  private settle(id: string, value: unknown, err: Error | null): void {
    const p = this.calls.get(id);
    if (!p) return;
    this.calls.delete(id);
    clearTimeout(p.timer);
    if (p.cancelTimer) clearTimeout(p.cancelTimer);
    if (p.signal && p.onAbort) p.signal.removeEventListener("abort", p.onAbort);
    if (err) p.reject(err);
    else p.resolve(value);
  }

  private onMessage(m: FromWorker): void {
    if (!m || typeof m !== "object") return;
    switch (m.type) {
      case "ready":
        if (this.readyTimer) {
          clearTimeout(this.readyTimer);
          this.readyTimer = null;
        }
        this.readyResolve?.(m.meta);
        this.readyResolve = null;
        this.readyReject = null;
        break;
      case "initError":
        if (this.readyTimer) {
          clearTimeout(this.readyTimer);
          this.readyTimer = null;
        }
        this.readyReject?.(new Error(m.error));
        this.readyResolve = null;
        this.readyReject = null;
        this.dispose();
        break;
      case "result":
        this.settle(m.id, m.value, null);
        break;
      case "error":
        this.settle(m.id, null, new Error(m.error));
        break;
      case "cancelled":
        this.settle(m.id, null, abortError());
        break;
      case "http":
        void this.onHttp(m.id, m.payload.url, m.payload.opts);
        break;
      case "grpc":
        void this.onGrpc(m.id, m.payload.url, m.payload.requestBase64, m.payload.opts);
        break;
      case "parse":
        this.onParse(m.id, m.payload.html);
        break;
      case "log":
        this.opts.onLog?.(m.level, m.args);
        break;
      case "pong":
        break;
    }
  }

  private headerGate(url: string): { allowReferer?: string; allowCookie?: string } {
    if (this.opts.httpPolicy?.sameSiteHeaders) return { allowReferer: url, allowCookie: url };
    return { allowReferer: this.plugin.baseUrl, allowCookie: undefined };
  }

  private async onHttp(id: string, url: string, opts: PluginHttpOpts): Promise<void> {
    if (this.opts.denyHttp) {
      this.send({ type: "bridgeResult", id, ok: false, error: "network not available here" });
      return;
    }
    this.opts.onHttpRequest?.(url);
    await this.acquireHttp();
    try {
      const trustedOpts: PluginHttpOpts = { ...opts, ...this.headerGate(url) };
      const value = await runPluginHttp(url, trustedOpts, this.opts.httpPolicy);
      this.send({ type: "bridgeResult", id, ok: true, value });
    } catch (e) {
      this.send({ type: "bridgeResult", id, ok: false, error: errText(e) });
    } finally {
      this.releaseHttp();
    }
  }

  private async onGrpc(
    id: string,
    url: string,
    requestBase64: string,
    opts: PluginGrpcOpts,
  ): Promise<void> {
    await this.acquireHttp();
    try {
      const value = await runPluginGrpc(url, requestBase64, { ...opts, ...this.headerGate(url) });
      this.send({ type: "bridgeResult", id, ok: true, value });
    } catch (error) {
      this.send({ type: "bridgeResult", id, ok: false, error: errText(error) });
    } finally {
      this.releaseHttp();
    }
  }

  private async acquireHttp(): Promise<void> {
    if (this.httpInflight >= MAX_CONCURRENT_HTTP) {
      await new Promise<void>((resolve) => this.httpQueue.push(resolve));
    } else this.httpInflight++;
    if (globalHttpInflight >= MAX_GLOBAL_HTTP) {
      await new Promise<void>((resolve) => globalHttpQueue.push(resolve));
    } else globalHttpInflight++;
  }

  private releaseHttp(): void {
    // Hand off reserved slots before admitting new arrivals.
    const globalNext = globalHttpQueue.shift();
    if (globalNext) globalNext();
    else globalHttpInflight--;
    const next = this.httpQueue.shift();
    if (next) next();
    else this.httpInflight--;
  }

  private onParse(id: string, html: string): void {
    if (typeof html !== "string" || html.length > MAX_HTML_BYTES) {
      this.send({ type: "bridgeResult", id, ok: false, error: "html payload rejected" });
      return;
    }
    try {
      const value = serializeHtml(html);
      this.send({ type: "bridgeResult", id, ok: true, value });
    } catch (e) {
      this.send({ type: "bridgeResult", id, ok: false, error: errText(e) });
    }
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.calls) {
      clearTimeout(p.timer);
      if (p.cancelTimer) clearTimeout(p.cancelTimer);
      if (p.signal && p.onAbort) p.signal.removeEventListener("abort", p.onAbort);
      p.reject(err);
    }
    this.calls.clear();
  }

  private crash(reason: string): void {
    const err = new Error("plugin worker crashed: " + reason);
    this.rejectAll(err);
    this.readyReject?.(err);
    this.readyResolve = null;
    this.readyReject = null;
    this.teardown();
    this.ready = null;
  }

  dispose(): void {
    this.rejectAll(new Error("plugin disposed"));
    this.teardown();
    this.ready = null;
    this.readyResolve = null;
    this.readyReject = null;
  }

  private teardown(): void {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (this.worker) {
      this.send({ type: "dispose" });
      this.worker.terminate();
      this.worker = null;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }
}

function abortError(): Error {
  const e = new Error("cancelled");
  e.name = "AbortError";
  return e;
}

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
