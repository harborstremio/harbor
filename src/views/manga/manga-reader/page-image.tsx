import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";

type Status = "loading" | "loaded" | "error";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type HarborFetchResponse = {
  status: number;
  ok: boolean;
  body: string;
  contentType?: string | null;
  headers?: Record<string, string>;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchHeaderImage(url: string, headers: Record<string, string>): Promise<string> {
  const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
    args: { url, method: "GET", headers, responseType: "base64", timeoutMs: 30000 },
  });
  if (!resp.ok) throw new Error(`status ${resp.status}`);
  const type = resp.headers?.["content-type"] || resp.contentType || "";
  if (type && !type.startsWith("image/")) throw new Error(`type ${type}`);
  const bytes = new Uint8Array(base64ToBytes(resp.body));
  const blob = new Blob([bytes], { type: type || "image/jpeg" });
  return URL.createObjectURL(blob);
}

export function PageImage({
  url,
  headers,
  className,
  style,
  inline,
  fillHeight,
}: {
  url: string;
  headers?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  inline?: boolean;
  fillHeight?: boolean;
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [bust, setBust] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [headerFailed, setHeaderFailed] = useState(false);
  const [nearbyUrl, setNearbyUrl] = useState<string | null>(null);
  const autoRetried = useRef(false);
  const prevUrl = useRef(url);
  const rootRef = useRef<HTMLDivElement>(null);

  const wantHeaderFetch = isTauri && !!headers && Object.keys(headers).length > 0 && !headerFailed;
  const activeHeaderFetch = wantHeaderFetch && nearbyUrl === url;

  if (prevUrl.current !== url) {
    prevUrl.current = url;
    setStatus("loading");
    setBust(0);
    setBlobUrl(null);
    setHeaderFailed(false);
    autoRetried.current = false;
  }

  useEffect(() => {
    if (!wantHeaderFetch) return;
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setNearbyUrl(url);
        observer.disconnect();
      },
      { rootMargin: "120% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [url, wantHeaderFetch]);

  useEffect(() => {
    if (status !== "error" || autoRetried.current) return;
    autoRetried.current = true;
    const id = window.setTimeout(() => {
      setStatus("loading");
      setBust((b) => b + 1);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (!activeHeaderFetch || !headers) return;
    let alive = true;
    let created: string | null = null;
    setStatus("loading");
    fetchHeaderImage(url, headers)
      .then((obj) => {
        if (!alive) {
          URL.revokeObjectURL(obj);
          return;
        }
        created = obj;
        setBlobUrl(obj);
      })
      .catch(() => {
        if (alive) setHeaderFailed(true);
      });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, headers, activeHeaderFetch, bust]);

  const rawSrc = bust ? `${url}${url.includes("?") ? "&" : "?"}h=${bust}` : url;
  const src = wantHeaderFetch ? (activeHeaderFetch ? blobUrl : null) : rawSrc;

  const retry = () => {
    setStatus("loading");
    setBust((b) => b + 1);
  };

  const loaded = status === "loaded";

  return (
    <div
      ref={rootRef}
      className={
        inline
          ? "relative flex justify-center"
          : fillHeight
            ? "relative flex h-full items-center justify-center"
            : "relative flex w-full justify-center"
      }
      style={
        loaded
          ? undefined
          : fillHeight
            ? { minWidth: "36vw" }
            : { minHeight: "60vh", ...(inline ? { minWidth: "28vw" } : {}) }
      }
    >
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("loaded")}
          onError={() => (wantHeaderFetch ? setHeaderFailed(true) : setStatus("error"))}
          className={`${className ?? ""} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={style}
        />
      )}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-b from-elevated/50 to-elevated/20" />
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-canvas/60 text-center backdrop-blur-sm">
          <span className="text-[13px] font-medium text-ink-muted">{t("Page failed to load")}</span>
          <button
            type="button"
            onClick={retry}
            className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-surface px-4 text-[13px] font-semibold text-ink-muted shadow-[0_2px_8px_-4px_rgba(15,15,18,0.22)] transition-all hover:-translate-y-px hover:border-edge hover:text-ink"
          >
            <RefreshCw size={15} strokeWidth={2.2} />
            {t("Retry")}
          </button>
        </div>
      )}
    </div>
  );
}
