import { AuroraBokeh } from "@/components/aurora-bokeh";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { useView } from "@/lib/view";

export function ThemeBackdrop() {
  const { settings } = useSettings();
  const { player, view } = useView();
  const preview = useThemePreview();

  if (player) return null;

  const preset = settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const wantsBokeh = (preview ? preview.bokeh : !!preset?.bokeh) && view !== "addons";
  const img = settings.theme.backgroundImage ?? preset?.background?.image ?? null;
  const dim = Math.max(
    0,
    Math.min(1, settings.theme.backgroundDim ?? preset?.background?.dim ?? 0.65),
  );

  if (!img) {
    return (
      <>
        <div className="pointer-events-none fixed inset-0 -z-30 bg-canvas" />
        {wantsBokeh && <AuroraBokeh />}
      </>
    );
  }
  const isGradient =
    img.startsWith("linear-gradient") ||
    img.startsWith("radial-gradient") ||
    img.startsWith("conic-gradient");
  const presetGradient =
    !!preset?.background?.image && preset.background.image === img && isGradient;
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-30 bg-cover bg-center"
        style={isGradient ? { background: img } : { backgroundImage: `url(${img})` }}
      />
      {!presetGradient && (
        <div
          className="pointer-events-none fixed inset-0 -z-20"
          style={{ background: "black", opacity: 0.45 }}
        />
      )}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-canvas"
        style={{ opacity: presetGradient ? 0 : dim }}
      />
      {wantsBokeh && <AuroraBokeh />}
    </>
  );
}
