import { useState } from "react";
import { Key, X, Globe, ExternalLink } from "lucide-react";
import geminiLogo from "@/assets/ai-logos/gemini.png";
import openrouterLogo from "@/assets/ai-logos/openrouter.png";
import groqLogo from "@/assets/ai-logos/groq.png";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export function ChatSettings({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  const t = useT();
  const [openrouterDraft, setOpenrouterDraft] = useState(settings.aiSearchKey);
  const [groqDraft, setGroqDraft] = useState(settings.aiGroqKey);
  const [geminiDraft, setGeminiDraft] = useState(settings.geminiApiKey);
  const [tavilyDraft, setTavilyDraft] = useState(settings.tavilyApiKey);
  const handleSaveKeys = () => {
    update({
      aiSearchKey: openrouterDraft.trim(),
      aiGroqKey: groqDraft.trim(),
      geminiApiKey: geminiDraft.trim(),
      tavilyApiKey: tavilyDraft.trim(),
    });
    onClose();
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("AI keys & web search settings")}
      data-tv-focus-scope
      data-navigation-isolated
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-md rounded-3xl border border-edge-soft bg-canvas p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-accent" />
            <h3 className="font-bold text-sm text-ink">{t("AI keys & web search settings")}</h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label={t("Close")}
            data-tv-modal-close
            data-navigation-isolated-close
            className="rounded-xl p-1 text-ink/85 hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* OpenRouter Key Field */}
        <div data-tv-text-field className="mb-4">
          <label
            htmlFor="chat-openrouter-key"
            className="flex items-center gap-2 text-xs font-semibold text-ink mb-1"
          >
            <img src={openrouterLogo} alt="" className="h-4 w-4 object-contain" />
            {t("OpenRouter API Key")}
          </label>
          <input
            type="password"
            id="chat-openrouter-key"
            autoComplete="off"
            spellCheck={false}
            value={openrouterDraft}
            onChange={(e) => setOpenrouterDraft(e.target.value)}
            placeholder="sk-or-..."
            className="w-full rounded-xl border border-edge-soft bg-canvas/90 px-3.5 py-2 text-xs text-ink placeholder:text-ink/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>

        {/* Groq Key Field */}
        <div data-tv-text-field className="mb-4">
          <label
            htmlFor="chat-groq-key"
            className="flex items-center gap-2 text-xs font-semibold text-ink mb-1"
          >
            <img src={groqLogo} alt="" className="h-4 w-4 object-contain" />
            {t("Groq API Key")}
          </label>
          <input
            type="password"
            id="chat-groq-key"
            autoComplete="off"
            spellCheck={false}
            value={groqDraft}
            onChange={(e) => setGroqDraft(e.target.value)}
            placeholder="gsk-..."
            className="w-full rounded-xl border border-edge-soft bg-canvas/90 px-3.5 py-2 text-xs text-ink placeholder:text-ink/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>

        {/* Google Gemini Key Field */}
        <div data-tv-text-field className="mb-4">
          <label
            htmlFor="chat-gemini-key"
            className="flex items-center gap-2 text-xs font-semibold text-ink mb-1"
          >
            <img src={geminiLogo} alt="" className="h-4 w-4 object-contain" />
            {t("Google Gemini API Key")}
          </label>
          <p className="text-[11px] text-ink/85 leading-relaxed mb-2">
            {t("Free API key from Google AI Studio:")}{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-accent underline hover:brightness-110"
            >
              aistudio.google.com/apikey
              <ExternalLink size={10} />
            </a>
          </p>
          <input
            type="password"
            id="chat-gemini-key"
            autoComplete="off"
            spellCheck={false}
            value={geminiDraft}
            onChange={(e) => setGeminiDraft(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-xl border border-edge-soft bg-canvas/90 px-3.5 py-2 text-xs text-ink placeholder:text-ink/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>

        {/* Tavily Web Search Key Field */}
        <div data-tv-text-field className="mb-4 border-t border-edge-soft/60 pt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe size={13} className="text-emerald-400" />
            <label htmlFor="chat-tavily-key" className="text-xs font-semibold text-ink">
              {t("Tavily Search API Key (Optional)")}
            </label>
          </div>
          <p className="text-[11px] text-ink/85 leading-relaxed mb-2">
            {t(
              "Enables real-time web search for upcoming movie release dates and latest film news. Free key at:",
            )}{" "}
            <a
              href="https://tavily.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-emerald-400 underline hover:brightness-110"
            >
              tavily.com
              <ExternalLink size={10} />
            </a>
          </p>
          <input
            type="password"
            id="chat-tavily-key"
            autoComplete="off"
            spellCheck={false}
            value={tavilyDraft}
            onChange={(e) => setTavilyDraft(e.target.value)}
            placeholder="tvly-..."
            className="w-full rounded-xl border border-edge-soft bg-canvas/90 px-3.5 py-2 text-xs text-ink placeholder:text-ink/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-edge-soft/60">
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-xl px-3 py-1.5 text-xs text-ink/85 hover:bg-elevated hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSaveKeys}
            className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-canvas shadow hover:brightness-110 active:scale-95"
          >
            {t("Save Settings")}
          </button>
        </div>
      </div>
    </div>
  );
}
