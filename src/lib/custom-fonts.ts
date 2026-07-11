import { useState } from "react";

import { useSettings } from "./settings";
import { randomUuid } from "./uuid";

const EXT_FORMAT: Record<string, string> = {
  ttf: "truetype",
  otf: "opentype",
  woff: "woff",
  woff2: "woff2",
};

const MAX_BYTES = 8 * 1024 * 1024;

export function useCustomFonts() {
  const { settings, update } = useSettings();
  const fonts = settings.customFonts ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFont = async (file: File): Promise<string | null> => {
    setError(null);
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const format = EXT_FORMAT[ext];
    if (!format) {
      setError("Use a TTF, OTF, WOFF or WOFF2 file.");
      return null;
    }
    if (file.size > MAX_BYTES) {
      setError("That font is over 8 MB. Try a lighter file.");
      return null;
    }
    setBusy(true);
    try {
      const dataUrl = await readDataUrl(file);
      const id = randomUuid().slice(0, 8);
      await new FontFace(`harbor-font-${id}`, `url(${dataUrl})`, { display: "swap" }).load();
      update({ customFonts: [...fonts, { id, name: prettyName(file.name), dataUrl, format }] });
      return id;
    } catch {
      setError("That file is not a valid font.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const removeFont = (id: string) => {
    update({ customFonts: fonts.filter((f) => f.id !== id) });
  };

  return { fonts, busy, error, addFont, removeFont, clearError: () => setError(null) };
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function prettyName(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base.slice(0, 36) : "Custom font";
}
