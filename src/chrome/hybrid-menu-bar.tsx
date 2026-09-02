import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HarborMark } from "@/components/icons/harbor-mark";
import { APP_VERSION } from "@/lib/build-info";
import { close, openUrl } from "@/lib/window";
import { toggleWindowFullscreen } from "@/lib/fullscreen-state";
import { checkForUpdate } from "@/lib/updater/use-update";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { HARBOR_BUGS_BASE } from "@/lib/config/endpoints";

type Item =
  | { kind: "action"; label: string; hint?: string; onClick: () => void; danger?: boolean }
  | { kind: "sep" }
  | { kind: "label"; label: string };

type Menu = { id: string; label: string; items: Item[] };

export function HybridMenuBar() {
  const t = useT();
  const { setView } = useView();
  const { settings, update } = useSettings();
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const zoom = (delta: number) =>
    update({
      uiScale: Math.min(1.4, Math.max(0.8, Math.round((settings.uiScale + delta) * 100) / 100)),
    });

  const menus: Menu[] = [
    {
      id: "file",
      label: t("File"),
      items: [
        { kind: "action", label: t("Settings"), onClick: () => setView("settings") },
        {
          kind: "action",
          label: t("Reload"),
          hint: "Ctrl+R",
          onClick: () => window.location.reload(),
        },
        { kind: "sep" },
        { kind: "action", label: t("Quit Harbor"), onClick: () => close(), danger: true },
      ],
    },
    {
      id: "view",
      label: t("View"),
      items: [
        {
          kind: "action",
          label: t("Toggle Fullscreen"),
          hint: "F11",
          onClick: () => void toggleWindowFullscreen(),
        },
        { kind: "sep" },
        { kind: "action", label: t("Zoom In"), hint: "Ctrl +", onClick: () => zoom(0.1) },
        { kind: "action", label: t("Zoom Out"), hint: "Ctrl -", onClick: () => zoom(-0.1) },
        { kind: "action", label: t("Reset Zoom"), onClick: () => update({ uiScale: 1 }) },
      ],
    },
    {
      id: "go",
      label: t("Go"),
      items: [
        { kind: "action", label: t("Home"), onClick: () => setView("home") },
        { kind: "action", label: t("Discover"), onClick: () => setView("discover") },
        { kind: "action", label: t("Movies"), onClick: () => setView("movies") },
        { kind: "action", label: t("Shows"), onClick: () => setView("shows") },
        { kind: "action", label: t("Anime"), onClick: () => setView("anime") },
        { kind: "action", label: t("Live TV"), onClick: () => setView("live") },
        { kind: "action", label: t("Manga"), onClick: () => setView("manga") },
        { kind: "action", label: t("eBook"), onClick: () => setView("ebook") },
        { kind: "action", label: t("Library"), onClick: () => setView("library") },
      ],
    },
    {
      id: "help",
      label: t("Help"),
      items: [
        { kind: "action", label: t("Check for Updates"), onClick: () => void checkForUpdate(true) },
        { kind: "action", label: t("Report a Bug"), onClick: () => openUrl(HARBOR_BUGS_BASE) },
        { kind: "sep" },
        { kind: "label", label: `Harbor ${APP_VERSION}` },
      ],
    },
  ];

  return (
    <div data-tauri-drag-region="false" className="flex h-full items-center gap-0.5 ps-3 pe-1">
      <HarborMark className="me-1.5 h-[15px] w-[15px] shrink-0 text-ink-subtle opacity-45" />
      {menus.map((m) => (
        <div key={m.id} className="relative flex h-full items-center">
          <button
            type="button"
            onClick={() => setOpenId((o) => (o === m.id ? null : m.id))}
            onMouseEnter={() => setOpenId((o) => (o != null ? m.id : o))}
            className={`flex h-[26px] items-center rounded-[4px] px-2 text-[12.5px] transition-colors ${
              openId === m.id
                ? "bg-ink/12 text-ink"
                : "text-ink-muted hover:bg-ink/[0.08] hover:text-ink"
            }`}
          >
            {m.label}
          </button>
          {openId === m.id && <Dropdown items={m.items} onClose={() => setOpenId(null)} />}
        </div>
      ))}
      {openId &&
        createPortal(
          <div className="fixed inset-0 z-[135] bg-black/35" onClick={() => setOpenId(null)} />,
          document.body,
        )}
    </div>
  );
}

function Dropdown({ items, onClose }: { items: Item[]; onClose: () => void }) {
  return (
    <div className="absolute left-0 top-[calc(100%+3px)] z-[150] min-w-[224px] overflow-hidden rounded-[5px] border border-edge bg-elevated py-1 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]">
      {items.map((it, i) => {
        if (it.kind === "sep") return <div key={i} className="my-1 h-px bg-edge-soft/70" />;
        if (it.kind === "label")
          return (
            <div key={i} className="px-3 py-1 text-[11px] tabular-nums text-ink-subtle">
              {it.label}
            </div>
          );
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={`flex w-full items-center justify-between gap-8 px-3 py-1.5 text-start text-[12.5px] transition-colors ${
              it.danger
                ? "text-danger hover:bg-danger/12"
                : "text-ink-muted hover:bg-ink/[0.08] hover:text-ink"
            }`}
          >
            <span>{it.label}</span>
            {it.hint && <span className="text-[11px] tabular-nums text-ink-subtle">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
