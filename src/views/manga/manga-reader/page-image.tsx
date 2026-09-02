import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { fetchImageObjectUrl, IMAGE_FALLBACK_HEADERS } from "./reader-utils";

type Status = "loading" | "loaded" | "error";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
  const [nativeFallback, setNativeFallback] = useState(false);
  const autoRetried = useRef(false);
  const prevUrl = useRef(url);

  const wantHeaderFetch =
    isTauri && !!headers && Object.keys(headers).length > 0 && !headerFailed;
  const nativeFetch = wantHeaderFetch || (isTauri && nativeFallback);

  const failHeaders = () => {
    setBlobUrl(null);
    setHeaderFailed(true);
  };

  if (prevUrl.current !== url) {
    prevUrl.current = url;
    setStatus("loading");
    setBust(0);
    setBlobUrl(null);
    setHeaderFailed(false);
    setNativeFallback(false);
    autoRetried.current = false;
  }

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
    if (!nativeFetch) return;
    let alive = true;
    let created: string | null = null;
    setStatus("loading");
    fetchImageObjectUrl(url, wantHeaderFetch && headers ? headers : IMAGE_FALLBACK_HEADERS)
      .then((obj) => {
        if (!alive) {
          URL.revokeObjectURL(obj);
          return;
        }
        created = obj;
        setBlobUrl(obj);
      })
      .catch(() => {
        if (!alive) return;
        if (wantHeaderFetch) failHeaders();
        else setStatus("error");
      });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, headers, nativeFetch, wantHeaderFetch, bust]);

  const rawSrc = bust ? `${url}${url.includes("?") ? "&" : "?"}h=${bust}` : url;
  const src = nativeFetch ? blobUrl : rawSrc;

  const retry = () => {
    setStatus("loading");
    setBust((b) => b + 1);
  };

  const loaded = status === "loaded";

  return (
    <div
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
          onError={() => {
            if (wantHeaderFetch) failHeaders();
            else if (isTauri && !nativeFallback) setNativeFallback(true);
            else setStatus("error");
          }}
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
