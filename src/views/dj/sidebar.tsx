import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FolderPlus, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import {
  MAX_SAMPLE_BYTES,
  readBrowser,
  readSamples,
  subscribeSamples,
  writeBrowser,
  writeSamples,
  type DeckSample,
} from "./deck-store";
import { playSample, stopSample } from "./sample-audio";
import { UpNext, Waveform } from "./sidebar-parts";
import "./sidebar.css";

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];
const GRIP = 6;
const AHEAD = 12;
const PREVIEW = 0.8;

function rowId(slot: number): string {
  return `dj-browser-row-${slot}`;
}

export function DeckBrowser({
  queue,
  queueIndex,
  gain,
}: {
  queue: MusicTrack[];
  queueIndex: number;
  gain: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pads, setPads] = useState<Record<string, DeckSample>>({});
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(-1);
  const [tooBig, setTooBig] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const grip = useRef<{ slot: number; x: number; y: number; armed: boolean } | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const level = useRef(gain);
  level.current = gain;

  useEffect(() => {
    let live = true;
    void readBrowser().then((saved) => {
      if (live && saved) setOpen(true);
    });
    void readSamples().then((saved) => {
      if (live && saved) setPads(saved);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => subscribeSamples((next) => setPads({ ...next })), []);
  useEffect(() => stopSample, []);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return SLOTS.filter((slot) => pads[slot])
      .map((slot) => ({ slot, sample: pads[slot] }))
      .filter((row) => !needle || row.sample.name.toLowerCase().includes(needle));
  }, [pads, term]);

  useEffect(() => {
    setActive((current) => (current >= rows.length ? rows.length - 1 : current));
  }, [rows.length]);

  const audition = useCallback(
    (index: number, commit: boolean) => {
      const row = rows[index];
      if (!row) return;
      void playSample(row.sample, commit ? level.current : level.current * PREVIEW).catch(() => {});
    },
    [rows],
  );

  const pick = useCallback(
    (index: number) => {
      setActive(index);
      audition(index, false);
    },
    [audition],
  );

  const store = useCallback((next: Record<string, DeckSample>) => {
    setPads(next);
    writeSamples(next);
  }, []);

  const move = useCallback(
    (from: number, to: number) => {
      const carried = pads[from];
      if (!carried || from === to) return;
      const next = { ...pads };
      const landing = next[to];
      next[to] = carried;
      if (landing) next[from] = landing;
      else delete next[from];
      store(next);
    },
    [pads, store],
  );

  const wipe = useCallback(
    (slot: number) => {
      const next = { ...pads };
      delete next[slot];
      store(next);
    },
    [pads, store],
  );

  const accept = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = { ...pads };
    let oversize = false;
    for (const file of Array.from(files)) {
      if (file.size > MAX_SAMPLE_BYTES) {
        oversize = true;
        continue;
      }
      const slot = SLOTS.find((index) => !next[index]);
      if (slot === undefined) break;
      next[slot] = { name: file.name.replace(/\.[^.]+$/, ""), blob: file.slice() };
    }
    setTooBig(oversize);
    store(next);
  };

  const aim = (x: number, y: number) => {
    const under = document.elementFromPoint(x, y);
    const node =
      under instanceof HTMLElement
        ? under.closest<HTMLElement>("[data-deck-pad],[data-deck-row]")
        : null;
    if (node === target.current) return;
    if (target.current) delete target.current.dataset.deckDrop;
    target.current = node;
    if (node) node.dataset.deckDrop = "";
  };

  const release = () => {
    const held = grip.current;
    const landing = target.current;
    grip.current = null;
    if (landing) delete landing.dataset.deckDrop;
    target.current = null;
    if (chip.current) delete chip.current.dataset.on;
    if (!held?.armed || !landing) return;
    const slot = Number(landing.dataset.deckPad ?? landing.dataset.deckRow);
    if (Number.isFinite(slot)) move(held.slot, slot);
  };

  const hold = (event: ReactPointerEvent<HTMLDivElement>, slot: number, index: number) => {
    if (event.button !== 0) return;
    list.current?.focus();
    pick(index);
    grip.current = { slot, x: event.clientX, y: event.clientY, armed: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const held = grip.current;
    if (!held) return;
    const node = chip.current;
    if (!held.armed) {
      const reach = Math.abs(event.clientX - held.x) + Math.abs(event.clientY - held.y);
      if (reach < GRIP) return;
      held.armed = true;
      if (node) {
        node.textContent = pads[held.slot]?.name ?? "";
        node.dataset.on = "";
      }
    }
    if (node) {
      node.style.transform = `translate3d(${event.clientX + 14}px, ${event.clientY - 12}px, 0)`;
    }
    aim(event.clientX, event.clientY);
  };

  const swing = (next: boolean) => {
    setOpen(next);
    writeBrowser(next);
    if (!next) stopSample();
  };

  const keys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const node = event.target as HTMLElement | null;
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      swing(false);
      tab.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (rows.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = active < 0 ? (step > 0 ? -1 : rows.length) : active;
      pick(Math.max(0, Math.min(rows.length - 1, from + step)));
      return;
    }
    if (event.key === "Enter" && node?.tagName !== "BUTTON") {
      event.preventDefault();
      audition(active, true);
    }
  };

  const ahead = useMemo(
    () => queue.slice(queueIndex + 1, queueIndex + 1 + AHEAD),
    [queue, queueIndex],
  );
  const full = SLOTS.every((slot) => pads[slot]);
  const note = tooBig ? t("dj.samples.tooBig") : full ? t("dj.browser.full") : t("dj.browser.hint");
  const here = rows[active];

  return (
    <aside className="dj-browser" data-open={open || undefined} onKeyDown={keys}>
      <div className="dj-browser-panel">
        <header className="dj-browser-top">
          <strong>{t("dj.browser.title")}</strong>
          <label className="dj-browser-find">
            <Search size={12} aria-hidden="true" />
            <input
              type="search"
              value={term}
              placeholder={t("dj.browser.search")}
              aria-label={t("dj.browser.search")}
              onChange={(event) => setTerm(event.target.value)}
            />
          </label>
        </header>

        <section className="dj-browser-part">
          <h3>{t("dj.samples.title")}</h3>
          <div
            className="dj-browser-list"
            ref={list}
            role="listbox"
            tabIndex={0}
            aria-label={t("dj.samples.title")}
            aria-activedescendant={here ? rowId(here.slot) : undefined}
          >
            {rows.length === 0 ? (
              <p className="dj-browser-blank">
                {term.trim() ? t("dj.browser.noMatch") : t("dj.browser.empty")}
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.slot}
                  id={rowId(row.slot)}
                  className="dj-browser-row"
                  role="option"
                  aria-selected={index === active}
                  data-deck-row={row.slot}
                  data-on={index === active || undefined}
                  onPointerDown={(event) => hold(event, row.slot, index)}
                  onPointerMove={drag}
                  onPointerUp={release}
                  onPointerCancel={release}
                >
                  <span className="dj-browser-pad">{row.slot + 1}</span>
                  <span className="dj-browser-body">
                    <span className="dj-browser-name">{row.sample.name}</span>
                    <Waveform sample={row.sample} />
                  </span>
                  <button
                    type="button"
                    className="dj-browser-drop"
                    aria-label={t("dj.samples.clear")}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => wipe(row.slot)}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="dj-browser-foot">
            <button
              type="button"
              className="dj-browser-add"
              disabled={full}
              onClick={() => {
                setTooBig(false);
                picker.current?.click();
              }}
            >
              <FolderPlus size={13} aria-hidden="true" />
              <span>{t("dj.browser.add")}</span>
            </button>
            <span className="dj-browser-note" data-bad={tooBig || undefined}>
              {note}
            </span>
          </div>
        </section>

        <UpNext tracks={ahead} />
      </div>

      <button
        type="button"
        className="dj-browser-tab"
        ref={tab}
        aria-expanded={open}
        aria-label={t("dj.browser.title")}
        onClick={() => swing(!open)}
      >
        {open ? (
          <PanelLeftClose size={15} aria-hidden="true" />
        ) : (
          <PanelLeftOpen size={15} aria-hidden="true" />
        )}
      </button>

      <span className="dj-browser-carry" ref={chip} aria-hidden="true" />

      <input
        ref={picker}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
    </aside>
  );
}
