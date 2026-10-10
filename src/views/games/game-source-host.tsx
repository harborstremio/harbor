import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, Globe2, RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { SourceLinkProvider } from "@/lib/games/source-links";
import type { HostCheck } from "@/lib/games/source-hosts";
import { transferBytes } from "@/lib/games/transfers";
import "./game-source-host.css";

export function GameSourceHost({ provider, apiKey, url, available }: {
  provider: SourceLinkProvider; apiKey: string; url: string; available: boolean;
}) {
  const t = useT(), id = useId(), language = useUiLanguage();
  const [open, setOpen] = useState(false), [value, setValue] = useState<HostCheck | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const pending = useRef(false), button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let current = true; pending.current = false;
    if (!open || !available) return;
    setValue(null); setError(""); setImageFailed(false);
    pending.current = true; setLoading(true);
    // Read the service's directory only; the source URL is never fetched or submitted.
    void invoke<HostCheck>("games_cloud_host_check", { args: { provider, key: apiKey, url } })
      .then(result => { if (current) setValue(result); })
      .catch(reason => { if (current) { const code = reason instanceof Error ? reason.message : String(reason); setError(`games.sources.host.${code === "cloud_key" ? "account" : code === "cloud_rate_limit" ? "rate" : "error"}`); } })
      .finally(() => { if (current) { pending.current = false; setLoading(false); } });
    return () => { current = false; };
  }, [open, available, provider, apiKey, url, retry]);
  if (!available) return null;
  const amount = (n: number, unit: string) => unit === "bytes" ? transferBytes(n) : new Intl.NumberFormat(language).format(n);
  return <section className="games-host-check">
    <div className="games-host-heading">
      <button ref={button} className="games-host-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
        <Globe2 size={15}/><span>{t("games.sources.host.check")}</span><ChevronDown size={14}/>
      </button>
      {open && <button className="games-icon-button" aria-label={t("games.sources.host.refresh")} aria-disabled={loading} onClick={() => { if (!pending.current) setRetry(v => v + 1); }}><RefreshCw size={14}/></button>}
    </div>
    <div className="games-host-reveal" data-open={open} inert={!open} aria-hidden={!open}>
      <div><div id={id} className="games-host-details" aria-busy={loading}>
        {loading ? <div className="games-host-loading" role="status" aria-label={t("common.loading")}><i/><span/><span/></div> : error ? <div role="alert" className="games-host-error"><span>{t(error)}</span><button className="games-button" onClick={() => { button.current?.focus({preventScroll:true}); setRetry(v => v + 1); }}>{t("common.retry")}</button></div> : value && <>
          <div className="games-host-identity">
            {value.icon && !imageFailed ? <img src={value.icon} alt="" width={28} height={28} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/> : <Globe2 size={25}/>}
            <div><strong>{value.name}</strong><span className={`games-host-state is-${value.state}`}><i/>{t(`games.sources.host.${value.state}`)}</span></div>
          </div>
          {value.note && <p className="games-host-note">{value.note}</p>}
          {(value.allowances.length > 0 || value.maxFileBytes || value.costFactor !== null) && <dl className="games-host-allowances">
            {value.allowances.map((quota, index) => <div key={`${quota.unit}:${index}`}><dt>{t(`games.sources.host.${quota.unit === "bytes" ? "data" : "downloads"}`)} · {t(`games.sources.host.${quota.period}`)}</dt><dd>{quota.remaining === null ? t("games.sources.host.cap", { limit: quota.limit === null ? "—" : amount(quota.limit, quota.unit) }) : quota.limit === null ? t("games.sources.host.left", { left: amount(quota.remaining, quota.unit) }) : t("games.sources.host.remaining", { left: amount(quota.remaining, quota.unit), total: amount(quota.limit, quota.unit) })}</dd></div>)}
            {!!value.maxFileBytes && <div><dt>{t("games.sources.host.file")}</dt><dd>{transferBytes(value.maxFileBytes)}</dd></div>}
            {value.costFactor !== null && <div><dt>{t("games.sources.host.cost")}</dt><dd>×{new Intl.NumberFormat(language).format(value.costFactor)}</dd></div>}
          </dl>}
          {value.limitsUnavailable && <p>{t("games.sources.host.limitsUnavailable")}</p>}
          <small>{t("games.sources.host.checked", { time: new Date(value.checkedAt).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" }) })}</small>
          <p className="games-host-context">{t(value.state === "queue" ? "games.sources.host.queueNote" : value.state === "unknown" ? "games.sources.host.unknownNote" : "games.sources.host.fileNote")}</p>
        </>}
      </div></div>
    </div>
  </section>;
}
