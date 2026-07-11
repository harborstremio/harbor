import { HarborLoader } from "@/components/harbor-loader";
import { installFromUrl } from "@/lib/addon-store";
import { isAdultText } from "@/lib/addons-store/adult-filter";
import { clearPendingDeepLink } from "@/lib/deep-link";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { isLinuxDesktop, isWeb } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { ArrowUpRight, ClipboardCopy, ExternalLink, RotateCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { InstallOverlay } from "./installer-viewport/install-overlay";

const EVENT = "harbor:open-installer";

type InstallerDetail = { url: string; title?: string; logo?: string | null };

export function openInstallerViewport(url: string, title?: string, logo?: string | null): void {
  if (typeof window === "undefined") return;
  // Linux: the in-page iframe can't capture the addon's stremio:// install link
  // (WebKitGTK refuses the scheme). Route through the Harbor Browser window, where
  // browser.rs intercepts the link and feeds it into the deep-link install bridge.
  if (isLinuxDesktop()) {
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("browser_open", { url }).catch(() => {
        window.__harborInstallerOpen = true;
        window.dispatchEvent(new CustomEvent<InstallerDetail>(EVENT, { detail: { url, title, logo } }));
      });
    });
    return;
  }
  window.__harborInstallerOpen = true;
  window.dispatchEvent(new CustomEvent<InstallerDetail>(EVENT, { detail: { url, title, logo } }));
}

export function InstallerViewportRoot() {
  const [request, setRequest] = useState<InstallerDetail | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InstallerDetail>).detail;
      if (detail?.url) setRequest(detail);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  if (!request) return null;
  return (
    <InstallerViewport
      url={request.url}
      title={request.title ?? new URL(request.url).hostname}
      logo={request.logo ?? null}
      onClose={() => setRequest(null)}
    />
  );
}

type Phase =
  | { kind: "idle" }
  | { kind: "installing"; name: string | null }
  | { kind: "success"; name: string; logo: string | null }
  | { kind: "error"; message: string };

const STREMIO_PROTO = "stremio://";

function normalizeInstallUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(STREMIO_PROTO)) {
    return "https://" + trimmed.slice(STREMIO_PROTO.length);
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return null;
}

function InstallerViewport({
  url,
  title,
  logo,
  onClose,
}: {
  url: string;
  title: string;
  logo: string | null;
  onClose: () => void;
}) {
  const [pasteValue, setPasteValue] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const successTimerRef = useRef<number | null>(null);
  const blockedTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    document.body.style.overflow = "hidden";
    window.__harborInstallerOpen = true;
    return () => {
      document.body.style.overflow = "";
      window.__harborInstallerOpen = false;
    };
  }, []);

  useEffect(() => {
    if (isAdultText(url, title)) return pushActivityHint({ details: "Setting up an addon", state: "Addon setup" });
    const label =
      phase.kind === "installing"
        ? `Installing ${title}`
        : phase.kind === "success"
          ? `Installed ${title}`
          : `Configuring ${title}`;
    const largeImage = logo && logo.startsWith("https://") ? logo : undefined;
    return pushActivityHint({ details: label, state: "Addon setup", largeImage, largeText: title });
  }, [url, title, logo, phase.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase.kind !== "installing") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase.kind]);

  useEffect(() => {
    blockedTimerRef.current = window.setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 7500);
    return () => {
      if (blockedTimerRef.current !== null) window.clearTimeout(blockedTimerRef.current);
    };
  }, [loaded, reloadKey]);

  const submit = useCallback(
    async (rawUrl: string) => {
      const normalized = normalizeInstallUrl(rawUrl);
      if (!normalized) {
        setPhase({
          kind: "error",
          message: "Paste a stremio:// link or an https://…/manifest.json URL.",
        });
        return;
      }
      setPhase({ kind: "installing", name: null });
      try {
        const result = await installFromUrl(normalized);
        const name = result.addon.manifest.name ?? "Addon";
        const logo = result.addon.manifest.logo ?? null;
        const id = result.addon.manifest.id;
        setPhase({ kind: "success", name, logo });
        window.dispatchEvent(new CustomEvent("harbor:addons-changed", { detail: { id, installed: true } }));
        successTimerRef.current = window.setTimeout(() => {
          onClose();
        }, 2000);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Install failed.";
        setPhase({ kind: "error", message: msg });
      }
    },
    [onClose],
  );

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const isBusy = () => phaseRef.current.kind === "installing" || phaseRef.current.kind === "success";

    const onMessage = (e: MessageEvent) => {
      if (isBusy()) return;
      const data = e.data;
      if (!data) return;
      const candidate =
        typeof data === "string"
          ? data
          : typeof data?.url === "string"
            ? data.url
            : typeof data?.manifestUrl === "string"
              ? data.manifestUrl
              : null;
      if (!candidate) return;
      if (candidate.startsWith(STREMIO_PROTO) || candidate.includes("manifest.json")) {
        void submitRef.current(candidate);
      }
    };
    const onDeeplink = (e: Event) => {
      if (isBusy()) return;
      const detail = (e as CustomEvent<{ rawUrl: string }>).detail;
      const raw = detail?.rawUrl;
      if (!raw) return;
      clearPendingDeepLink();
      setPasteValue(raw);
      void submitRef.current(raw);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("harbor:deeplink-install", onDeeplink);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("harbor:deeplink-install", onDeeplink);
    };
  }, []);

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      setPasteValue(text);
      void submit(text);
    } catch {
      setPhase({
        kind: "error",
        message: "Clipboard access was blocked. Paste the link manually.",
      });
    }
  };

  const dismissError = () => setPhase({ kind: "idle" });
  const reload = () => {
    setBlocked(false);
    setLoaded(false);
    setReloadKey((k) => k + 1);
  };

  return createPortal(
    <div className="fixed inset-0 z-[240] flex flex-col bg-black/82 backdrop-blur-md">
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-canvas/60 px-5 text-ink backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {logo && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated ring-1 ring-edge-soft">
              <img
                src={logo}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
          )}
          <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.24em] text-accent">
            Setup · {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            aria-label="Reload"
            className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <RotateCw
              size={12}
              strokeWidth={2.4}
              style={{
                transform: `rotate(${reloadKey * 360}deg)`,
                transition: "transform 0.6s cubic-bezier(0.22,0.61,0.36,1)",
              }}
            />
            Reload
          </button>
          <button
            type="button"
            onClick={() => openUrl(url)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <ExternalLink size={12} strokeWidth={2.4} />
            Open in browser
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={phase.kind === "installing"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink disabled:opacity-40"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-white">
        {!loaded && !blocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas">
            <HarborLoader size="lg" caption={`Loading ${title}`} />
          </div>
        )}
        {blocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
            <p className="text-[14px] font-semibold text-ink">{title} won&apos;t load inside Harbor.</p>
            <p className="max-w-[44ch] text-[12.5px] text-ink-muted">
              Open it in a regular browser, set it up there, then come back and paste the install link below.
            </p>
            <button
              type="button"
              onClick={() => openUrl(url)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <ArrowUpRight size={13} strokeWidth={2.4} />
              Open in browser
            </button>
          </div>
        )}
        <iframe
          key={reloadKey}
          src={url}
          title={title}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write; clipboard-read; encrypted-media; fullscreen"
        />
        {(phase.kind === "installing" || phase.kind === "success") && <InstallOverlay phase={phase} logo={logo} />}
      </div>

      <footer className="flex shrink-0 flex-col gap-2.5 border-t border-white/10 bg-canvas/72 px-5 py-3.5 backdrop-blur-md">
        <p className="text-[12.5px] leading-snug text-ink-muted">
          {isWeb()
            ? "Configure the addon above, then copy its manifest URL and paste it here. The web app can't catch the Install button automatically the way the desktop app does."
            : "Paste the manifest URL, or click Install on the addon's configuration page above."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(pasteValue);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) {
                setPasteValue(text);
                window.setTimeout(() => void submit(text), 60);
              }
            }}
            placeholder="stremio://… or https://…/manifest.json"
            className="h-10 flex-1 rounded-full border border-edge-soft bg-surface px-4 text-[13px] text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={phase.kind === "installing" || phase.kind === "success"}
          />
          <button
            type="button"
            onClick={() => void readClipboard()}
            disabled={phase.kind === "installing" || phase.kind === "success"}
            className="flex h-10 items-center gap-1.5 rounded-full border border-edge-soft px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-40"
          >
            <ClipboardCopy size={13} strokeWidth={2.2} />
            From clipboard
          </button>
          <button
            type="submit"
            disabled={!pasteValue.trim() || phase.kind === "installing" || phase.kind === "success"}
            className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={13} strokeWidth={2.4} />
            Install
          </button>
        </form>
        {phase.kind === "error" && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            <span className="flex-1">{phase.message}</span>
            <button
              type="button"
              onClick={dismissError}
              className="font-semibold uppercase tracking-wider opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}
      </footer>
    </div>,
    document.body,
  );
}
