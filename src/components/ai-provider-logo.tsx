import type { AiProvider } from "@/lib/ai-models";
import anthropicLogo from "@/assets/ai-logos/anthropic.png";
import deepseekLogo from "@/assets/ai-logos/deepseek.png";
import geminiLogo from "@/assets/ai-logos/gemini.png";
import groqLogo from "@/assets/ai-logos/groq.png";
import metaLogo from "@/assets/ai-logos/meta.png";
import mistralLogo from "@/assets/ai-logos/mistral.png";
import moonshotLogo from "@/assets/ai-logos/moonshot.ico";
import openaiLogo from "@/assets/ai-logos/openai.png";
import openrouterLogo from "@/assets/ai-logos/openrouter.png";
import qwenLogo from "@/assets/ai-logos/qwen.png";
import xaiLogo from "@/assets/ai-logos/xai.png";

export const AI_LOGOS: Record<AiProvider | "openrouter", string> = {
  openai: openaiLogo,
  anthropic: anthropicLogo,
  gemini: geminiLogo,
  meta: metaLogo,
  mistral: mistralLogo,
  deepseek: deepseekLogo,
  xai: xaiLogo,
  qwen: qwenLogo,
  moonshot: moonshotLogo,
  nvidia: openrouterLogo,
  groq: groqLogo,
  openrouter: openrouterLogo,
};

export function ProviderLogo({
  provider,
  size = 19,
  round = false,
}: {
  provider: AiProvider;
  size?: number;
  round?: boolean;
}) {
  return (
    <img
      src={AI_LOGOS[provider] ?? AI_LOGOS.openrouter}
      alt=""
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: round ? 9999 : Math.max(4, Math.round(size * 0.26)),
      }}
      className={`shrink-0 bg-white object-contain ${round ? "" : "ring-1 ring-black/10"}`}
    />
  );
}
