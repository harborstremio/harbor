import { useSettings } from "@/lib/settings";
import { artworkImportPolicy } from "@/lib/games/imported-artwork";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ImageOff, RotateCcw, Shuffle, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { loadAtlasGame } from "@/lib/games/atlas";
import type { AtlasGame } from "@/lib/games/igdb-data";
import { backgroundArtwork, igdbArtworkUrl, matchingLibraryArtwork, randomArtwork, type IgdbArtwork, type LibraryArtwork } from "@/lib/games/igdb-artwork";
import type { GameSummary } from "@/lib/games/types";
import "./game-artwork-picker.css";

export function GameArtworkPicker({ game, binding, value, localCover, error, onSave, onClose, screenshots, allowReset = true }: {
  game: GameSummary; binding: string; value?: LibraryArtwork; localCover?: boolean; error?: string; screenshots?: boolean; allowReset?: boolean;
  onSave: (value: LibraryArtwork | null) => Promise<boolean>; onClose: () => void;
}) {
  const t = useT(), {settings}=useSettings(), title = useId(), root = useRef<HTMLDivElement>(null);
  const { closing, close } = useModalExit(onClose);
  const [draft, setDraft] = useState(() => matchingLibraryArtwork(value, binding));
  const [tab, setTab] = useState<"cover" | "background">("background");
  const [result, setResult] = useState<AtlasGame | null>(null), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0), [saving, setSaving] = useState(false), [saveFailed, setSaveFailed] = useState(false);
  const [broken, setBroken] = useState<string[]>([]), pending = useRef(false);
  const dismiss = () => { if (!pending.current) close(); };
  useSectionBack(dismiss, true);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !root.current) return;
      const items = [...root.current.querySelectorAll<HTMLElement>("button:not(:disabled)")].filter(item => item.getClientRects().length);
      if (event.shiftKey && (document.activeElement === items[0] || !root.current.contains(document.activeElement))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === items.at(-1) || !root.current.contains(document.activeElement))) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true); setFailed(false); setResult(null); setBroken([]);
    void loadAtlasGame(game, request.signal).then(next => { if (!request.signal.aborted) { setResult(next); setDraft(previous => previous?.igdbId === next?.igdbId ? previous : undefined); setLoading(false); } }, () => { if (!request.signal.aborted) { setFailed(true); setLoading(false); } });
    return () => request.abort();
  }, [game.id, game.igdbId, game.steamId, game.catalogSteamId, attempt]);
  const catalog = result?.artwork ?? [], backgrounds = backgroundArtwork(catalog, screenshots ?? artworkImportPolicy(settings).screenshots);
  const images = tab === "cover" ? catalog.filter(image => image.kind === "cover") : backgrounds;
  const availableImages = images.filter(image => !broken.includes(image.imageId));
  const chosen = draft?.[tab];
  const choose = (image?: IgdbArtwork) => {
    if (!result || pending.current) return;
    setDraft(previous => ({ ...previous, binding, igdbId: result.igdbId, [tab]: image })); setSaveFailed(false);
  };
  const apply = async (reset = false) => {
    if (pending.current) return;
    pending.current = true; setSaving(true); setSaveFailed(false);
    try { if (await onSave(reset || !draft?.cover && !draft?.background ? null : draft!)) close(); else setSaveFailed(true); }
    catch { setSaveFailed(true); }
    finally { pending.current = false; setSaving(false); }
  };
  const dimensions = (image: IgdbArtwork) => image.width && image.height ? `${image.width.toLocaleString()} × ${image.height.toLocaleString()}` : t("games.artwork.unknownSize");
  const currentPreview = chosen ? igdbArtworkUrl(chosen) : tab === "cover" ? game.portrait || game.capsule : game.capsule;
  const selectedBroken = [draft?.cover, draft?.background].some(image => image && broken.includes(image.imageId));
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={840} backdropClassName="games-artwork-backdrop">
    <div className="games-artwork-picker" ref={root}>
      <header><div><h2 id={title}>{t("games.artwork.title")}</h2><p>{game.name} · IGDB</p></div><button className="games-icon-button" aria-label={t("common.close")} disabled={saving} onClick={dismiss}><X size={22}/></button></header>
        <div className="games-artwork-tabs">{(["background", "cover"] as const).map(kind => <button key={kind} aria-pressed={kind === tab} disabled={saving} onClick={() => setTab(kind)}>{t(`games.artwork.${kind}`)}</button>)}</div>
      <div className="games-artwork-scroll" aria-busy={loading}>

        {loading ? <div className="games-artwork-state" role="status">{t("common.loading")}</div> : failed ? <div className="games-artwork-state" role="alert"><p>{t("games.atlas.error")}</p><button className="games-button" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></div> : !result ? <div className="games-artwork-state"><p>{t("games.artwork.noMatch")}</p></div> : <>
          <div className="games-artwork-preview" data-kind={tab}>{currentPreview && !(chosen && broken.includes(chosen.imageId)) ? <img key={currentPreview} src={currentPreview} alt="" onError={() => { if (chosen) setBroken(previous => [...previous, chosen.imageId]); }}/>:<ImageOff size={36}/>}<span dir={chosen?.width && chosen.height ? "ltr" : "auto"}>{chosen ? dimensions(chosen) : t("games.artwork.original")}</span></div>
          {localCover && tab === "cover" && <p className="games-artwork-note">{t("games.artwork.localCover")}</p>}
          <div className="games-artwork-actions"><p>{t("games.artwork.choose", { count: images.length })}</p>{tab === "background" && !!images.length && <div><button className="games-button" disabled={saving || !availableImages.length} onClick={() => choose(availableImages[0])}>{t("games.artwork.first")}</button><button className="games-button" disabled={saving || !availableImages.length} onClick={() => choose(randomArtwork(availableImages))}><Shuffle size={17}/>{t("games.artwork.random")}</button></div>}</div>
          {tab === "background" && backgrounds[0]?.kind === "screenshot" && <p className="games-artwork-note">{t("games.artwork.screenshotFallback")}</p>}
          <div className="games-artwork-options" data-kind={tab}><button className="games-artwork-original" aria-pressed={!chosen} disabled={saving} onClick={() => choose()}><RotateCcw size={25}/><strong>{t("games.artwork.original")}</strong></button>{images.map((image, index) => <button key={image.imageId} aria-pressed={chosen?.imageId === image.imageId} disabled={saving || broken.includes(image.imageId)} onClick={() => choose(image)} aria-label={`${t(`games.artwork.${tab}`)} ${index + 1} · ${dimensions(image)}`}><span className="games-artwork-thumb">{broken.includes(image.imageId) ? <ImageOff size={24}/> : <img key={`${attempt}:${image.imageId}`} src={igdbArtworkUrl(image, true)} alt="" loading="lazy" onError={() => setBroken(previous => [...previous, image.imageId])}/>}<i>{chosen?.imageId === image.imageId && <Check size={16}/>}</i></span><strong dir={image.width && image.height ? "ltr" : "auto"}>{dimensions(image)}</strong></button>)}</div>
          {!images.length && <p className="games-artwork-note">{t("games.artwork.empty")}</p>}
          {!!broken.length && <div className="games-artwork-image-error" role="status"><span>{t("games.artwork.imageError")}</span><button className="games-button" onClick={() => setAttempt(value => value + 1)} disabled={saving}>{t("common.retry")}</button></div>}
        </>}
      </div>
      {saveFailed && <p className="games-artwork-error" role="alert">{t(error || "games.saveError")}</p>}
      <footer>{allowReset ? <button className="games-button" disabled={saving || !value} onClick={() => void apply(true)}><RotateCcw size={17}/>{t("games.artwork.reset")}</button> : <span/>}<div><button className="games-button" disabled={saving} onClick={dismiss}>{t("common.cancel")}</button><button className="games-button games-button-primary" disabled={saving || loading || failed || !result || selectedBroken} onClick={() => void apply()}><Check size={19}/>{t(saving ? "common.loading" : "common.save")}</button></div></footer>
    </div>
  </ModalShell>;
}
