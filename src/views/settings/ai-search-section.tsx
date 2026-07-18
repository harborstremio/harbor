import { useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { AI_MODELS, DEFAULT_AI_MODEL, GROQ_MODELS, providerForModel } from "@/lib/ai-models";
import openrouterLogo from "@/assets/ai-logos/openrouter.png";
import groqLogo from "@/assets/ai-logos/groq.png";
import jinaLogo from "@/assets/ai-logos/jina.png";
import { AiModelSelect } from "./ai-model-select";
import { ExtLink, KeyField, Section, Segmented, ToggleRow } from "./shared";

type ProviderTab = "openrouter" | "groq";

export function AiSearchSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const keyDrafts = {
    openrouter: useState(settings.aiSearchKey),
    groq: useState(settings.aiGroqKey),
  };
  const [savedFlags, setSavedFlags] = useState<Record<ProviderTab, boolean>>({
    openrouter: false,
    groq: false,
  });
  const timer = useRef<number | null>(null);
  const flash = (tab: ProviderTab) => {
    setSavedFlags((s) => ({ ...s, [tab]: true }));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSavedFlags((s) => ({ ...s, [tab]: false })), 1800);
  };

  // Detect provider from current model so the tab reflects user's existing selection
  const currentProvider = providerForModel(settings.aiSearchModel || DEFAULT_AI_MODEL);
  const initialTab: ProviderTab = currentProvider === "groq" ? "groq" : "openrouter";
  const [tab, _setTab] = useState<ProviderTab>(initialTab);

  const [openrouterKey, setOpenrouterKey] = keyDrafts.openrouter;
  const [groqKey, setGroqKey] = keyDrafts.groq;
  const [jinaDraft, setJinaDraft] = useState(settings.jinaKey);
  const renderedModel =
    tab === "groq" && currentProvider !== "groq"
      ? GROQ_MODELS[0].id
      : tab === "openrouter" && currentProvider === "groq"
        ? AI_MODELS[0].id
        : settings.aiSearchModel;

  return (
    <Section
      title={t("AI search")}
      subtitle={t(
        "Type what you want in plain language and let a model find it. Bring your own API key.",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Provider")}
        </span>
        <Segmented
          value={tab}
          onChange={(v) => _setTab(v)}
          options={[
            { value: "openrouter", label: "OpenRouter" },
            { value: "groq", label: "Groq" },
          ]}
        />
      </div>

      {tab === "openrouter" ? (
        <>
          <KeyField
            label={t("AI Search · natural-language search")}
            placeholder={t("OpenRouter API key (sk-or-...)")}
            iconSrc={openrouterLogo}
            value={openrouterKey}
            onChange={setOpenrouterKey}
            onSave={() => {
              update({ aiSearchKey: openrouterKey.trim() });
              flash("openrouter");
            }}
            saved={savedFlags.openrouter}
            help={
              <>
                Adds an "Ask AI" button to search, so you can type things like{" "}
                <em>popular French TV shows last year</em>. Get a key at{" "}
                <ExtLink href="https://openrouter.ai/keys">openrouter.ai/keys</ExtLink>. It only
                runs when you tap that button, so it never costs anything unless you ask.
              </>
            }
          />
          <AiModelSelect
            value={renderedModel}
            onChange={(v) => update({ aiSearchModel: v })}
            models={AI_MODELS}
            defaultModel={DEFAULT_AI_MODEL}
          />
        </>
      ) : (
        <>
          <KeyField
            label={t("AI Search · Groq LPU inference")}
            placeholder={t("Groq API key (gsk-...)")}
            iconSrc={groqLogo}
            value={groqKey}
            onChange={setGroqKey}
            onSave={() => {
              update({ aiGroqKey: groqKey.trim() });
              flash("groq");
            }}
            saved={savedFlags.groq}
            help={
              <>
                Adds an "Ask AI" button to search, so you can type things like{" "}
                <em>popular French TV shows last year</em>. Get a key at{" "}
                <ExtLink href="https://console.groq.com/keys">console.groq.com/keys</ExtLink>. Groq
                runs open-source models on its LPU hardware with a generous free tier — every model
                listed below runs on the free tier.
              </>
            }
          />
          <AiModelSelect
            value={renderedModel}
            onChange={(v) => update({ aiSearchModel: v })}
            models={GROQ_MODELS}
            defaultModel={GROQ_MODELS[0].id}
          />
        </>
      )}

      <div className="mt-1 flex flex-col gap-3 border-t border-edge-soft pt-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium tracking-tight text-ink">
            {t("Live web (Jina Reader)")}
          </span>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t("Augments AI picks with current web results before asking the model. Powered by")}{" "}
            <ExtLink href="https://jina.ai/reader">Jina Reader</ExtLink>
            {t(". Works without a key at low volume; add a key for higher quotas.")}
          </p>
        </div>
        <ToggleRow
          label={t("Use live web context")}
          sub={t("Fetches DuckDuckGo results and feeds top hits into the model prompt.")}
          value={settings.aiWebSearch}
          onChange={(v) => update({ aiWebSearch: v })}
        />
        <KeyField
          label={t("Jina API key (optional)")}
          placeholder={t("jina_...")}
          iconSrc={jinaLogo}
          value={jinaDraft}
          onChange={setJinaDraft}
          onSave={() => update({ jinaKey: jinaDraft.trim() })}
          saved={false}
          help={
            <>
              Get a key at <ExtLink href="https://jina.ai/reader">jina.ai/reader</ExtLink>{" "}
              {t("for higher rate limits; leave blank for the free anonymous tier.")}
            </>
          }
        />
      </div>
    </Section>
  );
}
