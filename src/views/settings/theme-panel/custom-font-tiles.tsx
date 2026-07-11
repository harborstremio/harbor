import { useCustomFonts } from "@/lib/custom-fonts";
import { Check, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

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
  const { fonts, busy, error, addFont, removeFont } = useCustomFonts();
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
  const radius = compact ? "rounded-xl" : "rounded-2xl";
  const previewSize = compact ? "text-[22px]" : "text-[28px]";
  const activeCls = compact ? "border-accent bg-accent-soft" : "border-ink bg-elevated/40";
  const checkCls = compact ? "bg-accent" : "bg-ink";

  return (
    <>
      {fonts.map((f) => {
        const active = f.id === activeId;
        const family = `"harbor-font-${f.id}", sans-serif`;
        return (
          <div
            key={f.id}
            className={`group/font relative flex flex-col ${radius} border ${pad} transition-colors ${
              active ? activeCls : "border-edge-soft bg-elevated/15 hover:border-edge"
            }`}
            style={{ animation: "harborFontIn 240ms ease both" }}
          >
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className="flex flex-1 flex-col gap-1.5 pe-8 text-start"
            >
              <span
                className={`${previewSize} font-medium leading-none tracking-tight text-ink`}
                style={{ fontFamily: family }}
              >
                Harbor
              </span>
              {!compact && (
                <span className="text-[13px] text-ink-muted" style={{ fontFamily: family }}>
                  The quick brown fox jumps over the lazy dog
                </span>
              )}
              <span
                className={`truncate ${
                  compact
                    ? "mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle"
                    : "text-[11.5px] text-ink-subtle"
                }`}
              >
                {f.name}
              </span>
            </button>
            <div className="absolute end-3 top-3 flex items-center">
              {active && (
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${checkCls} text-canvas group-hover/font:hidden`}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={`Remove ${f.name}`}
                className="hidden h-7 w-7 items-center justify-center rounded-full bg-canvas/70 text-ink-subtle transition-colors hover:bg-danger/20 hover:text-danger group-hover/font:flex"
              >
                <Trash2 size={13} strokeWidth={2.2} />
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
          busy ? "opacity-80" : "hover:border-edge hover:bg-elevated/20"
        }`}
      >
        <span
          className={`flex items-center justify-center rounded-full bg-elevated/50 text-ink-muted ${
            compact ? "h-9 w-9" : "h-11 w-11"
          }`}
        >
          {busy ? (
            <Loader2 size={compact ? 16 : 18} className="animate-spin" />
          ) : (
            <Upload size={compact ? 16 : 18} strokeWidth={2.2} />
          )}
        </span>
        <span className="text-[13px] font-semibold text-ink">{busy ? "Adding font..." : "Upload a font"}</span>
        {!busy && <span className="text-[11px] text-ink-subtle">TTF, OTF, WOFF or WOFF2</span>}
      </button>

      {error && <p className="col-span-full text-[12px] font-medium text-danger">{error}</p>}

      <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" className="hidden" onChange={onFile} />
    </>
  );
}
