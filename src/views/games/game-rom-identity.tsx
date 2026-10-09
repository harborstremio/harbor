import { useState } from "react";

/** Keep the real title readable while a publisher wordmark loads or fails. */
export function RomGameIdentity({ name, logo }: { name: string; logo?: string }) {
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const ready = !!logo && loaded === logo && failed !== logo;

  return <div className={`games-rom-identity${logo ? " has-logo" : ""}`}>
    {logo && failed !== logo && <img src={logo} alt="" decoding="async" className={ready ? "is-ready" : undefined}
      onLoad={() => setLoaded(logo)} onError={() => setFailed(logo)} />}
    <h2 className={ready ? "sr-only" : undefined}>{name}</h2>
  </div>;
}
