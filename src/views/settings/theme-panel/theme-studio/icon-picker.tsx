import { Ban, Upload } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { CHROME_ICONS } from "./chrome-icons";

export function IconPicker({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (v: string | null) => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? CHROME_ICONS.filter((c) => c.id.includes(s)) : CHROME_ICONS;
  }, [q]);

  const onFile = async (file: File) => {
    const url = await rasterize(file);
    if (url) onSelect(url);
  };

  const caption =
    hover === "__none"
      ? t("No icon (text only)")
      : hover === "__upload"
        ? t("Upload your own image")
        : hover
          ? t(hover.replace(/-/g, " "))
          : t("{count} icons, or upload your own", { count: CHROME_ICONS.length });

  return (
    <div className="flex flex-col gap-2 border-t border-edge-soft px-2.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <div className="flex h-8 flex-1 items-center gap-1.5 rounded-md border border-edge-soft bg-canvas px-2 transition-colors focus-within:border-accent">
          <Search size={14} className="shrink-0 text-ink-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search icons")}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onMouseEnter={() => setHover("__upload")}
          onMouseLeave={() => setHover(null)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium text-ink-muted transition-colors hover: hover:text-ink transition-colors focus:bg-elevated"
        >
          <Upload size={14} strokeWidth={2} />
          {t("Upload")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid max-h-[208px] grid-cols-7 gap-1 overflow-y-auto [scrollbar-width:thin]">
        <Tile
          active={!value}
          label={t("No icon (text only)")}
          onHover={(on) => setHover(on ? "__none" : null)}
          onClick={() => onSelect(null)}
        >
          <Ban size={16} strokeWidth={2} />
        </Tile>
        {filtered.map(({ id, Icon }) => (
          <Tile
            key={id}
            label={t(id.replace(/-/g, " "))}
            active={value === id}
            onHover={(on) => setHover(on ? id : null)}
            onClick={() => onSelect(id)}
          >
            <Icon size={18} strokeWidth={2} />
          </Tile>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-7 px-1 py-3 text-center text-[12.5px] text-ink-subtle">
            {t("No icons match that search. Try Upload.")}
          </p>
        )}
      </div>

      <div className="flex h-5 items-center px-0.5 text-[11.5px] capitalize text-ink-subtle">
        {caption}
      </div>
    </div>
  );
}

function Tile({
  active,
  label,
  onClick,
  onHover,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onHover: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-label={label}
      className={`flex aspect-square items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-accent bg-accent-soft text-ink"
          : "border-edge-soft text-ink-muted hover:border-edge hover:bg-canvas hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function rasterize(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx || !img.width || !img.height) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
