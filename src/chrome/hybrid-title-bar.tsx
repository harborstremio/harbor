import { Search } from "@/components/icons/search-icon";
import { useEffect, useRef, type ReactNode } from "react";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";
import { osClass } from "@/lib/platform";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { HybridMenuBar } from "./hybrid-menu-bar";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function HybridTitleBar({ suppressed = false }: { suppressed?: boolean }) {
  const { settings } = useSettings();
  const fullscreen = useWindowFullscreen();
  if (!IS_TAURI || settings.useNativeTitleBar || !settings.hybridTitleBar) return null;
  if (suppressed || fullscreen) return null;
  const mac = osClass() === "macos";
  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[140] h-9 select-none border-b border-edge-soft/70 bg-canvas/80 backdrop-blur-md"
    >
      <div className="absolute left-0 top-0 flex h-full items-center">
        {mac && <MacDots />}
        <HybridMenuBar />
      </div>
      <div className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-center">
        <BarSearch />
      </div>
      {!mac && (
        <div className="absolute right-0 top-0 flex h-full items-stretch">
          <WinControls />
        </div>
      )}
    </div>
  );
}

function BarSearch() {
  const t = useT();
  const { open, setOpen, query, setQuery } = useSearch();
  const prevOpen = useRef(false);
  useEffect(() => {
    if (prevOpen.current && !open) setQuery("");
    prevOpen.current = open;
  }, [open, setQuery]);
  return (
    <div
      data-tauri-drag-region="false"
      className="flex h-full w-[360px] items-center gap-2.5"
    >
      <Search size={15} strokeWidth={2} className="shrink-0 text-ink-subtle" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim()) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("");
            e.currentTarget.blur();
          }
          if (e.key === "Enter" && query.trim()) setOpen(true);
        }}
        placeholder={t("search.placeholder")}
        spellCheck={false}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
      />
    </div>
  );
}

function WinControls() {
  const t = useT();
  const maxed = useMaximized();
  const win = osClass() === "windows";
  return (
    <div data-tauri-drag-region="false" className="flex h-full items-stretch">
      <WinBtn label={t("chrome.minimize")} onClick={minimize} win={win} glyph={""}>
        <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </WinBtn>
      <WinBtn
        label={maxed ? t("chrome.restore") : t("chrome.maximize")}
        onClick={() => void toggleMaximize()}
        win={win}
        glyph={maxed ? "" : ""}
      >
        {maxed ? (
          <>
            <rect x="2.5" y="4.5" width="6" height="6" stroke="currentColor" strokeWidth="1.4" rx="1" />
            <path
              d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </>
        ) : (
          <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
        )}
      </WinBtn>
      <WinBtn label={t("common.close")} onClick={close} danger win={win} glyph={""}>
        <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </WinBtn>
    </div>
  );
}

function WinBtn({
  label,
  onClick,
  danger,
  children,
  win,
  glyph,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
  win: boolean;
  glyph: string;
}) {
  return (
    <div className="group/ctl relative flex h-full">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`flex h-full w-[52px] items-center justify-center text-ink-muted transition-colors duration-100 ${
          danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-ink/10 hover:text-ink"
        }`}
      >
        {win ? (
          <span
            aria-hidden
            className="leading-none"
            style={{ fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"', fontSize: "10px" }}
          >
            {glyph}
          </span>
        ) : (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            {children}
          </svg>
        )}
      </button>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-raised px-2.5 py-1 text-[11px] font-medium text-ink opacity-0 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft transition-[opacity,transform] duration-150 ease-out group-hover/ctl:translate-y-0 group-hover/ctl:opacity-100 group-hover/ctl:delay-500 motion-reduce:translate-y-0 motion-reduce:transition-none">
        {label}
        <span
          aria-hidden
          className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] bg-raised"
        />
      </span>
    </div>
  );
}

function MacDots() {
  const t = useT();
  const maxed = useMaximized();
  return (
    <div data-tauri-drag-region="false" className="flex h-full items-center gap-2 pl-3.5 pr-2">
      <MacDot color="#ff5f57" label={t("common.close")} onClick={close}>
        <path d="M3.2 3.2l3.6 3.6M6.8 3.2l-3.6 3.6" stroke="#4d0000" strokeWidth="1.3" strokeLinecap="round" />
      </MacDot>
      <MacDot color="#febc2e" label={t("chrome.minimize")} onClick={minimize}>
        <path d="M2.6 5h4.8" stroke="#5a3d00" strokeWidth="1.3" strokeLinecap="round" />
      </MacDot>
      <MacDot
        color="#28c840"
        label={maxed ? t("chrome.restore") : t("chrome.maximize")}
        onClick={() => void toggleMaximize()}
      >
        <path d="M2.6 2.6H5.8L2.6 5.8Z" fill="#0b3d0b" />
        <path d="M7.4 7.4H4.2L7.4 4.2Z" fill="#0b3d0b" />
      </MacDot>
    </div>
  );
}

function MacDot({
  color,
  label,
  onClick,
  children,
}: {
  color: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group/dot flex h-[13px] w-[13px] items-center justify-center rounded-full ring-1 ring-black/15"
      style={{ backgroundColor: color }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="opacity-0 transition-opacity duration-100 group-hover/dot:opacity-100"
      >
        {children}
      </svg>
    </button>
  );
}
