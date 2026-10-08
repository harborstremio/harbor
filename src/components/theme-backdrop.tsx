import { AuroraBokeh } from "@/components/aurora-bokeh";
import { useActiveHeroDockMode } from "@/lib/hero-dock-layout";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { useView } from "@/lib/view";

export function ThemeBackdrop() {
  const { settings } = useSettings();
  const { player, view } = useView();
  const preview = useThemePreview();
  const dockMode = useActiveHeroDockMode();

  if (player) return null;
  // A video pinned as the wallpaper replaces the theme background; a scrim keeps the page readable.
  if (dockMode === "wallpaper") return <div className="theme-backdrop-scrim pointer-events-none fixed inset-0 -z-10" />;
  // On the desktop the video plays behind the page, so the background must leave the hero box clear.
  const cut = dockMode === "hero" ? " theme-backdrop-hero" : "";

  const preset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const wantsBokeh = (preview ? preview.bokeh : !!preset?.bokeh) && view !== "addons";
  const img = settings.theme.backgroundImage ?? preset?.background?.image ?? null;
  const dim = Math.max(
    0,
    Math.min(
      1,
      settings.theme.backgroundDim ?? preset?.background?.dim ?? 0.65,
    ),
  );

  if (!img) {
    return (
      <>
        <div className={`pointer-events-none fixed inset-0 -z-30 bg-canvas${cut}`} />
        {wantsBokeh && !cut && <AuroraBokeh />}
      </>
    );
  }
  const isGradient =
    img.startsWith("linear-gradient") ||
    img.startsWith("radial-gradient") ||
    img.startsWith("conic-gradient");
  const presetGradient = !!preset?.background?.image && preset.background.image === img && isGradient;
  return (
    <>
      <div
        className={`pointer-events-none fixed inset-0 -z-30 bg-cover bg-center${cut}`}
        style={
          isGradient
            ? { background: img }
            : { backgroundImage: `url(${img})` }
        }
      />
      {!presetGradient && (
        <div
          className={`pointer-events-none fixed inset-0 -z-20${cut}`}
          style={{ background: "black", opacity: 0.45 }}
        />
      )}
      <div
        className={`pointer-events-none fixed inset-0 -z-10 bg-canvas${cut}`}
        style={{ opacity: presetGradient ? 0 : dim }}
      />
      {wantsBokeh && !cut && <AuroraBokeh />}
    </>
  );
}
