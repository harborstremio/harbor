import { loadInstalled, reorderInstalled, type InstalledAddon } from "@/lib/addon-store";
import { getUserAddonsRaw, type Addon } from "@/lib/addons";
import {
  applyOrderToItems,
  loadBackups,
  moveItem,
  pushBackup,
  saveCollectionOrder,
  saveDisplayOrder,
  sequencesEqual,
  type AddonOrderBackup,
  type SaveStep,
} from "@/lib/addons-store/reorder";
import { useT } from "@/lib/i18n";
import { pushOverlayPin } from "@/lib/overlay-pin";
import { useSearch } from "@/lib/search-context";
import { ArrowLeft, ChevronDown, History, Info, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackupsPanel } from "./backups-card";
import { OrganizeList, SectionCard, SkeletonRows } from "./section-card";
import { useDragList } from "./use-drag-list";
import { entriesOf, noticeFor, stepLabel as stepLabelFor, urlsOf, type Notice } from "./utils";

type Phase = { kind: "loading" } | { kind: "loadError" } | { kind: "ready" } | { kind: "saving"; step: SaveStep };

export function OrganizeAddonsPage({
  authKey,
  onClose,
  onSaved,
}: {
  authKey: string | null;
  onClose: () => void;
  onSaved: (scope: "cloud" | "local") => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [baselineCloud, setBaselineCloud] = useState<Addon[]>([]);
  const [workingCloud, setWorkingCloud] = useState<Addon[]>([]);
  const [baselineDevice, setBaselineDevice] = useState<InstalledAddon[]>([]);
  const [workingDevice, setWorkingDevice] = useState<InstalledAddon[]>([]);
  const [backupsKey, setBackupsKey] = useState(0);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const backupsWrapRef = useRef<HTMLDivElement>(null);
  const backedUpRef = useRef(false);
  const backupCount = useMemo(() => loadBackups().length, [backupsKey]);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    setNotice(null);
    if (!authKey) {
      const device = loadInstalled();
      setBaselineCloud([]);
      setWorkingCloud([]);
      setBaselineDevice(device);
      setWorkingDevice(device);
      setPhase({ kind: "ready" });
      return;
    }
    const cloud = await getUserAddonsRaw(authKey);
    if (cloud == null) {
      setPhase({ kind: "loadError" });
      return;
    }
    const cloudUrls = new Set(cloud.map((a) => a.transportUrl));
    const device = loadInstalled().filter((d) => !cloudUrls.has(d.transportUrl));
    setBaselineCloud(cloud);
    setWorkingCloud(cloud);
    setBaselineDevice(device);
    setWorkingDevice(device);
    setPhase({ kind: "ready" });
  }, [authKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => pushOverlayPin(), []);

  const cloudDrag = useDragList(workingCloud.length, (from, to) => setWorkingCloud((l) => moveItem(l, from, to)));
  const deviceDrag = useDragList(workingDevice.length, (from, to) => setWorkingDevice((l) => moveItem(l, from, to)));

  const search = useSearch();
  const escBlockRef = useRef(false);
  const backupsOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    escBlockRef.current =
      search.open || phase.kind === "saving" || cloudDrag.dragIndex != null || deviceDrag.dragIndex != null;
    backupsOpenRef.current = backupsOpen;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (backupsOpenRef.current) {
        e.preventDefault();
        setBackupsOpen(false);
        return;
      }
      if (escBlockRef.current) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (!backupsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!backupsWrapRef.current?.contains(e.target as Node)) setBackupsOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [backupsOpen]);

  const cloudDirty = !sequencesEqual(urlsOf(workingCloud), urlsOf(baselineCloud));
  const deviceDirty = !sequencesEqual(urlsOf(workingDevice), urlsOf(baselineDevice));
  const dirty = cloudDirty || deviceDirty;
  const saving = phase.kind === "saving";

  const mirrorLocal = () => {
    const urls = [...urlsOf(workingCloud), ...urlsOf(workingDevice)];
    try {
      saveDisplayOrder(urls);
      reorderInstalled(urls);
    } catch (e) {
      console.warn("[addons] local order mirror failed", e);
    }
  };

  const handleSave = async () => {
    if (!dirty || phase.kind !== "ready") return;
    setNotice(null);
    try {
      if (cloudDirty && authKey) {
        setPhase({ kind: "saving", step: "checking" });
        const result = await saveCollectionOrder(authKey, baselineCloud, workingCloud, backedUpRef.current, (step) =>
          setPhase({ kind: "saving", step }),
        );
        if (!result.ok) {
          if (result.stage === "write" || result.stage === "verify") backedUpRef.current = true;
          if (result.stage === "validate") {
            console.warn("[addons] reorder blocked by validation", result.reason);
          }
          setBackupsKey((k) => k + 1);
          setPhase({ kind: "ready" });
          setNotice(noticeFor(result));
          return;
        }
        backedUpRef.current = true;
        mirrorLocal();
        onSaved("cloud");
        return;
      }
      mirrorLocal();
      onSaved("local");
    } catch (e) {
      console.warn("[addons] reorder save failed", e);
      setPhase({ kind: "ready" });
      setNotice({
        tone: "danger",
        text: t("Something unexpected went wrong. Nothing may have been written. Retry to re-check."),
        retry: true,
      });
    }
  };

  const handleBackupNow = () => {
    if (workingCloud.length === 0) return;
    pushBackup(workingCloud);
    setBackupsKey((k) => k + 1);
    setNotice({
      tone: "info",
      text: t("Backed up. The current account order is saved in the Backups panel."),
    });
  };

  const handleRestore = (backup: AddonOrderBackup) => {
    setWorkingCloud(applyOrderToItems(baselineCloud, backup.urls));
    setBackupsOpen(false);
    setNotice({
      tone: "info",
      text: t(
        "Backup loaded into the editor. Addons added since stay at the end. Nothing changes until you press Save.",
      ),
    });
  };

  const stepLabel = phase.kind === "saving" ? stepLabelFor(phase.step) : null;
  const showBackups = !!authKey && phase.kind !== "loadError";

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-canvas animate-in fade-in duration-150">
      <header
        data-tauri-drag-region
        className="relative z-50 shrink-0 border-b border-edge-soft bg-canvas/85 backdrop-blur-xl"
      >
        <div className="mx-auto flex w-full max-w-[1160px] items-center gap-4 px-6 py-5 sm:px-10">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
            aria-label={t("Back to addons")}
            title={t("Back to addons")}
          >
            <ArrowLeft size={18} strokeWidth={2.2} className="dir-icon" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-display text-[26px] font-medium tracking-tight text-ink sm:text-[30px]">
              {t("Organize addons")}
            </h1>
            <p className="hidden truncate text-[13px] text-ink-muted sm:block">
              {t(
                "The order decides who answers first when you press Play. Drag, use the arrows, or jump anything straight to the top.",
              )}
            </p>
          </div>
          {showBackups && (
            <div ref={backupsWrapRef} className="relative shrink-0">
              <button
                onClick={() => setBackupsOpen((v) => !v)}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition-colors ${
                  backupsOpen
                    ? "bg-raised text-ink ring-edge"
                    : "bg-elevated text-ink-muted ring-edge-soft hover:bg-raised hover:text-ink"
                }`}
              >
                <History size={15} strokeWidth={2.2} />
                {t("Backups")}
                {backupCount > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 text-[11px] font-bold text-accent">
                    {backupCount}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  strokeWidth={2.4}
                  className={`transition-transform duration-200 ${backupsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {backupsOpen && (
                <div className="absolute end-0 top-[calc(100%+12px)] z-20 max-h-[64vh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-edge bg-elevated shadow-[0_28px_72px_-20px_rgba(0,0,0,0.7)] animate-popover-in">
                  <BackupsPanel
                    refreshKey={backupsKey}
                    busy={saving}
                    canBackup={workingCloud.length > 0 && phase.kind === "ready"}
                    onBackupNow={handleBackupNow}
                    onRestore={handleRestore}
                  />
                </div>
              )}
            </div>
          )}
          {phase.kind !== "loadError" && (
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex h-11 items-center rounded-full bg-elevated px-5 text-[13.5px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!dirty || phase.kind !== "ready"}
                className={`flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
                  dirty && !saving ? "ring-2 ring-accent/50" : ""
                }`}
              >
                {stepLabel ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {stepLabel}
                  </>
                ) : (
                  t("Save order")
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1160px] px-6 py-8 sm:px-10">
          {phase.kind === "loadError" ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-20 text-center">
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {t("Couldn't load your Stremio collection. Nothing can be reordered safely without it.")}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void load()}
                  className="flex h-12 items-center rounded-full bg-ink px-6 text-[14.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  {t("Try again")}
                </button>
                <button
                  onClick={onClose}
                  className="flex h-12 items-center rounded-full bg-elevated px-6 text-[14.5px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
                >
                  {t("Go back")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-w-0 flex-col gap-6">
                {notice && (
                  <div
                    className={`flex flex-col gap-3 rounded-2xl px-5 py-4 text-[13.5px] ring-1 ${
                      notice.tone === "danger"
                        ? "bg-danger/15 text-danger ring-danger/30"
                        : "bg-elevated/70 text-ink-muted ring-edge"
                    }`}
                  >
                    <p className="leading-relaxed">{notice.text}</p>
                    {(notice.retry || notice.reload) && (
                      <div className="flex items-center gap-2.5">
                        {notice.retry && (
                          <button
                            onClick={() => void handleSave()}
                            className="rounded-full bg-raised px-4 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                          >
                            {t("Retry")}
                          </button>
                        )}
                        {notice.reload && (
                          <button
                            onClick={() => void load()}
                            className="rounded-full bg-raised px-4 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                          >
                            {t("Reload list")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {authKey ? (
                  <>
                    <SectionCard
                      title={t("Your Stremio account")}
                      sub={t("This order syncs to every Stremio app signed into this account.")}
                      count={workingCloud.length}
                    >
                      {phase.kind === "loading" ? (
                        <SkeletonRows />
                      ) : workingCloud.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-edge-soft bg-canvas/30 px-5 py-4 text-[13.5px] text-ink-subtle">
                          {t("No addons are synced to this account yet.")}
                        </p>
                      ) : (
                        <OrganizeList
                          entries={entriesOf(workingCloud)}
                          drag={cloudDrag}
                          busy={saving}
                          onMove={(i, delta) => setWorkingCloud((l) => moveItem(l, i, i + delta))}
                          onMoveTop={(i) => setWorkingCloud((l) => moveItem(l, i, 0))}
                        />
                      )}
                    </SectionCard>
                    {workingDevice.length > 0 && (
                      <SectionCard
                        title={t("On this device only")}
                        sub={t("These live in Harbor on this computer and never touch your account.")}
                        count={workingDevice.length}
                      >
                        <OrganizeList
                          entries={entriesOf(workingDevice)}
                          drag={deviceDrag}
                          busy={saving}
                          onMove={(i, delta) => setWorkingDevice((l) => moveItem(l, i, i + delta))}
                          onMoveTop={(i) => setWorkingDevice((l) => moveItem(l, i, 0))}
                        />
                      </SectionCard>
                    )}
                  </>
                ) : (
                  <SectionCard
                    title={t("On this device")}
                    sub={t("Sign in to Stremio to organize the addons synced to your account.")}
                    count={workingDevice.length}
                  >
                    {phase.kind === "loading" ? (
                      <SkeletonRows />
                    ) : (
                      <OrganizeList
                        entries={entriesOf(workingDevice)}
                        drag={deviceDrag}
                        busy={saving}
                        onMove={(i, delta) => setWorkingDevice((l) => moveItem(l, i, i + delta))}
                        onMoveTop={(i) => setWorkingDevice((l) => moveItem(l, i, 0))}
                      />
                    )}
                  </SectionCard>
                )}
              </div>

              <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
                <section className="rounded-2xl border border-edge-soft bg-elevated/40 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Info size={15} strokeWidth={2.2} className="text-ink-muted" />
                    <h2 className="font-display text-[18px] font-medium tracking-tight text-ink">
                      {t("Good to know")}
                    </h2>
                  </div>
                  <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                    <li>{t("Number 1 gets asked first for streams when you press Play.")}</li>
                    <li>{t("The order also decides which addon's rows win on your Home screen.")}</li>
                    <li>{t("Nothing changes until you press Save. Leaving this page discards edits.")}</li>
                    <li>
                      {t("The Backups button at the top keeps your last five orders. One click restores any of them.")}
                    </li>
                    <li>
                      {t("Harbor double-checks with Stremio after saving, so a half-written order can't slip through.")}
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          )}
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
}
