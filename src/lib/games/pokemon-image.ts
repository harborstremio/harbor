import { safeFetchBytes } from "@/lib/safe-fetch";
import { pokemonArt } from "./pokemon-games";

/** Download only the selected official artwork, never a provider-supplied path. */
export async function downloadPokemonImage(id: number, signal: AbortSignal) {
  if (!Number.isSafeInteger(id) || id < 1 || id > 10000) throw Error("Invalid Pokémon");
  const response = await safeFetchBytes(pokemonArt(id), { signal }, 15_000, 2_000_000);
  if (!response.ok) throw Error("Image unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 2_000_000 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw Error("Invalid PNG");
  signal.throwIfAborted();
  const filename = `pokemon-${String(id).padStart(3, "0")}.png`;
  if ("__TAURI_INTERNALS__" in window) {
    const { save } = await import("@tauri-apps/plugin-dialog"), { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename, filters: [{ name: "PNG", extensions: ["png"] }] });
    signal.throwIfAborted();
    if (!path) return false;
    await writeFile(path, bytes);
  } else {
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" })), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}
