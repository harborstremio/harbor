import { GameHackFiles } from "./game-hack-files";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Download, Check, File, FolderOpen, LoaderCircle, X } from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { useSectionBack } from "@/lib/section-back";
import { GAME_FILE_EXTENSIONS, fileName, patchErrorKey, type PatchPlan, type PatchReceipt } from "@/lib/games/patching";
import { GameMark } from "./game-ui";
import "./game-patch.css";
import { useOptionalGameAccess } from './game-access';
import { embeddedSystemForPath } from '@/lib/games/embedded-emulation';
import { hackRelease } from '@/lib/games/hack-catalog';
import { localGames } from '@/lib/games/emulation';
import { GameArt } from './game-art';
import type { GameSummary } from '@/lib/games/types';

type PatchGame = GameSummary & { projectUrl?: string; parent?: GameSummary };
type DownloadReview = { files: {name:string;path:string;bytes:number;sha256:string}[]; links:{name:string;url:string}[];notes:string[] };
export function GamePatchLauncher({ game, className = "" }: { game?: PatchGame; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return <><button className={`games-button ${className}`} onClick={() => setOpen(true)}><GameMark kind="create" size={18} />{t(game ? "games.hub.getFiles" : "games.patch.open")}</button>{open && <GamePatchModal game={game} onClose={() => setOpen(false)} />}</>;
}

function GamePatchModal({ onClose, game }: { onClose: () => void; game?: PatchGame }) {
  const t = useT();
  const access = useOptionalGameAccess();
  const titleId = useId();
  const desktop = isTauri() && ["windows", "macos", "linux"].includes(osClass());
  const { closing, close } = useModalExit(onClose);
  const [source, setSource] = useState("");
  const [patch, setPatch] = useState("");
  const release=game?hackRelease(game):undefined;
  const pack=release?.method==='modpack';
  const candidates=access?localGames(access.emulation.data).filter(item=>item.available && (!game?.parent?.igdbId || item.linked?.igdbId===game.parent.igdbId)):[];
  const [sourceMatches,setSourceMatches]=useState<string[]>([]);
  const [downloadReview,setDownloadReview]=useState<DownloadReview>();
  const [downloadUrl,setDownloadUrl]=useState('');
  const [downloadBusy,setDownloadBusy]=useState(false),[downloadError,setDownloadError]=useState('');
  const [plan, setPlan] = useState<PatchPlan | null>(null);
  const [receipt, setReceipt] = useState<PatchReceipt | null>(null);
  const embeddedSystem = receipt ? embeddedSystemForPath(receipt.path) : null;
  const [added,setAdded]=useState(false);
  const outputGame=receipt&&embeddedSystem!==null?{path:receipt.path,root:receipt.path.replace(/[\\/][^\\/]+$/,''),name:game?.name??fileName(receipt.path),sizeBytes:receipt.bytes,system:embeddedSystem,format:receipt.path.split('.').at(-1)??'',available:true,discs:1}:null;
  const addPatched=()=>{if(outputGame&&access){const success=access.emulation.addOutput(outputGame,game);setAdded(success);if(!success)setError('games.emulation.failed');return success;}return false;};
  const playPatched = () => {
    if (!outputGame || !access || (!added&&!addPatched())) return;
    onClose();
    void access.emulation.launch(outputGame);
  };
  const [busy, setBusy] = useState<"choose" | "verify" | "save" | null>(null);
  const [error, setError] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const live = useRef(true);
  const token = useRef("");
  const downloadId=useRef("");
  const matchRequest=useRef(0);
  const selectPatch=async(path:string)=>{
    const request=++matchRequest.current;
    discard();setPlan(null);setReceipt(null);setAdded(false);setError('');setPatch(path);setSourceMatches([]);
    const available=access?localGames(access.emulation.data).filter(item=>item.available):[];
    const paths=[...available].sort((a,b)=>Number(b.linked?.igdbId===game?.parent?.igdbId)-Number(a.linked?.igdbId===game?.parent?.igdbId)).map(item=>item.path);
    if(!paths.length)return;
    try{
      const matches=await invoke<string[]>('games_match_patch_sources',{patchPath:path,paths:paths.slice(0,32)});
      if(live.current&&request===matchRequest.current){setSourceMatches(matches);if(matches.length===1)setSource(matches[0]);}
    }catch{/* Manual selection and verification remain available if matching fails. */}
  };
  const cancelDownload=()=>{if(downloadId.current){void invoke("games_cancel_patch_download",{id:downloadId.current}).catch(()=>{});downloadId.current="";}};
  const dismiss = () => { if (busy !== "save") close(); };
  useSectionBack(dismiss, true);
  const discard = () => { if (token.current) { void invoke("games_discard_patch", { token: token.current }).catch(() => {}); token.current = ""; } };
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = content.current?.closest<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), summary')].filter(item => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { live.current = false; cancelDownload(); discard(); document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (closing) { live.current = false; cancelDownload(); discard(); } }, [closing]);
  const acquire = async (url:string) => {
    if(downloadBusy || busy)return;
    setDownloadBusy(true);setDownloadError('');
    try {
      const id=crypto.randomUUID();downloadId.current=id;
      const result=await invoke<DownloadReview>('games_download_patch',{url,id});
      if(!live.current)return;
      setDownloadReview(result);
      if(result.files.length===1)await selectPatch(result.files[0].path);
      if(!result.files.length&&!result.links.length)setDownloadError('games.hub.noDownload');
    }catch(error){if(live.current)setDownloadError(String(error)==='patch_download_empty'?'games.hub.noDownload':'games.hub.downloadFailed');}
    finally{downloadId.current="";if(live.current)setDownloadBusy(false);}
  };
  const choose = async (kind: "source" | "patch") => {
    if (busy) return;
    setBusy("choose"); setError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ multiple: false, directory: false, title: t(kind === "source" ? "games.patch.chooseGame" : "games.patch.choosePatch"), filters: [{ name: t(kind === "source" ? "games.patch.gameFile" : "games.patch.patchFile"), extensions: kind === "source" ? GAME_FILE_EXTENSIONS : ["bps", "ips", "ups"] }] });
      if (typeof path === "string" && live.current) { if(kind==='patch')await selectPatch(path);else{++matchRequest.current;discard();setPlan(null);setReceipt(null);setAdded(false);setSource(path);} }
    } catch (error) { if (live.current) setError(patchErrorKey(error)); }
    finally { if (live.current) setBusy(null); }
  };
  const verify = async () => {
    if (busy || !source || !patch) return;
    ++matchRequest.current;
    setBusy("verify"); setError("");
    try {
      const result = await invoke<PatchPlan>("games_prepare_patch", { sourcePath: source, patchPath: patch });
      if (!live.current) { void invoke("games_discard_patch", { token: result.token }).catch(() => {}); return; }
      token.current = result.token; setPlan(result);
    } catch (error) { if (live.current) setError(patchErrorKey(error)); }
    finally { if (live.current) setBusy(null); }
  };
  const save = async () => {
    if (!plan || busy) return;
    setBusy("save"); setError("");
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const outputPath = await save({ title: t("games.patch.saveCopy"), defaultPath: game?`${game.name.replace(/[<>:"/\\|?*]/g,'_')}.${plan.extension}`:plan.outputName, filters: [{ name: t("games.patch.gameFile"), extensions: [plan.extension] }] });
      if (!outputPath || !live.current) return;
      const result = await invoke<PatchReceipt>("games_write_patch", { token: plan.token, outputPath });
      if (live.current) { token.current = ""; setReceipt(result); }
    } catch (error) {
      if (live.current) { setError(patchErrorKey(error)); if (["patch_expired", "patch_inputs_changed"].includes(String(error))) { discard(); setPlan(null); } }
    } finally { if (live.current) setBusy(null); }
  };
  const size = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB`;
  const phase = receipt ? "complete" : plan ? "review" : patch ? "prepare" : "files";
  useEffect(() => {
    const body = content.current?.querySelector<HTMLElement>(".games-patch-scroll");
    if (!body) return;
    if (phase === "complete") body.scrollTop = 0;
    if (phase === "review") body.querySelector(".games-patch-plan")?.scrollIntoView({ block: "nearest" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = body.animate([{ opacity: .35, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => animation.cancel();
  }, [phase]);
  return <ModalShell closing={closing} onDismiss={dismiss} width={680} labelledBy={titleId} backdropClassName="games-patch-backdrop">
    <div className="games-patch" ref={content}>
      <header><span className="games-patch-mark">{game?<GameArt src={game.portrait??game.capsule}/>:<GameMark kind="create" size={25}/>}</span><div><span className="games-section-kicker">{t(game ? "games.hub.getFiles" : "games.patch.eyebrow")}</span><h2 id={titleId}>{receipt?t("games.patch.done"):game?.name??t("games.patch.title")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} disabled={busy === "save"} onClick={dismiss}><X size={19} /></button></header>
      <div className="games-patch-scroll">
        {!desktop ? <div className="games-patch-intro"><p>{t("games.patch.desktop")}</p><span>BPS · IPS · UPS</span></div> : receipt ? <div className="games-patch-complete"><span><Check size={28} /></span><h3>{fileName(receipt.path)}</h3><p>{t("games.patch.preserved")}</p><code>{receipt.path}</code><details><summary>{t("games.patch.fingerprint")}</summary><code>{receipt.sha256}</code></details></div> : <>
          {game&&<section className="games-patch-acquire">
            <p className="games-patch-intro">{t(pack?'games.hub.packNote':'games.hub.downloadNote')}</p>
            {(release?.base||game.parent)&&<p className="games-patch-base-required">{t('games.patch.gameFile')}: <strong>{release?.base??game.parent?.name}</strong></p>}
            <GameHackFiles game={game} compact active={!closing} acquire={url=>void acquire(url)} disabled={downloadBusy||!!busy}/>
            {downloadBusy&&<div className="games-patch-download-loading" aria-busy="true"><span role="status">{t('games.hub.gettingFiles')}</span><div className="games-skeleton"/><div className="games-skeleton"/></div>}
            {downloadError&&<p role="alert">{t(downloadError)}</p>}
            {!downloadBusy&&downloadReview&&<div className="games-patch-download-list">{downloadReview.links.map(link=><button key={link.url} className="games-button" disabled={!!busy} onClick={()=>void acquire(link.url)}><Download size={15}/>{link.name}</button>)}{downloadReview.files.map(file=><button className="games-button" key={file.path} disabled={!!busy} aria-pressed={patch===file.path} onClick={()=>void selectPatch(file.path)}><File size={15}/><span>{file.name}<small>{size(file.bytes)}</small></span>{patch===file.path&&<Check size={16}/>}</button>)}{downloadReview.notes.length>0&&<details><summary>{t('games.hub.creatorNotes')}</summary>{downloadReview.notes.map((note,i)=><pre key={i}>{note}</pre>)}</details>}</div>}
          </section>}
          {!game&&<p className="games-patch-intro">{t("games.patch.description")}</p>}
          {!pack&&<>{candidates.length>0&&<div className="games-patch-candidates"><span>{t('games.hub.fromLibrary')}</span>{[...candidates].sort((a,b)=>Number(sourceMatches.includes(b.path))-Number(sourceMatches.includes(a.path))).slice(0,8).map(item=><button className="games-button" key={item.path} disabled={!!busy||downloadBusy} aria-pressed={source===item.path} onClick={()=>{++matchRequest.current;discard();setPlan(null);setSource(item.path);}}><File size={15}/>{item.linked?.name??item.name}{source===item.path&&<Check size={15}/>}</button>)}</div>}
          {game && !patch ? <details className="games-patch-manual"><summary>{t('games.hub.manualPatch')}</summary>
            <details><summary>{t('games.hub.downloadLink')}</summary><form onSubmit={e=>{e.preventDefault();void acquire(downloadUrl);}}><input aria-label={t('games.hub.downloadLink')} type="url" required placeholder="https://" value={downloadUrl} onChange={e=>setDownloadUrl(e.target.value)}/><button className="games-button" disabled={downloadBusy||!!busy||!downloadUrl}>{t('games.hub.getFiles')}</button></form></details>
          <div className="games-patch-files">{(["source", "patch"] as const).map((kind, i) => <button key={kind} onClick={() => void choose(kind)} disabled={!!busy||downloadBusy}><span className="games-patch-step">0{i + 1}</span><span><strong>{t(kind === "source" ? "games.patch.gameFile" : "games.patch.patchFile")}</strong><span>{(kind === "source" ? source : patch) ? (kind==="patch"?downloadReview?.files.find(file=>file.path===patch)?.name??fileName(patch):fileName(source)) : t(kind === "source" ? "games.patch.chooseGame" : "games.patch.choosePatch")}</span></span>{(kind === "source" ? source : patch) ? <File size={20} /> : <FolderOpen size={20} />}</button>)}</div>
          </details> : <>          <div className="games-patch-files">{(["source", "patch"] as const).map((kind, i) => <button key={kind} onClick={() => void choose(kind)} disabled={!!busy||downloadBusy}><span className="games-patch-step">0{i + 1}</span><span><strong>{t(kind === "source" ? "games.patch.gameFile" : "games.patch.patchFile")}</strong><span>{(kind === "source" ? source : patch) ? (kind==="patch"?downloadReview?.files.find(file=>file.path===patch)?.name??fileName(patch):fileName(source)) : t(kind === "source" ? "games.patch.chooseGame" : "games.patch.choosePatch")}</span></span>{(kind === "source" ? source : patch) ? <File size={20} /> : <FolderOpen size={20} />}</button>)}</div>
          </>}
          {plan && <section className="games-patch-plan" aria-live="polite"><div><Check size={19} /><h3>{t(plan.checksumsVerified ? "games.patch.verified" : "games.patch.ready")}</h3><span>{plan.format}</span></div><p>{t(plan.checksumsVerified ? "games.patch.verifiedNote" : "games.patch.ipsNote")}</p><div className="games-patch-size"><span>{size(plan.sourceBytes)}</span><ArrowRight size={15} /><strong>{size(plan.targetBytes)}</strong></div><details><summary>{t("games.patch.fingerprints")}</summary>{[["games.patch.gameFile", plan.sourceSha256], ["games.patch.patchFile", plan.patchSha256], ["games.patch.output", plan.targetSha256]].map(([label, value]) => <div key={label}><span>{t(label)}</span><code>{value}</code></div>)}</details></section>}
          {error && <p className="games-patch-error" role="alert">{t(error)}</p>}</>}
        </>}
      </div>
      {receipt&&error&&<p className="games-patch-error" role="alert">{t(error)}</p>}
      <footer>{(!game || !!patch) && <span>{t("games.patch.localNote")}</span>}{outputGame&&access&&<button className="games-button" disabled={added} onClick={addPatched}>{t(added?"games.hub.added":"games.hub.addLibrary")}</button>}{receipt && embeddedSystem !== null && access && <button className="games-button" onClick={playPatched}>{t('games.retro.playInside')}</button>}{receipt || !desktop || pack || !!game && !patch ? <button className="games-button games-button-primary" onClick={dismiss}>{t("common.close")}</button> : <button className="games-button games-button-primary" disabled={!!busy || downloadBusy || !source || !patch} onClick={() => void (plan ? save() : verify())}>{busy === "verify" || busy === "save" ? <LoaderCircle size={17} className="games-patch-working" /> : plan ? <FolderOpen size={17} /> : <GameMark kind="create" size={17} />}{t(busy === "verify" ? "games.patch.verifying" : busy === "save" ? "games.patch.saving" : plan ? "games.patch.saveCopy" : "games.patch.verify")}</button>}</footer>
    </div>
  </ModalShell>;
}

