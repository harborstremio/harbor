import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Plus } from "lucide-react";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { bpSourceInitials } from "./bp-live-source-button";
import { BpLiveSetup } from "./bp-live-setup";
import { bpFirstVisible } from "./bp-visible";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

const LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

type Pane = "list" | "add";

function kindLabel(kind: string | undefined, t: (k: string) => string): string {
  if (kind === "xtream") return t("Xtream");
  return "M3U";
}

export function BpLiveSources({
  sources,
  activeId,
  channelCount,
  startInAdd,
  onPick,
  onAdded,
  onClose,
}: {
  sources: IptvPlaylistSource[];
  activeId: string;
  channelCount: number;
  startInAdd?: boolean;
  onPick: (id: string) => void;
  onAdded: (id: string) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const [pane, setPane] = useState<Pane>(startInAdd ? "add" : "list");
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const activeAt = Math.max(
    0,
    sources.findIndex((s) => s.id === activeId),
  );

  useEffect(() => {
    const prev = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    return () => {
      if (prev?.isConnected) {
        setBpFocus(prev, { silent: true });
        return;
      }
      const back = document.querySelector<HTMLElement>(
        '[data-bp-restore-key="bp-live-source-trigger"]',
      );
      if (back) setBpFocus(back, { silent: true });
    };
  }, []);

  // Focus is seeded on every pane swap: list seeds its active row, add seeds
  // BpLiveSetup's Back button. Without this the ring is lost across a swap,
  // because the shell's autofocus pass only seeds on an arrow press.
  useEffect(() => {
    if (pane === "list") {
      if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
      return;
    }
    const back = bodyRef.current?.querySelector<HTMLElement>(
      '[data-bp-restore-key="bp-live-setup-back"]',
    );
    if (back) setBpFocus(back, { silent: true });
  }, [pane]);

  useEffect(
    () =>
      pushBpBack(() => {
        SFX.close();
        if (pane === "add") {
          setPane("list");
          return true;
        }
        onClose();
        return true;
      }),
    [pane, onClose],
  );

  return (
    <div
      role="dialog"
      aria-label={t("Live TV sources")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[82vh] w-[min(80vw,720px)] flex-col gap-[clamp(14px,2vh,28px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(22px,2.6vw,42px)]">
        {pane === "list" && (
          <h2 className="font-display text-[clamp(20px,2.9vh,34px)] font-semibold tracking-[-0.02em] text-ink">
            {t("Live TV sources")}
          </h2>
        )}

        <div
          ref={bodyRef}
          data-bp-scroll-y
          data-bp-center
          className="-mx-[16px] flex min-h-0 flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(10px,1.2vh,18px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pane === "list" ? (
            <>
              {sources.map((s, i) => {
                const on = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    ref={i === activeAt ? seedRef : undefined}
                    type="button"
                    data-bp-focusable
                    data-bp-tile="wide"
                    style={LIFT}
                    aria-pressed={on}
                    onClick={() => {
                      SFX.click();
                      onPick(s.id);
                      onClose();
                    }}
                    className="flex h-[clamp(64px,7vh,88px)] shrink-0 items-center gap-[clamp(12px,1.1vw,20px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(14px,1.3vw,24px)] text-start data-[bp-focus=true]:bg-[var(--bp-focus-face)]"
                  >
                    <span className="grid h-[clamp(40px,4.6vh,58px)] w-[clamp(40px,4.6vh,58px)] shrink-0 place-items-center rounded-[var(--bp-r-xs)] bg-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] text-[clamp(13px,1.7vh,20px)] font-bold text-ink">
                      {bpSourceInitials(s.name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[clamp(15px,2vh,24px)] font-semibold text-ink">
                        {s.name}
                      </span>
                      <span className="truncate text-[clamp(11.5px,1.5vh,16px)] font-medium text-ink-subtle">
                        {kindLabel(s.kind, t)}
                        {on ? ` · ${t("{n} channels", { n: channelCount.toLocaleString() })}` : ""}
                      </span>
                    </span>
                    {on && (
                      <Check
                        size={22}
                        strokeWidth={2.6}
                        className="shrink-0 text-[var(--bp-live)]"
                      />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                data-bp-focusable
                data-bp-tile="wide"
                style={LIFT}
                onClick={() => {
                  SFX.open();
                  setPane("add");
                }}
                className="mt-[clamp(4px,0.6vh,10px)] flex h-[clamp(60px,6.6vh,82px)] shrink-0 items-center gap-[clamp(12px,1.1vw,20px)] rounded-[var(--bp-r-sm)] border border-dashed border-[var(--bp-edge-2)] px-[clamp(14px,1.3vw,24px)] text-start data-[bp-focus=true]:border-transparent data-[bp-focus=true]:bg-[var(--bp-focus-face)]"
              >
                <span className="grid h-[clamp(40px,4.6vh,58px)] w-[clamp(40px,4.6vh,58px)] shrink-0 place-items-center rounded-[var(--bp-r-xs)] bg-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] text-ink">
                  <Plus size={24} strokeWidth={2.4} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[clamp(15px,2vh,24px)] font-semibold text-ink">
                    {t("Add a source")}
                  </span>
                  <span className="truncate text-[clamp(11.5px,1.5vh,16px)] font-medium text-ink-subtle">
                    {t("M3U link, Xtream login, or guide data")}
                  </span>
                </span>
              </button>
            </>
          ) : (
            <BpLiveSetup
              backLabel={t("Sources")}
              onBack={() => setPane("list")}
              onSaved={onAdded}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
