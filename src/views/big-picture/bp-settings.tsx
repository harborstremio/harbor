import { useCallback, useEffect, useRef, useState } from "react";
import { exitBigPicture } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { pushBpBack } from "./bp-back";
import { setBpFocus } from "./use-bp-focus";
import { BpConnect } from "./bp-connect";
import { BpLiveSetup } from "./bp-live-setup";
import { useBpOnboardFacts } from "./onboarding/use-bp-onboard-facts";
import {
  bpConnectedNames,
  bpSettingsCategories,
  bpSettingsControls,
  type BpCatId,
  type BpPane,
} from "./bp-settings-catalog";
import { useBpSettingsWriter } from "./bp-settings-commit";
import { BpSettingsPane } from "./bp-settings-pane";
import {
  BpActionRow,
  BpCategoryRow,
  BpMultiRow,
  BpOptionRow,
  BpPushRow,
  BpSettingsColumnBox,
} from "./bp-settings-parts";

type Pane = "root" | BpPane;

const SUB_PAGE =
  "mx-auto flex h-full w-full max-w-[min(86vw,1180px)] flex-col overflow-y-auto px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// The body stops at the hint bar rather than scrolling under it. Every row this
// page owns lives inside a box that ends above --bp-hint-h, so no focusable can
// ever be scrolled into the bar: at the 641px floor the old page laid out 733px
// of content and the last two rows were unreachable.
const PAGE =
  "flex h-full w-full gap-[clamp(16px,2vw,40px)] px-[var(--bp-gutter)] pt-[var(--bp-page-top)] pb-[var(--bp-hint-h)]";

export function BpSettings() {
  const t = useBpT();
  const facts = useBpOnboardFacts();
  const { settings, overscan, commit, auditionSound } = useBpSettingsWriter();
  const [pane, setPane] = useState<Pane>("root");
  const [depth, setDepth] = useState(1);
  const [active, setActive] = useState(0);
  const colRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(0);
  activeRef.current = active;

  const connected = bpConnectedNames(facts);
  const categories = bpSettingsCategories(settings, t, overscan, connected);
  const cat: BpCatId = categories[active]?.id ?? "picture";
  const controls = bpSettingsControls(cat, settings, t, overscan);

  useEffect(
    () =>
      pushBpBack(() => {
        if (pane !== "root") {
          setPane("root");
          return true;
        }
        if (depth === 2) {
          setDepth(1);
          return true;
        }
        return false;
      }),
    [pane, depth],
  );

  // The seed pass in use-bp-focus is disarmed by the first arrow press, so a
  // column that swaps its contents in place would leave the ring on an unmounted
  // element and the screen dead until the next press. Depth changes move it.
  useEffect(() => {
    if (pane !== "root") return;
    const col = colRef.current;
    if (!col) return;
    const el = col.querySelector<HTMLElement>(
      depth === 2
        ? "[data-bp-focusable]"
        : `[data-bp-rail-row="${activeRef.current}"] [data-bp-focusable]`,
    );
    if (el) setBpFocus(el, { silent: true });
  }, [depth, pane]);

  // Auditioning moves the live SFX theme without committing it, so walking away
  // from the sound row would otherwise leave the session playing a pack the
  // settings do not name until the next restart.
  useEffect(() => {
    if (cat !== "interface" || depth !== 2) return;
    return () => SFX.setTheme(settings.bigPictureSound);
  }, [cat, depth, settings.bigPictureSound]);

  const leave = useCallback(() => {
    SFX.close();
    exitBigPicture();
  }, []);

  if (pane !== "root") {
    return (
      // Back belongs to the pane, not to this page. Owning it here put it in a
      // different rail parent than the pane's indexed rows, so Down out of it
      // fell to spatial nav instead of stepping the rail.
      <div data-bp-scroll-y className={SUB_PAGE}>
        {pane === "connect" ? (
          <BpConnect onBack={() => setPane("root")} />
        ) : (
          <BpLiveSetup onDone={() => setPane("root")} onBack={() => setPane("root")} />
        )}
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <BpSettingsColumnBox scrollRef={colRef} scrollable={depth === 2}>
        {depth === 1
          ? categories.map((c, i) => (
              <BpCategoryRow
                key={c.id}
                index={i}
                label={c.label}
                summary={c.summary}
                active={i === active}
                autofocus={i === active}
                onFocus={() => setActive(i)}
                onPress={() => setDepth(2)}
              />
            ))
          : controls.map((control, i) => {
              const index = controls
                .slice(0, i)
                .reduce(
                  (rows, entry) =>
                    rows +
                    (entry.kind === "options" && entry.columns === 2
                      ? Math.max(1, Math.ceil(entry.options.length / 2))
                      : 1),
                  0,
                );
              if (control.kind === "options") {
                return (
                  <BpOptionRow
                    key={control.id}
                    index={index}
                    label={control.label}
                    value={control.value}
                    options={control.options}
                    letter={control.letter}
                    columns={control.columns}
                    autofocus={i === 0}
                    onPick={(v) => commit(control.id, v)}
                    onCellFocus={control.id === "sound" ? auditionSound : undefined}
                  />
                );
              }
              if (control.kind === "multi") {
                return (
                  <BpMultiRow
                    key={control.id}
                    index={index}
                    label={control.label}
                    items={control.items}
                    render={control.render}
                    autofocus={i === 0}
                    onToggle={(v) => commit(control.id, v)}
                  />
                );
              }
              if (control.kind === "push") {
                return (
                  <BpPushRow
                    key={control.id}
                    index={index}
                    label={control.label}
                    detail={
                      control.pane === "connect"
                        ? connected.length > 0
                          ? t("Connected: {list}", { list: connected.join(", ") })
                          : control.detail
                        : settings.iptvPlaylists.length > 0
                          ? t("{count} added", { count: settings.iptvPlaylists.length })
                          : control.detail
                    }
                    autofocus={i === 0}
                    onPress={() => setPane(control.pane)}
                  />
                );
              }
              return (
                <BpActionRow
                  key={control.id}
                  index={index}
                  label={control.label}
                  autofocus={i === 0}
                  onPress={leave}
                />
              );
            })}
      </BpSettingsColumnBox>

      <BpSettingsPane
        cat={cat}
        title={categories[active]?.label ?? ""}
        s={settings}
        t={t}
        overscan={overscan}
        connected={connected}
      />
    </div>
  );
}
