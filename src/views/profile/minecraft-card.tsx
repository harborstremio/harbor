import { useState } from "react";
import { Boxes } from "lucide-react";
import { useT } from "@/lib/i18n";

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

const POSES: ReadonlyArray<{ id: string; label: string; path: string }> = [
  { id: "body", label: "3D", path: "body" },
  { id: "player", label: "Flat", path: "player" },
  { id: "combo", label: "Combo", path: "combo" },
  { id: "head", label: "Head", path: "head" },
  { id: "avatar", label: "Face", path: "avatar" },
];

function renderUrl(name: string, path: string): string {
  return `https://mc-heads.net/${path}/${encodeURIComponent(name)}/256`;
}

function safeBg(url?: string): string | null {
  const u = (url ?? "").trim();
  if (!u || !/^https:\/\/[^\s<>"']+$/i.test(u)) return null;
  return u;
}

export function MinecraftCard({
  name,
  hideTitle,
  background,
}: {
  name?: string;
  hideTitle?: boolean;
  background?: string;
}) {
  const t = useT();
  const [pose, setPose] = useState(POSES[0]);
  const [failed, setFailed] = useState(false);
  const clean = (name ?? "").trim();
  const bg = safeBg(background);

  if (!clean || !NAME_RE.test(clean)) return null;

  return (
    <section
      aria-label={t("Minecraft")}
      className="overflow-hidden rounded-lg bg-surface ring-1 ring-edge-soft"
    >
      {!hideTitle && (
        <div className="flex items-center gap-2 px-4 pt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <Boxes size={18} /> {t("Minecraft")}
        </div>
      )}

      <div
        className="relative mt-3 grid min-h-[260px] place-items-center overflow-hidden"
        style={
          bg
            ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--color-accent), transparent 82%), transparent 70%)",
              }
        }
      >
        {bg && <div aria-hidden className="absolute inset-0 bg-canvas/25" />}
        {failed ? (
          <span className="px-4 text-center text-[12.5px] text-ink-subtle">
            {t("Could not load that skin.")}
          </span>
        ) : (
          <img
            key={pose.id}
            src={renderUrl(clean, pose.path)}
            alt={t("{name} Minecraft skin", { name: clean })}
            draggable={false}
            loading="lazy"
            onError={() => setFailed(true)}
            className="relative max-h-[240px] w-auto object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)]"
            style={{ imageRendering: "pixelated" }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-3">
        <span className="me-auto min-w-0 truncate ps-1 font-mono text-[13px] text-ink">{clean}</span>
        {POSES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setFailed(false);
              setPose(p);
            }}
            aria-pressed={p.id === pose.id}
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
              p.id === pose.id
                ? "bg-ink text-canvas"
                : "bg-elevated text-ink-muted ring-1 ring-edge-soft hover:bg-raised hover:text-ink"
            }`}
          >
            {t(p.label)}
          </button>
        ))}
      </div>
    </section>
  );
}
