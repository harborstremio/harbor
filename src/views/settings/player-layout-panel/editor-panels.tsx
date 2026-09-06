import { Crown } from "../icons";
import { useT } from "@/lib/i18n";
import {
  PANEL_META,
  PANELS,
  type PanelConfig,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
} from "@/lib/player-chrome";

type Props = {
  config: PlayerChromeConfig;
  selectedPanelId: PanelId | null;
  onSelect: (id: PanelId | null) => void;
  mode: "normal" | "live" | "together";
};

export function EditorPanels({ config, selectedPanelId, onSelect, mode }: Props) {
  return (
    <>
      {PANELS.map((id) => {
        const cfg = panelConfig(config, id);
        if (cfg.hidden) return null;
        if (mode !== "together" && (id === "avatars" || id === "chat")) return null;
        if (mode === "live" && id === "episodes") return null;
        return (
          <PanelMount
            key={id}
            id={id}
            corner={cfg.corner}
            selected={selectedPanelId === id}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

export function panelConfig(config: PlayerChromeConfig, id: PanelId): PanelConfig {
  const stored = config.panels?.[id];
  return {
    corner: stored?.corner ?? PANEL_META[id].defaultCorner,
    hidden: stored?.hidden ?? false,
  };
}

function PanelMount({
  id,
  corner,
  selected,
  onSelect,
}: {
  id: PanelId;
  corner: PanelCorner;
  selected: boolean;
  onSelect: (id: PanelId | null) => void;
}) {
  const style = id === "episodes" ? episodeTabStyle(corner) : cornerStyle(corner);
  const radius =
    id === "episodes" ? (isLeftCorner(corner) ? "rounded-r-md" : "rounded-l-md") : "rounded-md";
  return (
    <div
      data-panel-id={id}
      role="button"
      tabIndex={-1}
      data-focusable="true"
      aria-pressed={selected}
      data-tv-initial-focus={selected ? "" : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(selected ? null : id);
      }}
      className={`absolute z-20 cursor-pointer ${radius} p-0.5 transition duration-150 ${
        selected ? "ring-2 ring-accent" : "ring-2 ring-transparent hover:ring-white/20"
      }`}
      style={style}
    >
      {id === "avatars" ? (
        <AvatarDockBody />
      ) : id === "chat" ? (
        <ChatPanelBody />
      ) : (
        <EpisodesTabBody side={isLeftCorner(corner) ? "left" : "right"} />
      )}
    </div>
  );
}

function isLeftCorner(corner: PanelCorner): boolean {
  return corner === "top-left" || corner === "bottom-left";
}

function cornerStyle(corner: PanelCorner): React.CSSProperties {
  switch (corner) {
    case "top-left":
      return { top: 80, left: 24 };
    case "top-right":
      return { top: 80, right: 24 };
    case "bottom-left":
      return { bottom: 180, left: 24 };
    case "bottom-right":
      return { bottom: 180, right: 24 };
  }
}

function episodeTabStyle(corner: PanelCorner): React.CSSProperties {
  return isLeftCorner(corner)
    ? { left: 0, top: "50%", transform: "translateY(-50%)" }
    : { right: 0, top: "50%", transform: "translateY(-50%)" };
}

const AVATAR_COLORS = ["oklch(0.70 0.19 42)", "oklch(0.79 0.14 212)", "oklch(0.71 0.15 293)"];

function AvatarDockBody() {
  const t = useT();
  return (
    <div className="pointer-events-none flex flex-col items-end gap-1.5 rounded-md border border-white/12 bg-black/35 p-2 backdrop-blur-xl harbor-float">
      {AVATAR_COLORS.map((c, i) => (
        <span
          key={i}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold text-black ring-2 ring-white/15"
          style={{ background: c }}
        >
          {["A", "J", "Y"][i]}
          {i === 0 && (
            <span
              aria-label={t("Host")}
              className="pointer-events-none absolute -top-2 -end-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-black shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-black/35"
            >
              <Crown size={12} strokeWidth={2.4} fill="currentColor" />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function EpisodesTabBody({ side }: { side: "left" | "right" }) {
  const t = useT();
  return (
    <div
      className={`pointer-events-none flex h-32 flex-col items-center justify-center gap-2.5 bg-canvas/90 text-ink ring-1 ring-edge-soft harbor-float ${
        side === "right" ? "rounded-l-md px-2.5" : "rounded-r-md px-2.5"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 6h13M3 12h13M3 18h9M18 8l4 4-4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {t("Up Next")}
      </span>
    </div>
  );
}

function ChatPanelBody() {
  const t = useT();
  return (
    <div className="pointer-events-none flex w-[320px] flex-col gap-2 rounded-md border border-white/12 bg-black/45 p-3 backdrop-blur-xl harbor-float">
      <div className="flex flex-col gap-1.5 text-[15.5px] leading-[22px]">
        <p>
          <span className="font-semibold" style={{ color: AVATAR_COLORS[0] }}>
            Alex
          </span>
          <span className="ms-1.5 text-white/90">{t("this scene is wild")}</span>
        </p>
        <p>
          <span className="font-semibold" style={{ color: AVATAR_COLORS[1] }}>
            Jamie
          </span>
          <span className="ms-1.5 text-white/90">{t("no way 😂")}</span>
        </p>
        <p>
          <span className="font-semibold" style={{ color: AVATAR_COLORS[2] }}>
            {t("You")}
          </span>
          <span className="ms-1.5 text-white/90">{t("didn't see that coming")}</span>
        </p>
      </div>
      <div className="mt-1 rounded-md border border-white/10 bg-white/4 px-3 py-2 text-[15.5px] leading-[22px] text-white/55">
        {t("Press T to chat...")}
      </div>
    </div>
  );
}
