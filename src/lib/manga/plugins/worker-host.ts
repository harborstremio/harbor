import { SANDBOX_SOURCE } from "./sandbox";
import { runPluginHttp } from "./host-http";
import { serializeHtml } from "./host-parse";
import type { InstalledPlugin, PluginMeta, FromWorker, ToWorker, PluginHttpOpts } from "./types";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const MAX_CONCURRENT_HTTP = 6;
const MAX_HTML_BYTES = 6 * 1024 * 1024;

export class PluginWorker {
  private plugin: InstalledPlugin;
  private worker: Worker | null = null;
  private url: string | null = null;
  private ready: Promise<PluginMeta> | null = null;
  private readyResolve: ((m: PluginMeta) => void) | null = null;
  private readyReject: ((e: Error) => void) | null = null;
  private calls = new Map<string, Pending>();
  private seq = 0;
  private httpInflight = 0;

  constructor(plugin: InstalledPlugin) {
    this.plugin = plugin;
  }

  meta(): Promise<PluginMeta> {
    return this.ensure();
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
      w.postMessage({
        type: "init",
        source: this.plugin.source,
        config: this.plugin.config ?? {},
      } satisfies ToWorker);
    });
  }

  async call(method: string, args: unknown[], timeoutMs: number): Promise<unknown> {
    await this.ensure();
    const w = this.worker;
    if (!w) throw new Error("plugin worker unavailable");
    const id = "c" + ++this.seq;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.calls.delete(id);
        this.crash(method + " timed out");
        reject(new Error(method + " timed out"));
      }, timeoutMs);
      this.calls.set(id, { resolve, reject, timer });
      w.postMessage({ type: "call", id, method, args } satisfies ToWorker);
    });
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
    if (err) p.reject(err);
    else p.resolve(value);
  }

  private onMessage(m: FromWorker): void {
    if (!m || typeof m !== "object") return;
    switch (m.type) {
      case "ready":
        this.readyResolve?.(m.meta);
        this.readyResolve = null;
        this.readyReject = null;
        break;
      case "initError":
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
      case "http":
        void this.onHttp(m.id, m.payload.url, m.payload.opts);
        break;
      case "parse":
        this.onParse(m.id, m.payload.html);
        break;
      case "log":
      case "pong":
        break;
    }
  }

  private async onHttp(id: string, url: string, opts: PluginHttpOpts): Promise<void> {
    if (this.httpInflight >= MAX_CONCURRENT_HTTP) {
      this.send({ type: "bridgeResult", id, ok: false, error: "http concurrency limit reached" });
      return;
    }
    this.httpInflight++;
    try {
      const trustedOpts: PluginHttpOpts = {
        ...opts,
        allowReferer: this.plugin.baseUrl,
        allowCookie: undefined,
      };
      const value = await runPluginHttp(url, trustedOpts);
      this.send({ type: "bridgeResult", id, ok: true, value });
    } catch (e) {
      this.send({ type: "bridgeResult", id, ok: false, error: errText(e) });
    } finally {
      this.httpInflight--;
    }
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

function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
