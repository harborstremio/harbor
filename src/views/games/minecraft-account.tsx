import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ExternalLink, LogIn, LogOut, RefreshCw, UserRound, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import type { MinecraftAccountController } from "@/hooks/use-minecraft-account";
import { readSkinPng } from "@/lib/games/minecraft-skin-image";
import { MinecraftSkinViewer } from "./minecraft-skin-viewer";
import "./minecraft-account.css";
import "./minecraft-skin-studio.css";

export function MinecraftAccountButton({ account, open }: { account: MinecraftAccountController; open: () => void }) {
  const t = useT(), player = account.status?.account, skin = player?.skins.find(value => value.active);
  return <button className="mc-account-button" onClick={open} aria-label={player?.name ?? t("games.minecraft.account.signIn")} title={player?.name ?? t("games.minecraft.account.signIn")}>{skin ? <span className="mc-account-face" aria-hidden="true"><span style={{ backgroundImage: `url(${skin.url})` }} /><span style={{ backgroundImage: `url(${skin.url})` }} /></span> : player ? <UserRound size={17} /> : <LogIn size={17} />}<span>{player?.name ?? t("games.minecraft.account.signIn")}</span></button>;
}

export function MinecraftAccountDialog({ account, close: onClose }: { account: MinecraftAccountController; close: () => void }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose);
  const player = account.status?.account, current = player?.skins.find(s => s.active), activeCape = player?.capes.find(c => c.active)?.id ?? null;
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null), [capeId, setCapeId] = useState<string | null>(activeCape), [capeTexture, setCapeTexture] = useState<string>();
  const [textureFailed, setTextureFailed] = useState(false), [copied, setCopied] = useState(false), [linkError, setLinkError] = useState(false);
  const [textureRevision, setTextureRevision] = useState(0);
  useSectionBack(close, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],canvas[tabindex="0"]') ?? [])].filter(v => v.getClientRects().length);
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (closing) account.cancel(); }, [closing]);
  useEffect(() => { setCopied(false); setLinkError(false); }, [account.challenge?.flow]);
  useEffect(() => { setCapeId(activeCape); }, [activeCape, player?.id]);
  useEffect(() => {
    let cancelled = false; setPixels(null); setTextureFailed(false);
    if (current) void account.texture("skin", current.id).then(readSkinPng).then(value => { if (!cancelled) setPixels(value); }).catch(() => { if (!cancelled) setTextureFailed(true); });
    return () => { cancelled = true; };
  }, [current?.id, current?.url, player?.id, textureRevision]);
  useEffect(() => {
    let cancelled = false; setCapeTexture(undefined);
    if (capeId) void account.texture("cape", capeId).then(value => { if (!cancelled) setCapeTexture(value); }).catch(() => { if (!cancelled) setTextureFailed(true); });
    return () => { cancelled = true; };
  }, [capeId, player?.id, textureRevision]);
  const openMicrosoft = async () => {
    setLinkError(false);
    try { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl("https://microsoft.com/devicelogin"); } catch { setLinkError(true); }
  };
  const copyCode = async () => {
    if (!account.challenge) return;
    try { await navigator.clipboard.writeText(account.challenge.user_code); setCopied(true); } catch { setCopied(false); }
  };
  return <ModalShell closing={closing} onDismiss={close} labelledBy={title} width={player ? 850 : 490} backdropClassName="mc-account-scrim">
    <div className="mc-account-dialog" ref={root}>
      <header><div><span className="games-section-kicker">Minecraft: Java Edition</span><h2 id={title}>{player?.name ?? t("games.minecraft.account.title")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={19} /></button></header>
      {account.error && <p className="mc-skin-error" role="alert">{t(account.error)}</p>}
      {player ? <><div className="mc-account-appearance">
        {pixels && current ? <MinecraftSkinViewer pixels={pixels} model={current.variant} cape={capeTexture} active={!closing} /> : <div className="mc-account-skin-empty" aria-busy={!!current && !textureFailed}><span>{t(textureFailed || !current ? "games.minecraft.account.noSkin" : "common.loading")}</span></div>}
        <section className="mc-account-capes"><h3>{t("games.minecraft.account.capes")}</h3><p>{t("games.minecraft.account.capeNote")}</p>
          <div className="mc-cape-list"><button aria-pressed={capeId === null} onClick={() => setCapeId(null)}><span className="mc-cape-none"><X size={26} /></span><span>{t("games.minecraft.account.noCape")}</span></button>{player.capes.map(cape => <button key={cape.id} aria-pressed={capeId === cape.id} onClick={() => setCapeId(cape.id)}><span className="mc-cape-texture" style={{ backgroundImage: `url(${cape.url})` }} /><span>{cape.name}</span>{cape.active && <Check size={12} />}</button>)}</div>
          {capeId !== activeCape && <button className="games-button" disabled={account.busy} onClick={() => void account.applyCape(capeId)}>{t("games.minecraft.account.applyCape")}</button>}
          {textureFailed && <div><p role="status">{t("games.minecraft.account.network")}</p><button className="games-button" onClick={() => { setTextureFailed(false); setTextureRevision(v => v + 1); }}>{t("common.retry")}</button></div>}
        </section>
      </div><footer><button className="games-button" disabled={account.busy} onClick={() => void account.refresh()}><RefreshCw size={16} />{t("games.feed.refresh")}</button><button className="games-button" disabled={account.busy} onClick={() => void account.disconnect()}><LogOut size={16} />{t("games.minecraft.account.signOut")}</button></footer></> : <div className="mc-account-signin">
        <p>{t("games.minecraft.account.intro")}</p>
        {!account.available ? <p className="mc-account-note">{t("games.minecraft.account.desktop")}</p> : !account.status && !account.error ? <p role="status">{t("common.loading")}</p> : account.challenge ? <>
          <p>{t("games.minecraft.account.codeNote")}</p>
          <div className="mc-account-code"><strong dir="ltr">{account.challenge.user_code}</strong><button className="games-icon-button" aria-label={t("games.minecraft.account.copy")} title={t("games.minecraft.account.copy")} onClick={() => void copyCode()}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
          <button className="games-button games-button-primary" onClick={() => void openMicrosoft()}>{t("games.minecraft.account.openMicrosoft")}<ExternalLink size={16} /></button>
          <p role="status">{t("games.minecraft.account.waiting")}</p><button className="games-button" onClick={account.cancel}>{t("common.cancel")}</button>
          {linkError && <p role="alert">{t("games.minecraft.account.openManually")} <span dir="ltr">microsoft.com/devicelogin</span></p>}
        </> : account.status?.configured ? <button className="games-button games-button-primary" disabled={account.busy} onClick={() => void account.connect()}><LogIn size={18} />{t(account.busy ? "common.loading" : "games.minecraft.account.signIn")}</button> : <><p className="mc-account-note">{t("games.minecraft.account.setup")}</p><button className="games-button" disabled={account.busy} onClick={() => void account.refresh()}><RefreshCw size={16} />{t("common.retry")}</button></>}
      </div>}
    </div>
  </ModalShell>;
}
