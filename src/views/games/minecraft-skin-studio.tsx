import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download, Eraser, Grid2X2, PaintBucket, Pencil, Pipette, Plus, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import { useT } from "@/lib/i18n";
import { blankSkin, convertSkinModel, inferSkinModel, paintSkin, removeSkinDraft, saveSkinDraft, skinDrafts, skinFaceRect, skinHex, skinStroke, SKIN_FACES, SKIN_PARTS, type SkinDraft, type SkinFace, type SkinModel, type SkinPart, type SkinTool } from "@/lib/games/minecraft-skin";
import { downloadSkin, readSkinPng, skinPng } from "@/lib/games/minecraft-skin-image";
import { MinecraftSkinViewer } from "./minecraft-skin-viewer";
import "./minecraft-skin-studio.css";
import type { MinecraftAccountController } from "@/hooks/use-minecraft-account";

type Snapshot = { pixels: Uint8ClampedArray; model: SkinModel };
const PALETTE = ["#efd0b1", "#b98562", "#684732", "#292725", "#f1eee7", "#749d83", "#3a6651", "#75a4c7", "#424c86", "#b26990", "#c55645", "#e3b651"];
const toolIcons = { brush: Pencil, erase: Eraser, fill: PaintBucket, pick: Pipette };

export function MinecraftSkinStudio({ profile, active, onReady, account }: { profile: string; active: boolean; onReady?: () => void; account?: MinecraftAccountController }) {
  const t = useT(), input = useRef<HTMLInputElement>(null), grid = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState(() => skinDrafts(profile));
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID()), [name, setName] = useState(() => t("games.minecraft.starter"));
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ pixels: blankSkin("classic"), model: "classic" }));
  const [part, setPart] = useState<SkinPart>("head"), [face, setFace] = useState<SkinFace>("front"), [outer, setOuter] = useState(false);
  const [tool, setTool] = useState<SkinTool>("brush"), [color, setColor] = useState(PALETTE[0]), [showGrid, setShowGrid] = useState(true);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]), [error, setError] = useState("");
  const [edited, setEdited] = useState(false), [saved, setSaved] = useState(false), [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const current = useRef(snapshot), stroke = useRef<{ start: Snapshot; point: [number, number] } | null>(null), loadRevision = useRef(0);
  const texture = useMemo(() => skinPng(snapshot.pixels), [snapshot.pixels]);
  const rect = skinFaceRect(part, face, outer, snapshot.model);
  const record = (): SkinDraft => ({ id: draftId, name: name.trim().slice(0, 80) || t("games.minecraft.starter"), model: snapshot.model, texture, updated: Date.now() });
  const pendingDraft = useRef<SkinDraft | null>(null);
  pendingDraft.current = edited ? record() : null;
  const persist = () => {
    if (!edited) return true;
    try { setDrafts(saveSkinDraft(profile, record())); setSaved(true); setError(""); return true; }
    catch { setError("games.minecraft.errorSave"); return false; }
  };
  useEffect(() => { current.current = snapshot; }, [snapshot]);
  useEffect(() => { if (!edited) return; setSaved(false); const timer = setTimeout(persist, 450); return () => clearTimeout(timer); }, [snapshot, name, draftId, edited]);
  useEffect(() => { if (!active && edited) persist(); }, [active]);
  useEffect(() => () => { loadRevision.current++; }, []);
  useEffect(() => { const previous = skinDrafts(profile)[0]; if (previous) void load(previous); }, [profile]);
  useEffect(() => { onReady?.(); }, [onReady]);
  useEffect(() => () => { if (pendingDraft.current) { try { saveSkinDraft(profile, pendingDraft.current); } catch { /* The editor already reports storage failures while mounted. */ } } }, [profile]);
  useEffect(() => { setCursor([0, 0]); }, [part, face, snapshot.model]);
  useEffect(() => { if (!outer && tool === "erase") setTool("brush"); }, [outer, tool]);

  const replace = (value: Snapshot) => { current.current = value; setSnapshot(value); setEdited(true); setSaved(false); };
  const remember = (before: Snapshot) => setHistory(value => ({ past: [...value.past.slice(-59), before], future: [] }));
  const commit = () => {
    const value = stroke.current; stroke.current = null;
    if (value && value.start !== current.current) remember(value.start);
  };
  const apply = (point: [number, number], previous?: [number, number]) => {
    const [x, y] = point; setCursor(point);
    if (tool === "pick") { setColor(skinHex(current.current.pixels, rect.x + x, rect.y + y)); setTool("brush"); return; }
    let pixels = current.current.pixels;
    for (const [px, py] of previous && (tool === "brush" || tool === "erase") ? skinStroke(previous, point) : [point]) pixels = paintSkin(pixels, rect, px, py, tool, color);
    if (pixels !== current.current.pixels) replace({ ...current.current, pixels });
  };
  const pointAt = (event: PointerEvent): [number, number] | null => {
    const bounds = grid.current?.getBoundingClientRect(); if (!bounds) return null;
    const x = Math.floor((event.clientX - bounds.left) / bounds.width * rect.width), y = Math.floor((event.clientY - bounds.top) / bounds.height * rect.height);
    return x >= 0 && x < rect.width && y >= 0 && y < rect.height ? [x, y] : null;
  };
  const moveHistory = (undo: boolean) => {
    commit(); const from = undo ? history.past : history.future, value = from.at(-1); if (!value) return;
    setHistory(undo ? { past: from.slice(0, -1), future: [...history.future, snapshot] } : { past: [...history.past, snapshot], future: from.slice(0, -1) }); replace(value);
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (loading) return;
    if (!(event.target instanceof HTMLElement) || !event.target.closest(".mc-skin-grid")) return;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (delta[event.key]) {
      event.preventDefault(); const d = delta[event.key], next: [number, number] = [Math.max(0, Math.min(rect.width - 1, cursor[0] + d[0])), Math.max(0, Math.min(rect.height - 1, cursor[1] + d[1]))]; setCursor(next);
      grid.current?.querySelector<HTMLButtonElement>(`[data-pixel="${next[0]}-${next[1]}"]`)?.focus();
    } else if (event.key === " " || event.key === "Enter") { event.preventDefault(); const before = current.current; apply(cursor); if (before !== current.current) remember(before); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); moveHistory(!event.shiftKey); }
  };
  const load = async (source: File | SkinDraft | (() => Promise<SkinDraft>)) => {
    if (!persist()) return;
    const revision = ++loadRevision.current; setLoading(true); setError("");
    try {
      source = typeof source === "function" ? await source() : source;
      if (revision !== loadRevision.current) return;
      const draft = "texture" in source ? source : null, pixels = await readSkinPng(draft ? draft.texture : source as File);
      if (revision !== loadRevision.current) return;
      const value = { pixels, model: draft?.model ?? inferSkinModel(pixels) };
      current.current = value; setSnapshot(value); setDraftId(draft?.id ?? crypto.randomUUID());
      setName(draft?.name ?? (source as File).name.replace(/\.png$/i, "").slice(0, 80));
      setHistory({ past: [], future: [] }); setEdited(true); setSaved(!!draft);
    } catch { if (revision === loadRevision.current) setError("games.minecraft.errorImport"); }
    finally { if (revision === loadRevision.current) setLoading(false); }
  };
  const create = () => {
    if (!persist()) return; loadRevision.current++; setLoading(false);
    const value = { pixels: blankSkin("classic"), model: "classic" as const }; current.current = value; setSnapshot(value);
    setDraftId(crypto.randomUUID()); setName(t("games.minecraft.starter")); setEdited(false); setSaved(false); setHistory({ past: [], future: [] }); setError("");
  };

  return <section className="mc-skin-studio games-inset" onKeyDown={keyboard}>
    <header className="mc-skin-heading"><div><span className="games-section-kicker">{t("games.minecraft.studio")}</span><h2>{t("games.minecraft.skinTitle")}</h2><p>{t("games.minecraft.skinNote")}</p></div><div className="mc-skin-file-actions">
      <input type="file" ref={input} accept=".png,image/png" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void load(file); }} />
      <button className="games-button" disabled={loading} onClick={() => input.current?.click()}><Upload size={16} />{t("games.minecraft.import")}</button>
      <button className="games-button games-button-primary" onClick={() => downloadSkin(texture, name)}><Download size={16} />{t("games.minecraft.export")}</button>
    </div></header>
    {account?.status?.account && <div className="mc-skin-account-actions"><span>{account.status.account.name}</span><button className="games-button" disabled={account.busy || loading || !account.status.account.skins.some(s => s.active)} onClick={() => {
      const player = account.status?.account, skin = player?.skins.find(s => s.active); if (!skin || !player) return;
      void load(async () => ({ id: crypto.randomUUID(), name: player.name, model: skin.variant, texture: await account.texture("skin", skin.id), updated: Date.now() }));
    }}>{t("games.minecraft.account.editCurrent")}</button><button className="games-button" disabled={account.busy || loading} onClick={async () => { const uploaded = snapshot; if (await account.applySkin(texture, snapshot.model)) setApplied(uploaded); }}>{t("games.minecraft.account.applySkin")}</button>{applied === snapshot && <span role="status">{t("games.minecraft.account.applied")}</span>}</div>}
    {account?.error && <p className="mc-skin-error" role="alert">{t(account.error)}</p>}
    {error && <p className="mc-skin-error" role="alert">{t(error)}</p>}
    <div className="mc-skin-workspace" aria-busy={loading}>
      <MinecraftSkinViewer pixels={snapshot.pixels} model={snapshot.model} active={active} />
      <div className="mc-skin-editor" inert={loading}>
        <div className="mc-skin-editor-name"><label><span>{t("games.minecraft.name")}</span><input maxLength={80} value={name} onChange={e => { setName(e.target.value); setEdited(true); }} /></label><span role="status">{edited ? t(saved ? "games.minecraft.saved" : "games.minecraft.saving") : "64 × 64 PNG"}</span></div>
        <div className="mc-skin-model" role="group" aria-label={t("games.minecraft.model")}>{(["classic", "slim"] as const).map(model => <button key={model} aria-pressed={snapshot.model === model} onClick={() => { if (snapshot.model === model) return; remember(snapshot); replace({ pixels: convertSkinModel(snapshot.pixels, snapshot.model, model), model }); }}>{t(`games.minecraft.${model}`)}<small>{model === "classic" ? "4 px" : "3 px"}</small></button>)}</div>
        <div className="mc-skin-selectors"><label>{t("games.minecraft.part")}<select aria-label={t("games.minecraft.part")} value={part} onChange={e => setPart(e.target.value as SkinPart)}>{SKIN_PARTS.map(v => <option key={v} value={v}>{t(`games.minecraft.${v}`)}</option>)}</select></label><label>{t("games.minecraft.face")}<select aria-label={t("games.minecraft.face")} value={face} onChange={e => setFace(e.target.value as SkinFace)}>{SKIN_FACES.map(v => <option key={v} value={v}>{t(`games.minecraft.${v}`)}</option>)}</select></label><label>{t("games.minecraft.layer")}<select aria-label={t("games.minecraft.layer")} value={outer ? "outer" : "base"} onChange={e => setOuter(e.target.value === "outer")}><option value="base">{t("games.minecraft.base")}</option><option value="outer">{t("games.minecraft.outer")}</option></select></label></div>
        <div className="mc-skin-tools"><div role="group" aria-label={t("games.minecraft.tools")}>{(Object.keys(toolIcons) as SkinTool[]).map(v => { const Icon = toolIcons[v]; return <button key={v} title={t(`games.minecraft.${v}`)} aria-label={t(`games.minecraft.${v}`)} aria-pressed={tool === v} disabled={v === "erase" && !outer} onClick={() => setTool(v)}><Icon size={18} /></button>; })}</div><div><button title={t("games.minecraft.undo")} aria-label={t("games.minecraft.undo")} disabled={!history.past.length} onClick={() => moveHistory(true)}><Undo2 size={18} /></button><button title={t("games.minecraft.redo")} aria-label={t("games.minecraft.redo")} disabled={!history.future.length} onClick={() => moveHistory(false)}><Redo2 size={18} /></button><button title={t("games.minecraft.grid")} aria-label={t("games.minecraft.grid")} aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)}><Grid2X2 size={17} /></button></div></div>
        <div className="mc-skin-grid-wrap"><div ref={grid} className={`mc-skin-grid${showGrid ? " show-grid" : ""}`} role="grid" aria-label={`${t(`games.minecraft.${part}`)} · ${t(`games.minecraft.${face}`)}`} aria-rowcount={rect.height} aria-colcount={rect.width} style={{ gridTemplateColumns: `repeat(${rect.width}, 1fr)`, aspectRatio: `${rect.width}/${rect.height}`, width: `min(100%, ${360 * rect.width / rect.height}px)` }} dir="ltr"
          onPointerDown={event => { if (event.button !== 0 || loading) return; const p = pointAt(event); if (!p) return; event.preventDefault(); grid.current?.querySelector<HTMLButtonElement>(`[data-pixel="${p[0]}-${p[1]}"]`)?.focus({ preventScroll: true }); if (tool === "pick") { apply(p); return; } event.currentTarget.setPointerCapture(event.pointerId); stroke.current = { start: current.current, point: p }; apply(p); }}
          onPointerMove={event => { if (!stroke.current || !(event.buttons & 1) || tool === "fill" || tool === "pick") return; const p = pointAt(event); if (!p) return; apply(p, stroke.current.point); stroke.current.point = p; }}
          onPointerUp={commit} onPointerCancel={commit} onLostPointerCapture={commit}>
          {Array.from({ length: rect.height }, (_, y) => <div role="row" key={y}>{Array.from({ length: rect.width }, (_, x) => { const at = ((rect.y + y) * 64 + rect.x + x) * 4, rgba = snapshot.pixels.slice(at, at + 4); return <button type="button" role="gridcell" data-pixel={`${x}-${y}`} key={x} tabIndex={cursor[0] === x && cursor[1] === y ? 0 : -1} aria-label={t("games.minecraft.pixel", { x: x + 1, y: y + 1, color: skinHex(snapshot.pixels, rect.x + x, rect.y + y) })} style={{ backgroundColor: `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})` }} />; })}</div>)}
        </div></div>
        <div className="mc-skin-palette"><label title={t("games.minecraft.color")}><input aria-label={t("games.minecraft.color")} type="color" value={color} onChange={e => setColor(e.target.value)} /><span>{color.toUpperCase()}</span></label><div role="group" aria-label={t("games.minecraft.color")}>{PALETTE.map(value => <button key={value} aria-label={value} aria-pressed={value === color} style={{ backgroundColor: value }} onClick={() => setColor(value)} />)}</div></div>
        <p className="mc-skin-edit-hint">{t("games.minecraft.editHint")}</p>
      </div>
    </div>
    <section className="mc-skin-library"><header><div><h3>{t("games.minecraft.library")}</h3><p>{t("games.minecraft.localNote")}</p></div><button className="games-button" disabled={loading} onClick={create}><Plus size={17} />{t("games.minecraft.new")}</button></header>
      {drafts.length ? <div className="mc-skin-drafts">{drafts.map(draft => <div className="mc-skin-draft" key={draft.id}><button disabled={loading} aria-pressed={draft.id === draftId} onClick={() => { if (draft.id !== draftId) void load(draft); }}><SkinFaceThumb texture={draft.texture} /><strong>{draft.name}</strong><span>{t(`games.minecraft.${draft.model}`)}</span></button><button className="mc-skin-delete" aria-label={t("games.minecraft.delete", { name: draft.name })} title={t("games.minecraft.delete", { name: draft.name })} onClick={() => { try { setDrafts(removeSkinDraft(profile, draft.id)); if (draft.id === draftId) { pendingDraft.current = null; setEdited(false); setSaved(false); } } catch { setError("games.minecraft.errorSave"); } }}><Trash2 size={15} /></button></div>)}</div> : <p className="mc-skin-empty">{t("games.minecraft.empty")}</p>}
    </section>
  </section>;
}

function SkinFaceThumb({ texture }: { texture: string }) {
  return <span className="mc-skin-thumb" aria-hidden="true"><span style={{ backgroundImage: `url(${texture})` }} /><span style={{ backgroundImage: `url(${texture})` }} /></span>;
}
