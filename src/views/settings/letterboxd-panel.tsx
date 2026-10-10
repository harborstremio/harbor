import { Check, ExternalLink, Link2, Loader2, LogOut, Plus, Trash2, X } from "./icons";
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
import { ROW_DESC, SettingGroup, SettingRow } from "./kit";
import { SButton, SRow } from "./ui";
import type { LetterboxdSettings } from "@/lib/settings/types";

type CatalogOption = { id: string; label: string; sub: string; fullOnly?: boolean };

const CATALOG_OPTIONS: CatalogOption[] = [
  {
    id: "letterboxd-watchlist",
    label: "Watchlist",
    sub: "Shows the films you have saved to watch on Letterboxd.",
  },
  {
    id: "letterboxd-diary",
    label: "Diary",
    sub: "Shows everything you have logged, most recent first.",
    fullOnly: true,
  },
  {
    id: "letterboxd-liked",
    label: "Liked Films",
    sub: "Shows the films you have hearted on Letterboxd.",
  },
  {
    id: "letterboxd-friends",
    label: "Friends",
    sub: "Shows what the people you follow have been watching lately.",
    fullOnly: true,
  },
  {
    id: "letterboxd-recommended",
    label: "Recommended for You",
    sub: "Shows the picks Letterboxd makes from your own viewing history.",
    fullOnly: true,
  },
  {
    id: "letterboxd-popular",
    label: "Popular This Week",
    sub: "Shows the films the whole of Letterboxd is watching right now.",
  },
  {
    id: "letterboxd-top250",
    label: "Top 250",
    sub: "Shows the highest rated narrative features of all time.",
  },
];

const TEXT_FIELD =
  "h-11 w-full max-w-[520px] min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

  const listMeta = (ref: LetterboxdSettings["listRefs"][number]) => {
    if (ref.owner && ref.filmCount != null)
      return t("A list by {owner}, {n} films.", { owner: ref.owner, n: ref.filmCount });
    if (ref.owner) return t("A list by {owner}.", { owner: ref.owner });
    if (ref.filmCount != null) return t("{n} films.", { n: ref.filmCount });
    return t("A Letterboxd list you added by address.");
  };

  const fullLock = t("Sign in with Full mode to use this catalog.");
  const isPublic = lb.mode === "public";
  const connectDisabled = isPublic
    ? busy || username.trim().length === 0
    : busy || username.trim().length === 0 || password.length === 0;

  return (
    <Section
      title={t("Letterboxd")}
      subtitle={t(
        "Bring your Letterboxd watchlist, diary, liked films and lists into Harbor through the Stremboxd bridge.",
      )}
    >
      <ToggleRow
        label={t("Enable Letterboxd integration")}
        sub={t(
          "Turning this on adds your Letterboxd catalogs to the home page and a Letterboxd panel to every film page.",
        )}
        value={lb.enabled}
        onChange={(on) => update({ letterboxd: { ...lb, enabled: on } })}
      />

      {lb.enabled && (
        <>
          <SettingGroup label={t("Connection")}>
            <SettingRow
              label={t("Mode")}
              desc={
                isPublic
                  ? t(
                      "Public mode reads your account with nothing but your username. You get your watchlist, liked films, popular this week and the Top 250, and no password is needed.",
                    )
                  : t(
                      "Full mode signs in with your Letterboxd password so your diary, friends activity and personal ratings work too. The password goes only to Stremboxd to fetch a token, and Harbor never stores it.",
                    )
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

            <SettingRow
              wide
              label={t("Letterboxd username")}
              desc={t("The handle in your profile address, letterboxd.com/your-name.")}
            >
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setVerify(null);
                }}
                placeholder="your-name"
                spellCheck={false}
                autoComplete="off"
                className={TEXT_FIELD}
              />
            </SettingRow>

            {!isPublic && (
              <SettingRow
                wide
                label={t("Letterboxd password")}
                desc={t("Sent once to Stremboxd to obtain a sign-in token. Harbor never keeps it.")}
                warn={loginError ?? undefined}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("Your Letterboxd password")}
                  spellCheck={false}
                  autoComplete="off"
                  className={TEXT_FIELD}
                />
              </SettingRow>
            )}

            {!isPublic && needs2fa && (
              <SettingRow
                wide
                label={t("Two-factor authentication code")}
                desc={t("Letterboxd asked for a second step. Enter the six digit code, then connect again.")}
              >
                <input
                  type="text"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="off"
                  className={TEXT_FIELD}
                />
              </SettingRow>
            )}

            <SettingRow
              label={isPublic ? t("Connect / Verify") : t("Connect")}
              desc={
                isPublic
                  ? t("Checks the username against Stremboxd and turns on the catalogs it finds.")
                  : t("Signs in to Letterboxd and unlocks your diary, friends activity and ratings.")
              }
            >
              <SButton
                variant="primary"
                onClick={isPublic ? handleVerify : handleLogin}
                disabled={connectDisabled}
              >
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Link2 size={18} strokeWidth={2.2} />
                )}
                {isPublic ? t("Connect") : needs2fa ? t("Verify & connect") : t("Connect")}
              </SButton>
            </SettingRow>

            {verify && (
              <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
                {verify.ok ? (
                  <Check size={18} strokeWidth={2.4} className="mt-[2px] shrink-0 text-success" />
                ) : (
                  <X size={18} strokeWidth={2.4} className="mt-[2px] shrink-0 text-danger" />
                )}
                <p className={`max-w-[66ch] ${ROW_DESC}`}>
                  {verify.ok
                    ? t("Connected. {n} catalogs are available.", { n: verify.catalogs })
                    : verify.message}
                </p>
              </div>
            )}

            {isFullConnected && session && (
              <SettingRow
                label={t("Signed in")}
                desc={
                  <>
                    {session.displayName
                      ? `${session.displayName} (@${session.username})`
                      : `@${session.username}`}
                    {". "}
                    {t("Full mode is active, so diary, friends activity and your ratings all work.")}
                  </>
                }
              >
                <SButton variant="danger" onClick={handleDisconnect}>
                  <LogOut size={18} strokeWidth={2.2} />
                  {t("Disconnect")}
                </SButton>
              </SettingRow>
            )}

            <SRow
              title={t("About Stremboxd")}
              description={t(
                "Opens stremboxd.com, the community bridge that reads Letterboxd on Harbor's behalf.",
              )}
              trailing={<ExternalLink size={18} className="text-ink-subtle" />}
              onClick={() => openUrl("https://stremboxd.com/configure")}
            />
          </SettingGroup>

          <SettingGroup label={t("Catalogs to show")}>
            {CATALOG_OPTIONS.map((opt) => (
              <ToggleRow
                key={opt.id}
                label={t(opt.label)}
                sub={t(opt.sub)}
                value={lb.selectedCatalogs.includes(opt.id)}
                onChange={(on) => toggleCatalog(opt.id, on)}
                lockReason={opt.fullOnly && !isFullConnected ? fullLock : undefined}
              />
            ))}
          </SettingGroup>

          <SettingGroup label={t("Custom lists")}>
            <SettingRow
              wide
              label={t("Add a list")}
              desc={t("Paste the address of any public Letterboxd list to add it as its own row.")}
              warn={listError ?? undefined}
            >
              <div className="flex w-full max-w-[520px] flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={listUrl}
                  onChange={(e) => setListUrl(e.target.value)}
                  placeholder={t("letterboxd.com/username/list/slug")}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 min-w-[220px] flex-1 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <SButton
                  onClick={handleAddList}
                  disabled={listBusy || listUrl.trim().length === 0}
                >
                  {listBusy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {t("Add")}
                </SButton>
              </div>
            </SettingRow>

            {lb.listRefs.map((ref) => (
              <SRow
                key={ref.id}
                title={ref.name}
                description={listMeta(ref)}
                trailing={
                  <SButton variant="danger" onClick={() => removeList(ref.id)}>
                    <Trash2 size={18} />
                    {t("Remove")}
                  </SButton>
                }
              />
            ))}
          </SettingGroup>

          <SettingGroup label={t("On screen")}>
            <ToggleRow
              label={t("Show my rating on movie posters")}
              sub={t(
                "Puts the score you gave a film in the corner of its poster, wherever Letterboxd has one for you.",
              )}
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
          </SettingGroup>

          {lb.hiddenCatalogs.length > 0 && (
            <SettingGroup label={t("Hidden catalogs")}>
              <p className={`max-w-[70ch] ${ROW_DESC}`}>
                {t("These rows are switched on but hidden from your home page. Choose Show to bring one back.")}
              </p>
              {lb.hiddenCatalogs.map((id) => {
                const opt = CATALOG_OPTIONS.find((o) => o.id === id);
                const listRef = lb.listRefs.find((r) => `letterboxd-list-${r.id}` === id);
                const label = opt ? t(opt.label) : (listRef?.name ?? id);
                return (
                  <SRow
                    key={id}
                    title={label}
                    trailing={
                      <SButton
                        onClick={() =>
                          update({
                            letterboxd: {
                              ...lb,
                              hiddenCatalogs: lb.hiddenCatalogs.filter((h) => h !== id),
                            },
                          })
                        }
                      >
                        {t("Show")}
                      </SButton>
                    }
                  />
                );
              })}
            </SettingGroup>
          )}
        </>
      )}
    </Section>
  );
}
