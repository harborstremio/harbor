import { Check, Loader2, Trash2, Upload } from "../icons";
import { useRef, type ChangeEvent } from "react";
import { useCustomFonts } from "@/lib/custom-fonts";
import { useT } from "@/lib/i18n";

export function CustomFontTiles({
  activeId,
  onSelect,
  onClear,
  compact = false,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const { fonts, busy, error, addFont, removeFont } = useCustomFonts();
  const localizedError =
    error === "Use a TTF, OTF, WOFF or WOFF2 file."
      ? t("Use a TTF, OTF, WOFF or WOFF2 file.")
      : error === "That font is over 32 MB. Try a lighter file."
        ? t("That font is over 32 MB. Try a lighter file.")
        : error === "That file is not a valid font."
          ? t("That file is not a valid font.")
          : error;
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const id = await addFont(file);
    if (id) onSelect(id);
  };

  const remove = (id: string) => {
    removeFont(id);
    if (id === activeId) onClear();
  };

  const pad = compact ? "p-4" : "p-5";
  const radius = "rounded-[10px]";
  const previewSize = compact ? "text-[22px]" : "text-[28px]";
  const activeCls = compact ? "border-accent bg-elevated" : "border-ink bg-elevated";

  return (
    <>
      {fonts.map((f) => {
        const active = f.id === activeId;
        const family = `"harbor-font-${f.id}", sans-serif`;
        return (
          <div
            key={f.id}
            className={`group/font relative flex flex-col ${radius} border ${pad} transition-colors ${
              active ? activeCls : "border-edge-soft bg-elevated hover:border-edge"
            }`}
            style={{ animation: "harborFontIn 240ms ease both" }}
          >
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className="flex min-h-11 flex-1 flex-col gap-1.5 pe-12 text-start"
            >
              <span
                className={`${previewSize} font-medium leading-none tracking-tight text-ink`}
                style={{ fontFamily: family }}
              >
                Harbor
              </span>
              {!compact && (
                <span className="text-[15.5px] leading-[22px] text-ink-muted" style={{ fontFamily: family }}>
                  {t("The quick brown fox jumps over the lazy dog")}
                </span>
              )}
              <span
                className={`min-w-0 break-words ${
                  compact
                    ? "mt-1 text-[15.5px] font-medium leading-[22px] text-ink-subtle"
                    : "text-[15.5px] leading-[22px] text-ink-subtle"
                }`}
              >
                {f.name}
              </span>
            </button>
            <div className="absolute end-2 top-2 flex items-center">
              {active && (
                <Check
                  size={18}
                  strokeWidth={2.6}
                  className="me-2 shrink-0 text-accent group-hover/font:hidden [html[data-input-modality=keys]_&]:hidden"
                />
              )}
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={t("Remove {name}", { name: f.name })}
                className="hidden h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger group-hover/font:flex [html[data-input-modality=keys]_&]:flex"
              >
                <Trash2 size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`flex flex-col items-center justify-center gap-2 ${radius} border border-dashed border-edge-soft ${pad} text-center transition-colors ${
          busy ? "opacity-80" : "hover:border-edge hover:bg-elevated"
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-ink-muted">
          {busy ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Upload size={20} strokeWidth={2.2} />
          )}
        </span>
        <span className="text-[16.5px] font-semibold leading-[24px] text-ink">
          {busy ? t("Adding font…") : t("Upload a font")}
        </span>
        {!busy && (
          <span className="text-[15.5px] leading-[22px] text-ink-subtle">
            {t("TTF, OTF, WOFF or WOFF2")}
          </span>
        )}
      </button>

      {localizedError && (
        <p className="col-span-full max-w-[66ch] text-[15.5px] leading-[22px] font-medium text-danger">
          {localizedError}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        className="hidden"
        onChange={onFile}
      />
    </>
  );
}
