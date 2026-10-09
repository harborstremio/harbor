import { useSubTabs } from "./sub-tabs";
import { Info } from "./icons";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SHADER_CATALOG } from "@/lib/player/shader-catalog";
import { shaderDir } from "@/lib/shaders";
import { Section, ToggleRow } from "./shared";
import { SettingGroup } from "./kit";
import { isTauri } from "./player-panel/internals";
import { Anime4kShaderList } from "./player-panel/anime4k-shader-list";
import { ShaderCard } from "./shaders-panel/shader-card";
import { STAGE_LABEL, STAGE_SEQUENCE } from "./shaders-panel/stages";

const ANIME_IDS = new Set(["fsrcnnx", "ravu", "nnedi3"]);

type Tab = "anime4k" | "more";

export function ShadersPanel() {
  const [tab, setTab] = useState<Tab>("anime4k");
  const { settings, update } = useSettings();
  const t = useT();

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    const missing = SHADER_CATALOG.filter((e) => !settings.playerShaders?.[e.id]?.dir);
    if (missing.length === 0) return;
    (async () => {
      const found: Record<string, string> = {};
      for (const e of missing) {
        const dir = await shaderDir(e.id).catch(() => null);
        if (dir) found[e.id] = dir;
      }
      if (cancelled || Object.keys(found).length === 0) return;
      const next = { ...settings.playerShaders };
      for (const [id, dir] of Object.entries(found)) {
        next[id] = { ...(next[id] ?? { enabled: false }), dir };
      }
      update({ playerShaders: next });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSubTabs(
    isTauri
      ? [
          { id: "anime4k", label: t("Anime Shaders") },
          { id: "more", label: t("More shaders") },
        ]
      : [],
    tab,
    (id) => setTab(id as Tab),
  );

  if (!isTauri) {
    return (
      <Section
        title={t("Desktop only")}
        subtitle={t("Picture shaders run on the bundled mpv engine in the Harbor desktop app. They have no effect in the browser.")}
      >
        <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <Info size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-ink-subtle" />
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t("Download the desktop app to use shaders.")}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "anime4k" && (
        <>
          <Section
            title={t("Anime4K upscaling")}
            subtitle={t("Sharpen lines and clean up color gradients in anime. Enable Anime4K to download its shader pack and choose a preset.")}
          >
            <ToggleRow
              label={t("Enable Anime4K")}
              sub={t("Processes video while it plays. Uses extra graphics power.")}
              value={settings.playerAnime4k}
              onChange={(v) => update({ playerAnime4k: v })}
            />
            {settings.playerAnime4k && (
              <ToggleRow
                label={t("Only on anime")}
                sub={t(
                  "Skip live-action video. Turn this off to apply Anime4K to all videos.",
                )}
                value={settings.playerAnime4kAnimeOnly}
                onChange={(v) => update({ playerAnime4kAnimeOnly: v })}
              />
            )}
            {settings.playerAnime4k && (
              <ToggleRow
                label={t("Show Anime4K indicator")}
                sub={t("Show a badge and frame rate while Anime4K is running.")}
                value={settings.playerAnime4kIndicator}
                onChange={(v) => update({ playerAnime4kIndicator: v })}
              />
            )}
          </Section>

          {settings.playerAnime4k && <Anime4kShaderList />}

          <Section title={t("Anime upscalers")}>
            {SHADER_CATALOG.filter((e) => ANIME_IDS.has(e.id)).map((entry) => (
              <ShaderCard key={entry.id} entry={entry} />
            ))}
          </Section>
        </>
      )}

      {tab === "more" && (
        <Section
          title={t("More picture shaders")}
          subtitle={t("Optional video effects downloaded from their authors. Harbor applies enabled shaders in the order shown below.")}
        >
          {STAGE_SEQUENCE.map((stage) => {
            const items = SHADER_CATALOG.filter((e) => e.stage === stage && !ANIME_IDS.has(e.id));
            if (items.length === 0) return null;
            return (
              <SettingGroup key={stage} label={t(STAGE_LABEL[stage])}>
                {items.map((entry) => (
                  <ShaderCard key={entry.id} entry={entry} />
                ))}
              </SettingGroup>
            );
          })}
        </Section>
      )}
    </div>
  );
}
