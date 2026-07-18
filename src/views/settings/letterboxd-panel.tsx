import { Check, ExternalLink, Link2, Loader2, LogOut, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { buildStremboxdConfig } from "@/lib/stremboxd/settings-helper";
import {
  resolveLetterboxdListPublic,
  validateStremboxdConfig,
  type ManifestValidation,
} from "@/lib/stremboxd/client";
import { invalidateLetterboxdCache } from "@/lib/stremboxd/cache";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import type { LetterboxdSettings } from "@/lib/settings/types";

type CatalogOption = { id: string; label: string; fullOnly?: boolean };

const CATALOG_OPTIONS: CatalogOption[] = [
  { id: "letterboxd-watchlist", label: "Watchlist" },
  { id: "letterboxd-diary", label: "Diary", fullOnly: true },
  { id: "letterboxd-liked", label: "Liked Films" },
  { id: "letterboxd-friends", label: "Friends", fullOnly: true },
  { id: "letterboxd-recommended", label: "Recommended for You", fullOnly: true },
  { id: "letterboxd-popular", label: "Popular This Week" },
  { id: "letterboxd-top250", label: "Top 250" },
];

export function LetterboxdPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const lb = settings.letterboxd;
  const { session, isFullConnected, login, disconnect } = useLetterboxd();

  const [username, setUsername] = useState(lb.username);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState<ManifestValidation | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [listUrl, setListUrl] = useState("");
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const syncConfig = (patch: Partial<LetterboxdSettings>) => {
    const next = { ...lb, ...patch };
    update({ letterboxd: { ...next, encodedConfig: buildStremboxdConfig(next) } });
  };

  const toggleCatalog = (id: string, on: boolean) => {
    const selected = on
      ? [...lb.selectedCatalogs, id]
      : lb.selectedCatalogs.filter((c) => c !== id);
    syncConfig({ selectedCatalogs: selected });
    setVerify(null);
  };

  const handleVerify = async () => {
    setBusy(true);
    setVerify(null);
    const config = buildStremboxdConfig({ ...lb, username, selectedCatalogs: lb.selectedCatalogs });
    const result = await validateStremboxdConfig(config, username.trim().length > 0);
    setVerify(result);
    if (result.ok) {
      update({
        letterboxd: {
          ...lb,
          enabled: true,
          username: username.trim(),
          encodedConfig: config,
        },
      });
      invalidateLetterboxdCache();
    }
    setBusy(false);
  };

  const handleLogin = async () => {
    setBusy(true);
    setLoginError(null);
    const result = await login(username.trim(), password, totp || undefined);
    setBusy(false);
    if (result.kind === "success") {
      setPassword("");
      setTotp("");
      setNeeds2fa(false);
      update({
        letterboxd: { ...lb, enabled: true, mode: "full", username: result.session.username },
      });
      invalidateLetterboxdCache();
    } else if (result.kind === "2fa") {
      setNeeds2fa(true);
    } else {
      setLoginError(result.message);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setPassword("");
    setTotp("");
    setNeeds2fa(false);
    setLoginError(null);
  };

  const handleAddList = async () => {
    const url = listUrl.trim();
    if (!url) return;
    setListBusy(true);
    setListError(null);
    try {
      const ref = await resolveLetterboxdListPublic(url);
      const catalogId = `letterboxd-list-${ref.id}`;
      const next = {
        ...lb,
        listRefs: [
          ...lb.listRefs.filter((r) => r.id !== ref.id),
          { id: ref.id, name: ref.name, owner: ref.owner, filmCount: ref.filmCount },
        ],
        selectedCatalogs: lb.selectedCatalogs.includes(catalogId)
          ? lb.selectedCatalogs
          : [...lb.selectedCatalogs, catalogId],
      };
      update({ letterboxd: { ...next, encodedConfig: buildStremboxdConfig(next) } });
      setListUrl("");
      invalidateLetterboxdCache();
    } catch {
      setListError(t("Could not resolve that Letterboxd list URL."));
    }
    setListBusy(false);
  };

  const removeList = (id: string) => {
    const catalogId = `letterboxd-list-${id}`;
    const next = {
      ...lb,
      listRefs: lb.listRefs.filter((r) => r.id !== id),
      selectedCatalogs: lb.selectedCatalogs.filter((c) => c !== catalogId),
    };
    update({ letterboxd: { ...next, encodedConfig: buildStremboxdConfig(next) } });
    invalidateLetterboxdCache();
  };

  return (
    <>
      <Section
        title={t("Letterboxd")}
        subtitle={t(
          "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.",
        )}
      >
        <ToggleRow
          label={t("Enable Letterboxd integration")}
          sub={t(
            "Shows your Letterboxd catalogs on the home page and a Letterboxd panel on film pages.",
          )}
          value={lb.enabled}
          onChange={(on) => update({ letterboxd: { ...lb, enabled: on } })}
        />

        {lb.enabled && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Mode")}
              </label>
              <Segmented
                value={lb.mode}
                options={[
                  { value: "public", label: "Public" },
                  { value: "full", label: "Full" },
                ]}
                onChange={(m) => update({ letterboxd: { ...lb, mode: m } })}
              />
              <p className="text-[12.5px] leading-relaxed text-ink-subtle">
                {lb.mode === "public"
                  ? t(
                      "Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.",
                    )
                  : t(
                      "Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.",
                    )}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Letterboxd username")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setVerify(null);
                }}
                placeholder="e.g. karsten_runquist"
                spellCheck={false}
                autoComplete="off"
                className="h-12 rounded-xl border border-edge-soft bg-elevated px-4 text-[15px] text-ink placeholder:text-ink-subtle/55 outline-none focus:border-ink"
              />
            </div>

            {lb.mode === "full" && (
              <div className="flex flex-col gap-2.5">
                <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("Letterboxd password")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("Your Letterboxd password")}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-12 rounded-xl border border-edge-soft bg-elevated px-4 text-[15px] text-ink placeholder:text-ink-subtle/55 outline-none focus:border-ink"
                />
                {needs2fa && (
                  <input
                    type="text"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    placeholder={t("Two-factor authentication code")}
                    inputMode="numeric"
                    spellCheck={false}
                    autoComplete="off"
                    className="h-12 rounded-xl border border-edge-soft bg-elevated px-4 text-[15px] text-ink placeholder:text-ink-subtle/55 outline-none focus:border-ink"
                  />
                )}
                {loginError && <p className="text-[12.5px] text-red-300">{loginError}</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {lb.mode === "public" ? (
                <button
                  onClick={handleVerify}
                  disabled={busy || username.trim().length === 0}
                  className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Link2 size={15} strokeWidth={2.2} />
                  )}
                  {t("Connect / Verify")}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={busy || username.trim().length === 0 || password.length === 0}
                  className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Link2 size={15} strokeWidth={2.2} />
                  )}
                  {needs2fa ? t("Verify & connect") : t("Connect")}
                </button>
              )}
              <button
                onClick={() => openUrl("https://stremboxd.com/configure")}
                className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("About Stremboxd")}
                <ExternalLink size={13} strokeWidth={2.2} />
              </button>
            </div>

            {verify && (
              <div
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${
                  verify.ok
                    ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"
                    : "border-red-400/30 bg-red-400/5 text-red-200"
                }`}
              >
                {verify.ok ? (
                  <>
                    <Check size={15} strokeWidth={2.4} />
                    {t("Connected — {n} catalogs available", { n: verify.catalogs })}
                  </>
                ) : (
                  <>
                    <X size={15} strokeWidth={2.4} />
                    {verify.message}
                  </>
                )}
              </div>
            )}

            {isFullConnected && session && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 ring-1 ring-emerald-400/30 text-emerald-300">
                    <Check size={16} strokeWidth={2.4} />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-medium text-ink">
                      {session.displayName
                        ? `${session.displayName} (@${session.username})`
                        : `@${session.username}`}
                    </span>
                    <span className="text-[12px] text-ink-subtle">
                      {t("Full mode — diary, friends & ratings enabled")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-red-400/40 hover:text-red-300"
                >
                  <LogOut size={12} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Catalogs to show")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATALOG_OPTIONS.map((opt) => {
                  const selected = lb.selectedCatalogs.includes(opt.id);
                  const locked = !!opt.fullOnly && !isFullConnected;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !locked && toggleCatalog(opt.id, !selected)}
                      disabled={locked}
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-start text-[13px] transition-colors ${
                        locked
                          ? "cursor-not-allowed border-edge-soft/40 opacity-50"
                          : selected
                            ? "border-ink bg-ink/5 text-ink"
                            : "border-edge-soft text-ink-muted hover:border-edge"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          selected && !locked ? "border-ink bg-ink text-canvas" : "border-edge"
                        }`}
                      >
                        {selected && !locked && <Check size={13} strokeWidth={3} />}
                      </span>
                      {t(opt.label)}
                      {opt.fullOnly && (
                        <span className="ms-auto text-[10px] uppercase tracking-wider text-ink-subtle">
                          {t("Full")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Custom lists")}
              </label>
              {lb.listRefs.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {lb.listRefs.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {ref.name}
                        </span>
                        <span className="text-[11.5px] text-ink-subtle">
                          {ref.owner ? `${ref.owner} · ` : ""}
                          {ref.filmCount != null ? `${ref.filmCount} films` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => removeList(ref.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-red-400/10 hover:text-red-300"
                        aria-label={t("Remove list")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={listUrl}
                  onChange={(e) => setListUrl(e.target.value)}
                  placeholder={t("letterboxd.com/username/list/slug")}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 flex-1 rounded-xl border border-edge-soft bg-elevated px-4 text-[14px] text-ink placeholder:text-ink-subtle/55 outline-none focus:border-ink"
                />
                <button
                  onClick={handleAddList}
                  disabled={listBusy || listUrl.trim().length === 0}
                  className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50"
                >
                  {listBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {t("Add")}
                </button>
              </div>
              {listError && <p className="text-[12.5px] text-red-300">{listError}</p>}
            </div>

            <ToggleRow
              label={t("Show my rating on movie posters")}
              sub={t("Overlays your Letterboxd rating on catalog posters (when available).")}
              value={lb.showRatingsOnPosters}
              onChange={(on) => syncConfig({ showRatingsOnPosters: on })}
            />

            <ToggleRow
              label={t("Blur reviews by default")}
              sub={t("Reviews on film pages are blurred until you reveal them.")}
              value={!!settings.blurComments}
              onChange={(on) => update({ blurComments: on })}
            />

            {lb.hiddenCatalogs.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("Hidden catalogs")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {lb.hiddenCatalogs.map((id) => {
                    const opt = CATALOG_OPTIONS.find((o) => o.id === id);
                    const listRef = lb.listRefs.find((r) => `letterboxd-list-${r.id}` === id);
                    const label = opt?.label ?? listRef?.name ?? id;
                    return (
                      <button
                        key={id}
                        onClick={() =>
                          update({
                            letterboxd: {
                              ...lb,
                              hiddenCatalogs: lb.hiddenCatalogs.filter((h) => h !== id),
                            },
                          })
                        }
                        className="flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                      >
                        {label}
                        <span className="text-[10px] uppercase tracking-wider text-accent">
                          {t("Show")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
}
