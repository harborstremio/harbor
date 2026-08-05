import { loadFontData } from "@/lib/font-storage";

const DISK_EXT: Record<string, string> = { truetype: "ttf", opentype: "otf" };

type CustomFont = { id: string; name: string; format: string; family?: string };

export async function syncSubFontsToDisk(fonts: CustomFont[]): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  const usable = fonts.filter((f) => DISK_EXT[f.format]);
  const { invoke } = await import("@tauri-apps/api/core");
  const onDisk = await invoke<string[]>("list_sub_fonts").catch(() => null);
  if (!onDisk) return;
  for (const id of onDisk) {
    if (usable.some((f) => f.id === id)) continue;
    await invoke("remove_sub_font", { id }).catch(() => {});
  }
  for (const f of usable) {
    if (onDisk.includes(f.id)) continue;
    const dataUrl = await loadFontData(f.id);
    const comma = dataUrl?.indexOf(",") ?? -1;
    if (!dataUrl || comma < 0 || !dataUrl.slice(0, comma).includes(";base64")) continue;
    await invoke("install_sub_font", {
      id: f.id,
      ext: DISK_EXT[f.format],
      base64: dataUrl.slice(comma + 1),
    }).catch((e) => console.warn("[fonts] install_sub_font failed", f.id, e));
  }
}
