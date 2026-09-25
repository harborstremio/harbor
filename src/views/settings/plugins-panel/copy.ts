import type { PluginKind, PluginView } from "@/lib/plugins";
import { pluginErrorCode } from "@/lib/streams/plugins";

type T = (key: string, vars?: Record<string, string | number>) => string;

// The layer that runs Android extensions answers with its own sentence when it cannot start.
// Recognising it keeps a missing runtime from reading as a plugin fault.
const RUNTIME_GONE = /java runtime|HARBOR_JAVA|extension runtime is missing|extension bridge/i;

function runtimeMissingText(t: T): string {
  return t(
    "Harbor could not start the runtime that Android extensions need. Reinstall Harbor, or install Java 17 or newer, then try again.",
  );
}

export function errorText(t: T, e: unknown): string {
  const code = pluginErrorCode(e);
  const detail = e instanceof Error ? e.message : String(e);
  if (code === "no-runtime" || RUNTIME_GONE.test(detail)) return runtimeMissingText(t);
  switch (code) {
    case "only-https":
      return t("Only https links are accepted.");
    case "no-answer":
    case "fetch-failed":
      return t("That link did not answer.");
    case "not-a-repo":
    case "ebook-repo":
      return t(
        "This does not look like a plugin repository. Harbor reads its own plugin manifests, provider-script manifests and Android extension repositories.",
      );
    case "manga-repo":
      return t("This is a manga repository. Add it from the Manga page.");
    case "stremio-addon":
      return t("This is a Stremio addon manifest. Add it from the Addons page instead.");
    case "android-extensions":
      return t(
        "That is an app link, not a web address. Open the repository in a browser and paste the https link to its JSON file.",
      );
    case "desktop-only":
      return t("This kind of extension can only be installed in the desktop app.");
    case "install-failed":
      return t("Could not install: {error}", { error: detail });
    case "already-added":
      return t("Already added.");
    case "not-stream-plugin":
      return t("Not a stream plugin: it exports no getStreams or streams function.");
    case "too-large":
      return t("File is larger than 2 MB.");
    case "checksum":
      return t("Checksum did not match the manifest.");
    case "start-failed":
      return t("Could not start: {error}", { error: detail });
    default:
      return t("Failed: {error}", { error: detail });
  }
}

export function kindLabel(t: T, kind: PluginKind): string {
  if (kind === "stream") return t("Streams");
  if (kind === "manga") return t("Manga");
  return t("Books");
}

export type StateCopy = { desc: string | null; warn: string | null; lock: string | null };

export function healthErrorText(t: T, error: string): string {
  if (RUNTIME_GONE.test(error)) return runtimeMissingText(t);
  const timeout = /timed out/i.exec(error);
  if (timeout) {
    const secs = /(\d+)\s*(?:ms|s)/.exec(error);
    return t("Timed out after {n} seconds.", {
      n: secs ? Math.round(Number(secs[1]) / (error.includes("ms") ? 1000 : 1)) || 30 : 30,
    });
  }
  if (/did not start|initError|not-stream-plugin|SyntaxError/i.test(error)) {
    return t("Could not start: {error}", { error });
  }
  return t("Stopped with: {error}", { error });
}

export function stateCopy(t: T, p: PluginView): StateCopy {
  switch (p.state) {
    case "incompatible":
      return {
        desc: null,
        warn: null,
        lock: (p.error ?? "").startsWith("min:")
          ? t("Needs Harbor {version} or newer.", { version: (p.error ?? "").slice(4) })
          : t("This file is not a stream plugin."),
      };
    case "repo-disabled":
      return { desc: null, warn: null, lock: t("Turned off by its repository.") };
    case "hidden-adult":
      return { desc: null, warn: null, lock: t("Hidden by parental controls") };
    case "unlisted":
      return { desc: null, warn: t("No longer listed by its repository."), lock: null };
    case "files-changed":
      return {
        desc: null,
        warn: t("Plugin files changed on disk. Reinstall it from its repository."),
        lock: null,
      };
    case "auto-paused":
      return {
        desc: null,
        warn: t("Paused after {n} failures. Turn it back on to try again.", { n: 3 }),
        lock: null,
      };
    case "error":
      return { desc: null, warn: p.error ? healthErrorText(t, p.error) : null, lock: null };
    case "update":
      return {
        desc: t("v{version} available", { version: p.updateVersion ?? "" }),
        warn: null,
        lock: null,
      };
    default:
      return { desc: null, warn: null, lock: null };
  }
}
