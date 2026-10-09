import { useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { downloadPokemonImage } from "@/lib/games/pokemon-image";

export function PokemonImageDownload({ id, name }: { id: number; name: string }) {
  const t = useT(), request = useRef<AbortController | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  useEffect(() => () => request.current?.abort(), []);
  const download = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setState("busy");
    try { const saved = await downloadPokemonImage(id, controller.signal); if (!controller.signal.aborted) setState(saved ? "done" : "idle"); }
    catch { if (!controller.signal.aborted) setState("error"); }
    finally { if (request.current === controller) request.current = null; }
  };
  return <><button className="pokemon-image-download" disabled={state === "busy"} onClick={() => void download()}
    aria-label={t(state === "done" ? "games.pokemon.imageSaved" : "games.pokemon.downloadImage", { name })}
    title={t("games.pokemon.downloadImage", { name })}>
    {state === "busy" ? <LoaderCircle className="pokemon-download-spinner" size={19}/> : state === "done" ? <Check size={19}/> : <Download size={19}/>}
  </button>{state === "error" && <span className="pokemon-image-error" role="alert">{t("games.pokemon.imageFailed")}</span>}</>;
}
