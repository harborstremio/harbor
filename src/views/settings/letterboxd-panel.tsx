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
import { SettingRow } from "./kit";
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
      update({ letterboxd: { ...lb, enabled: true, mode: "full", username: result.session.username } });
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
        listRefs: [...lb.listRefs.filter((r) => r.id !== ref.id), { id: ref.id, name: ref.name, owner: ref.owner, filmCount: ref.filmCount }],
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
        subtitle={t("Bring your Letterboxd watchlist, diary, liked films and lists into Harbor via the Stremboxd bridge.")}
      >
        <ToggleRow
          label={t("Enable Letterboxd integration")}
          sub={t("Shows your Letterboxd catalogs on the home page and a Letterboxd panel on film pages.")}
          value={lb.enabled}
          onChange={(on) => update({ letterboxd: { ...lb, enabled: on } })}
        />

        {lb.enabled && (
          <>
            <SettingRow
              label={t("Mode")}
              desc={
                lb.mode === "public"
                  ? t("Public mode uses just your username: watchlist, liked films, popular and Top 250. No password needed.")
                  : t("Full mode signs in with your Letterboxd password to also unlock your diary, friends activity and your personal ratings. Your password is sent only to Stremboxd to obtain a token — Harbor never stores it.")
              }
            >
              <Segmented
                value={lb.mode}
                options={[
                  { value: "public", label: "Public" },
                  { value: "full", label: "Full" },
                ]}
                onChange={(m) => update({ letterboxd: { ...lb, mode: m } })}
              />
            </SettingRow>

            <SettingRow label={t("Letterboxd username")}>
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
                className="h-9 w-[240px] shrink-0 rounded-md bg-canvas px-3 text-[13.5px] text-ink placeholder:text-ink-subtle/55 outline-none"
              />
            </SettingRow>

            {lb.mode === "full" && (
              <SettingRow label={t("Letterboxd password")} warn={loginError ?? undefined}>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("Your Letterboxd password")}
                    spellCheck={false}
                    autoComplete="off"
                    className="h-9 w-[240px] rounded-md bg-canvas px-3 text-[13.5px] text-ink placeholder:text-ink-subtle/55 outline-none"
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
                      className="h-9 w-[240px] rounded-md bg-canvas px-3 text-[13.5px] text-ink placeholder:text-ink-subtle/55 outline-none"
                    />
                  )}
                </div>
              </SettingRow>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {lb.mode === "public" ? (
                <button
                  onClick={handleVerify}
                  disabled={busy || username.trim().length === 0}
                  className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} strokeWidth={2.2} />}
                  {t("Connect / Verify")}
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={busy || username.trim().length === 0 || password.length === 0}
                  className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} strokeWidth={2.2} />}
                  {needs2fa ? t("Verify & connect") : t("Connect")}
                </button>
              )}
              <button
                onClick={() => openUrl("https://stremboxd.com/configure")}
                className="flex h-11 items-center gap-2 rounded-md bg-elevated px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t("About Stremboxd")}
                <ExternalLink size={14} strokeWidth={2.2} />
              </button>
            </div>

            {verify && (
              <div
                className={`flex items-center gap-2 rounded-md bg-elevated px-4 py-3 text-[13px] ${
                  verify.ok ? "text-success" : "text-danger"
                }`}
              >
                {verify.ok ? (
                  <>
                    <Check size={16} strokeWidth={2.4} />
                    {t("Connected — {n} catalogs available", { n: verify.catalogs })}
                  </>
                ) : (
                  <>
                    <X size={16} strokeWidth={2.4} />
                    {verify.message}
                  </>
                )}
              </div>
            )}

            {isFullConnected && session && (
              <SettingRow
                icon={
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check size={16} strokeWidth={2.4} />
                  </span>
                }
                label={
                  session.displayName
                    ? `${session.displayName} (@${session.username})`
                    : `@${session.username}`
                }
                desc={t("Full mode — diary, friends & ratings enabled")}
              >
                <button
                  onClick={handleDisconnect}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-raised px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-danger"
                >
                  <LogOut size={12} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </SettingRow>
            )}

            <SettingRow wide label={t("Catalogs to show")}>
              <div className="grid w-full grid-cols-2 gap-1.5">
                {CATALOG_OPTIONS.map((opt) => {
                  const selected = lb.selectedCatalogs.includes(opt.id);
                  const locked = !!opt.fullOnly && !isFullConnected;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !locked && toggleCatalog(opt.id, !selected)}
                      disabled={locked}
                      className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-start text-[13px] transition-colors ${
                        locked
                          ? "cursor-not-allowed bg-canvas opacity-50"
                          : selected
                            ? "bg-raised text-ink"
                            : "bg-canvas text-ink-muted hover:text-ink"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] transition-colors ${
                          selected && !locked ? "bg-ink text-canvas" : "bg-elevated"
                        }`}
                      >
                        {selected && !locked && <Check size={14} strokeWidth={3} />}
                      </span>
                      {t(opt.label)}
                      {opt.fullOnly && (
                        <span className="ms-auto text-[10.5px] uppercase tracking-wider text-ink-subtle">{t("Full")}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            <SettingRow wide label={t("Custom lists")}>
              <div className="flex w-full flex-col gap-1.5">
                {lb.listRefs.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {lb.listRefs.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-[13.5px] font-medium text-ink">{ref.name}</span>
                          <span className="text-[11.5px] text-ink-subtle">
                            {ref.owner ? `${ref.owner} · ` : ""}
                            {ref.filmCount != null ? `${ref.filmCount} films` : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => removeList(ref.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
                          aria-label={t("Remove list")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={listUrl}
                    onChange={(e) => setListUrl(e.target.value)}
                    placeholder={t("letterboxd.com/username/list/slug")}
                    spellCheck={false}
                    autoComplete="off"
                    className="h-9 min-w-0 flex-1 rounded-md bg-canvas px-3 text-[13.5px] text-ink placeholder:text-ink-subtle/55 outline-none"
                  />
                  <button
                    onClick={handleAddList}
                    disabled={listBusy || listUrl.trim().length === 0}
                    className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-raised px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {listBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {t("Add")}
                  </button>
                </div>
                {listError && <p className="text-[12.5px] text-danger">{listError}</p>}
              </div>
            </SettingRow>

            <ToggleRow
              label={t("Show my rating on movie posters")}
              sub={t("Overlays your Letterboxd rating on catalog posters (when available).")}
              value={lb.showRatingsOnPosters}
              onChange={(on) => syncConfig({ showRatingsOnPosters: on })}
            />

            <ToggleRow
              label={t("Blur comments and reviews by default")}
              sub={t(
                "Comments and reviews on detail pages stay blurred until you reveal them, even when they are not tagged as spoilers. This one switch covers Trakt and Letterboxd.",
              )}
              value={!!settings.blurComments}
              onChange={(on) => update({ blurComments: on })}
            />

            {lb.hiddenCatalogs.length > 0 && (
              <SettingRow wide label={t("Hidden catalogs")}>
                <div className="flex w-full flex-wrap gap-1.5">
                  {lb.hiddenCatalogs.map((id) => {
                    const opt = CATALOG_OPTIONS.find((o) => o.id === id);
                    const listRef = lb.listRefs.find((r) => `letterboxd-list-${r.id}` === id);
                    const label = opt?.label ?? listRef?.name ?? id;
                    return (
                      <button
                        key={id}
                        onClick={() => update({ letterboxd: { ...lb, hiddenCatalogs: lb.hiddenCatalogs.filter((h) => h !== id) } })}
                        className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
                      >
                        {label}
                        <span className="text-[10.5px] uppercase tracking-wider text-accent">{t("Show")}</span>
                      </button>
                    );
                  })}
                </div>
              </SettingRow>
            )}
          </>
        )}
      </Section>
    </>
  );
}
