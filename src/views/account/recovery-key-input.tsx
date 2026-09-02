import { Fragment, useRef, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { useT } from "@/lib/i18n";

const GROUPS = 4;
const LEN = 5;
export const RECOVERY_KEY_LENGTH = GROUPS * LEN;

const clean = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function RecoveryKeyInput({
  onChange,
  autoFocus,
}: {
  onChange: (code: string) => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [segs, setSegs] = useState<string[]>(() => Array(GROUPS).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string[]) => {
    setSegs(next);
    onChange(next.join(""));
  };

  const spread = (raw: string, from = 0) => {
    const next = from === 0 ? Array(GROUPS).fill("") : [...segs];
    let buf = clean(raw);
    for (let i = from; i < GROUPS; i++) {
      next[i] = buf.slice(0, LEN);
      buf = buf.slice(LEN);
    }
    commit(next);
    const gap = next.findIndex((s) => s.length < LEN);
    refs.current[gap === -1 ? GROUPS - 1 : gap]?.focus();
  };

  const onType = (idx: number, raw: string) => {
    const c = clean(raw);
    if (c.length > LEN) {
      spread(c, idx);
      return;
    }
    const next = [...segs];
    next[idx] = c;
    commit(next);
    if (c.length === LEN && idx < GROUPS - 1) refs.current[idx + 1]?.focus();
  };

  const onKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && segs[idx] === "" && idx > 0) {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
    }
  };

  const pasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) spread(text, 0);
    } catch {
      void 0;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink">{t("Recovery key")}</span>
        <button
          type="button"
          onClick={pasteButton}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          <ClipboardPaste size={12} strokeWidth={2} /> {t("Paste")}
        </button>
      </div>
      <div
        className="flex items-center gap-1.5"
        onPaste={(e) => {
          e.preventDefault();
          spread(e.clipboardData.getData("text"), 0);
        }}
      >
        {segs.map((s, i) => (
          <Fragment key={i}>
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={s}
              onChange={(e) => onType(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              autoFocus={autoFocus && i === 0}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={LEN}
              aria-label={t("Recovery key block {current} of {total}", {
                current: i + 1,
                total: GROUPS,
              })}
              placeholder="•••••"
              className="h-11 w-full min-w-0 rounded-md border border-edge-soft bg-elevated/40 text-center font-mono text-[15px] uppercase tracking-[0.16em] text-ink transition-colors placeholder:text-ink-subtle/40 focus:border-edge focus:outline-none"
            />
            {i < GROUPS - 1 && (
              <span aria-hidden className="text-[13px] text-ink-subtle/60">
                -
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <span className="text-[11.5px] text-ink-subtle">
        {t("The 20-character key from when you created your account. Paste it or type each block.")}
      </span>
    </div>
  );
}
