import type { Meta } from "@/lib/cinemeta";
import type { ChatMessage } from "@/lib/ai-chat";
import { normalizeFollowUps } from "@/lib/ai-chat-prompts";

export type ModelPickerAnchor = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ModelPickerLayout = {
  top: number;
  left: number;
  maxHeight: number;
  width: number;
};

export function positionChatModelPicker(
  anchor: ModelPickerAnchor,
  viewport: { width: number; height: number },
  rtl: boolean,
): ModelPickerLayout {
  const margin = 12;
  const gap = 6;
  const width = Math.min(256, Math.max(0, viewport.width - margin * 2));
  const below = Math.max(0, viewport.height - anchor.bottom - margin - gap);
  const above = Math.max(0, anchor.top - margin - gap);
  const openBelow = below >= Math.min(240, above) || above < 180;
  const availableHeight = openBelow ? below : above;
  const maxHeight = Math.min(360, Math.max(96, availableHeight));
  const requestedTop = openBelow ? anchor.bottom + gap : anchor.top - gap - maxHeight;
  const top = Math.max(margin, Math.min(requestedTop, viewport.height - maxHeight - margin));
  const alignedStart = rtl ? anchor.right - width : anchor.left;
  const left = Math.max(margin, Math.min(alignedStart, viewport.width - width - margin));

  return { top, left, maxHeight, width };
}

const QUICK_YEAR = new Date().getFullYear();
const GENERAL_QUICK_PROMPT_KEYS = [
  "Suggest a fun recent movie for tonight",
  "Show me a complete movie franchise in order",
  "Best science fiction films from {year1} and {year2}",
  "When does the next Avatar movie release?",
];
const TITLE_QUICK_PROMPT_KEYS = [
  "What is the story of {title}?",
  "Who are the main cast members in {title}?",
  "Is {title} worth watching?",
  "What should I know before watching {title}?",
];
export function buildChatQuickPrompts(
  messages: ChatMessage[],
  currentMeta: Meta | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (messages.length) {
    const latestUserIndex =
      messages.length - 1 - [...messages].reverse().findIndex((message) => message.role === "user");
    const latest = messages.at(-1);
    const completeReply =
      latestUserIndex < messages.length - 1 &&
      latest?.role === "model" &&
      !latest.loading &&
      !latest.error;
    return {
      quickPromptContext: { media: null },
      quickPrompts: completeReply
        ? normalizeFollowUps(latest.followUps, messages[latestUserIndex]?.text)
        : [],
    };
  }
  const media =
    currentMeta && (currentMeta.type === "movie" || currentMeta.type === "series")
      ? currentMeta
      : null;
  return {
    quickPromptContext: { media },
    quickPrompts: media
      ? TITLE_QUICK_PROMPT_KEYS.map((key) => t(key, { title: media.name })).slice(0, 3)
      : [
          t(GENERAL_QUICK_PROMPT_KEYS[0]),
          t(GENERAL_QUICK_PROMPT_KEYS[1]),
          t(GENERAL_QUICK_PROMPT_KEYS[2], { year1: QUICK_YEAR - 1, year2: QUICK_YEAR }),
          t(GENERAL_QUICK_PROMPT_KEYS[3]),
        ],
  };
}
