import { useState } from "react";
import codes from "@/lib/games/sims-pack-art.json";
import { ModGameMark } from "./mod-identity";

export function SimsPackIcon({ code }: { code?: string }) {
  const [failed, setFailed] = useState("");
  const file = code && Object.hasOwn(codes, code) ? codes[code as keyof typeof codes] : null;
  return <span className="sims-pack-icon" aria-hidden="true">{code && file && failed !== code ? <img src={`/games/mods/packs/${file}`} alt="" width={30} height={34} loading="lazy" decoding="async" onError={() => setFailed(code)}/> : <ModGameMark game="sims4"/>}</span>;
}
