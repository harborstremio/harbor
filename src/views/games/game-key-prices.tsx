import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Globe2, KeyRound, RefreshCw, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useSectionBack } from "@/lib/section-back";
import { loadKeyPrices } from "@/lib/games/key-prices";
import { filterPriceOffers, priceLabel, type GamePriceComparison } from "@/lib/games/key-price-data";
import { useAccountDialogFocus } from "./game-steam-account";
import { GameArt } from "./game-art";
import { SteamMark } from "./game-detail-marks";
import { GameKeyShops } from "./game-key-shops";
import "./game-key-prices.css";
import { GameHumbleBundles } from './game-humble-bundles';

type PriceState = { data: GamePriceComparison | null; pending: boolean; failed: boolean };

function PriceSkeleton() {
  return <div className="games-price-skeleton" aria-hidden="true"><i className="games-skeleton"/><span><i className="games-skeleton"/><i className="games-skeleton"/></span><i className="games-skeleton"/></div>;
}

export function GameKeyPrices({ appId, name, artwork, active, onOpenChange, steamPrice }: {
  appId: number; name: string; artwork: string; active: boolean; onOpenChange: (open: boolean) => void;
  steamPrice?: { amount: number; currency: string; discount: number };
}) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [open, setOpen] = useState(false), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PriceState>({ data: null, pending: true, failed: false });
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "150px" });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => { onOpenChange(open); return () => onOpenChange(false); }, [open, onOpenChange]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController();
    setState(previous => ({ ...previous, pending: true, failed: false }));
    void loadKeyPrices(appId, request.signal, attempt > 0).then(data => {
      if (!request.signal.aborted) setState({ data, pending: false, failed: false });
    }, () => { if (!request.signal.aborted) setState(previous => ({ ...previous, pending: false, failed: true })); });
    return () => request.abort();
  }, [appId, active, visible, attempt]);
  const offers = filterPriceOffers(state.data?.offers ?? [], "all", "steam"), best = offers[0];
  return <div className="games-key-prices" ref={root}>
    <GameHumbleBundles name={name} active={active && visible}/>
    <button className="games-key-price-summary" onClick={() => { setVisible(true); setOpen(true); }} aria-haspopup="dialog">
      <span className="games-key-price-heading"><KeyRound size={22}/><span>{t("games.prices.title")}</span><ChevronRight size={22}/></span>
      {state.pending && !state.data ? <span className="games-key-price-loading"><i className="games-skeleton"/><i className="games-skeleton"/></span> : <span className="games-key-price-value"><strong>{best ? priceLabel(best.amount, language) : t("games.prices.find")}</strong><small>{best ? t("games.prices.from", { store: best.store.name }) : t(state.failed ? "games.prices.unavailableShort" : "games.prices.emptyShort")}</small></span>}
      <span className="games-key-price-caption">{t(best ? "games.prices.lowestCaption" : "games.prices.browseCaption")}</span>
    </button>
    {steamPrice && <a className="games-price-steam-benchmark" href={`https://store.steampowered.com/app/${appId}/`} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(`https://store.steampowered.com/app/${appId}/`); }}><SteamMark/><span>Steam<small>{t("games.details.storeRegion")}</small></span>{steamPrice.discount > 0 && <b className="games-price-sale" aria-label={t("games.prices.steamSale", { discount: steamPrice.discount })}>−{steamPrice.discount}%</b>}<strong>{new Intl.NumberFormat(language, { style: "currency", currency: steamPrice.currency }).format(steamPrice.amount / 100)}</strong></a>}
    {open && active && <PriceComparison appId={appId} name={name} artwork={artwork} state={state} refresh={() => setAttempt(value => value + 1)} onClose={() => setOpen(false)}/>}
  </div>;
}

function PriceComparison({ appId, name, artwork, state, refresh, onClose }: {
  appId: number; name: string; artwork: string; state: PriceState; refresh: () => void; onClose: () => void;
}) {
  const t = useT(), language = useUiLanguage(), titleId = useId(), root = useAccountDialogFocus(), { closing, close } = useModalExit(onClose);
  const [store, setStore] = useState("all"), [activation, setActivation] = useState<"steam" | "all">("steam");
  const [directory, setDirectory] = useState(false), directoryButton = useRef<HTMLButtonElement>(null), directoryBack = useRef<HTMLButtonElement>(null), scroll = useRef<HTMLDivElement>(null), priceScroll = useRef(0);
  const leaveDirectory = () => { setDirectory(false); requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = priceScroll.current; directoryButton.current?.focus({ preventScroll: true }); }); };
  const back = () => directory ? leaveDirectory() : close();
  useSectionBack(back, true);
  const all = state.data?.offers ?? [], offers = filterPriceOffers(all, store, activation), best = offers[0];
  const stores = [...new Map(filterPriceOffers(all, "all", activation).map(offer => [offer.store.id, offer.store])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return <ModalShell closing={closing} onDismiss={back} width={830} labelledBy={titleId} backdropClassName="games-prices-backdrop">
    <div className="games-price-comparison" ref={root} tabIndex={-1}>
      <header className="games-price-modal-heading">{directory ? <button className="games-price-close" ref={directoryBack} onClick={leaveDirectory} aria-label={t("games.shops.back")}><ArrowLeft size={24}/></button> : <GameArt src={artwork}/>}<div><h2 id={titleId}>{t(directory ? "games.prices.keyshops" : "games.prices.title")}</h2><p>{name}</p></div><button className="games-price-close" onClick={close} aria-label={t("common.close")}><X size={24}/></button></header>
      <div className="games-price-modal-scroll" ref={scroll}>
        {directory ? <GameKeyShops appId={appId} name={name}/> : <>
        <div className="games-price-overview">
          <div><span>{t("games.prices.lowest")}</span>{state.pending && !state.data ? <i className="games-skeleton"/> : <strong>{best ? priceLabel(best.amount, language) : "—"}</strong>}<small>{best ? t("games.prices.from", { store: best.store.name }) : t("games.prices.noMatching")}</small></div>
          <div className="games-price-market"><Globe2 size={22}/><div><b>{t("games.prices.market")}</b><span>{t("games.prices.region")}</span></div></div>
        </div>
        <button className="games-price-more" ref={directoryButton} onClick={() => { priceScroll.current = scroll.current?.scrollTop ?? 0; setDirectory(true); requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = 0; directoryBack.current?.focus({ preventScroll: true }); }); }}><KeyRound size={24}/><span><strong>{t("games.prices.keyshops")}</strong><small>{t("games.prices.keyshopsHint")}</small></span><ChevronRight size={22}/></button>
        <div className="games-price-filters">
          <label><span>{t("games.prices.activation")}</span><Dropdown ariaLabel={t("games.prices.activation")} value={activation} options={[{ value: "steam", label: t("games.prices.steamOffers") }, { value: "all", label: t("games.prices.allPc") }]} onChange={value => { setActivation(value as "steam" | "all"); setStore("all"); }}/></label>
          <label><span>{t("games.prices.seller")}</span><Dropdown ariaLabel={t("games.prices.seller")} value={store} options={[{ value: "all", label: t("games.prices.allStores") }, ...stores.map(item => ({ value: item.id, label: item.name, left: item.logo ? <img className="games-price-option-logo" src={item.logo} alt=""/> : undefined }))]} onChange={setStore}/></label>
          <button className="games-price-refresh" disabled={state.pending} onClick={refresh} aria-label={t("games.prices.refresh")}><RefreshCw size={19}/></button>
        </div>
        <p className="games-price-filter-hint">{t(activation === "steam" ? "games.prices.steamHint" : "games.prices.allHint")}</p>
        {state.failed && <div className="games-price-message" role="status">{t(state.data ? "games.prices.refreshError" : "games.prices.error")}</div>}
        <div className="games-price-results" aria-busy={state.pending}>
          <div className="games-price-results-heading"><span>{t("games.prices.offerCount", { count: offers.length })}</span><span>{t("games.prices.priceOrder")}</span></div>
          {state.pending && !state.data ? <>{[0, 1, 2].map(key => <PriceSkeleton key={key}/>)}</> : offers.length ? offers.map(offer => <article className="games-price-offer" key={offer.id}>
            {offer.store.logo ? <img className="games-price-store-logo" src={offer.store.logo} alt="" loading="lazy"/> : <KeyRound className="games-price-store-logo" size={28}/>}
            <div className="games-price-offer-copy"><h3>{offer.store.name}</h3><p>{offer.title}</p><span>{t(offer.activation === "steam" ? "games.prices.steamPurchase" : offer.activation === "reported-steam" ? "games.prices.steamReported" : "games.prices.checkActivation")}</span></div>
            <div className="games-price-offer-price"><strong>{priceLabel(offer.amount, language)}</strong>{offer.regular !== null && offer.regular > offer.amount && <del>{priceLabel(offer.regular, language)}</del>}</div>
            <a className="games-button" href={offer.url} target="_blank" rel="noreferrer" aria-label={t("games.prices.viewAt", { store: offer.store.name })} onClick={event => { event.preventDefault(); openUrl(offer.url); }}>{t("games.prices.view")}</a>
          </article>) : !state.failed && <div className="games-price-message">{t("games.prices.noMatching")}</div>}
        </div>
        <p className="games-price-coverage">{t("games.prices.coverage")}{state.data?.partial && <> {t("games.prices.partial")}</>}</p>
        </>}
      </div>
      <footer className="games-price-footer">{directory ? <span>{t("games.shops.footer")}</span> : <><a href="https://www.cheapshark.com/" target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl("https://www.cheapshark.com/"); }}>{t("games.prices.source")}</a><span>{state.data ? t("games.prices.checked", { time: new Date(state.data.checkedAt).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" }) }) : "USD"}</span></>}</footer>
    </div>
  </ModalShell>;
}
