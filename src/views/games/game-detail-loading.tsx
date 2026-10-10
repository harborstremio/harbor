import { useT } from "@/lib/i18n";

export function DetailLoading({ kind }: { kind: "page" | "activity" | "achievements" | "ratings" | "speedrun" | "copy" }) {
  const t = useT();
  const bar = (width = "100%", height = 13) => <i className="games-detail-skeleton" style={{ width, height }} />;
  if (kind === "page") return <div className="games-detail-body games-inset games-detail-loading" aria-label={t("common.loading")} aria-busy="true">
    <div className="games-detail-main" aria-hidden="true"><div className="games-gallery"><div className="games-gallery-stage games-detail-skeleton"/><div className="games-loading-thumbnails">{[0,1,2,3,4,5].map(n => <i className="games-detail-skeleton" key={n}/>)}</div></div><div className="games-about"><DetailLoading kind="copy"/></div></div>
    <aside className="games-detail-dossier" aria-hidden="true"><div className="games-loading-heading">{bar("48%",24)}</div><div className="games-loading-tags">{bar("24%",32)}{bar("32%",32)}</div><DetailLoading kind="activity"/>
      {[0,1,2,3,4,5].map(index => <div className="games-loading-disclosure" key={index}><div className="games-loading-disclosure-heading">{bar("22px",22)}{bar(index === 1 ? "45%" : "64%",17)}{bar("16px",16)}</div>{index === 0 && <div className="games-loading-disclosure-content"><div className="games-loading-controller">{bar("76px",56)}<div>{bar("80%",16)}{bar("60%")}{bar("95%")}</div></div>{bar("100%",20)}</div>}{index === 2 && <div className="games-loading-disclosure-content"><DetailLoading kind="achievements"/></div>}</div>)}
    </aside>
  </div>;
  return <div className={`games-loading-${kind}`} aria-label={t("common.loading")} aria-busy="true">
    {kind === "activity" ? <>{bar("36px",36)}<div>{bar("65%",32)}{bar("80%",12)}</div></> : kind === "achievements" ? <>{bar("44%",16)}<div>{[0,1,2,3,4].map(n => <i className="games-detail-skeleton" key={n}/>)}</div>{bar("30%",12)}</> : kind === "ratings" ? <>{bar("30%",16)}{[0,1].map(n => <div key={n}>{bar("34px",34)}{bar("45%",14)}{bar("42px",28)}</div>)}</> : kind === "speedrun" ? <>{bar("100%",38)}{bar("60%",35)}{bar("40%",14)}</> : <>{bar("96%",15)}{bar("100%",15)}{bar("78%",15)}</>}
  </div>;
}
