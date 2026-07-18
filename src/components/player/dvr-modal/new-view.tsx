import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EpgProgram } from "@/lib/iptv/types";
import {
  buildChoices,
  prettifyError,
  suggestFilename,
  type DurationChoice,
  type DurationKind,
} from "./utils";
import { Footer, Section } from "./shared";
import { useT } from "@/lib/i18n";

const LAST_DIR_KEY = "harbor.dvr.lastDir";

function readLastDir(): string {
  try {
    return localStorage.getItem(LAST_DIR_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastDir(d: string): void {
  try {
    if (d) localStorage.setItem(LAST_DIR_KEY, d);
  } catch {}
}

export function NewRecordingView({
  url,
  channelName,
  currentProgram,
  nextProgram,
  onStart,
  getDefaultDir,
}: {
  url: string;
  channelName: string;
  currentProgram: EpgProgram | null;
  nextProgram: EpgProgram | null;
  onStart: (args: {
    url: string;
    outputDir: string;
    filename: string;
    durationSec: number;
    channelName: string;
    programTitle: string | null;
  }) => Promise<void>;
  getDefaultDir: () => Promise<string>;
}) {
  const t = useT();
  const choices = useMemo(
    () => buildChoices(currentProgram, nextProgram, t),
    [currentProgram, nextProgram, t],
  );
  const defaultKind = choices.find((c) => c.kind !== "custom")?.kind ?? "custom";
  const [selectedKind, setSelectedKind] = useState<DurationKind>(defaultKind);
  const [customMinutes, setCustomMinutes] = useState(60);
  const [dir, setDir] = useState<string>(() => readLastDir());
  const [filename, setFilename] = useState(() => suggestFilename(channelName, currentProgram));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dir) return;
    let cancelled = false;
    getDefaultDir()
      .then((d) => {
        if (!cancelled && d) setDir(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getDefaultDir, dir]);

  const chosen = choices.find((c) => c.kind === selectedKind) ?? choices[choices.length - 1];
  const durationSec = selectedKind === "custom" ? customMinutes * 60 : chosen.durationSec;
  const canStart = !!dir && durationSec >= 60 && !busy;

  const handleBrowse = async () => {
    const picked = await openDialog({ directory: true, multiple: false, defaultPath: dir });
    if (typeof picked === "string" && picked) {
      setDir(picked);
      writeLastDir(picked);
    }
  };

  const handleStart = async () => {
    setBusy(true);
    setError(null);
    try {
      writeLastDir(dir);
      await onStart({
        url,
        outputDir: dir,
        filename: filename.trim() || suggestFilename(channelName, currentProgram),
        durationSec,
        channelName,
        programTitle: chosen.programTitle,
      });
    } catch (e) {
      setError(prettifyError(String(e), t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <Section icon={<Tv size={14} strokeWidth={2.1} />} label={t("What to record")}>
          <div className="flex flex-col gap-2">
            {choices.map((c) => (
              <ChoiceRow
                key={c.kind}
                choice={c}
                selected={selectedKind === c.kind}
                onSelect={() => setSelectedKind(c.kind)}
                renderTrailing={
                  c.kind === "custom" ? (
                    <CustomMinutes
                      value={customMinutes}
                      onChange={setCustomMinutes}
                      active={selectedKind === "custom"}
                    />
                  ) : null
                }
              />
            ))}
          </div>
        </Section>

        <Section icon={<FolderOpen size={14} strokeWidth={2.1} />} label={t("Save to")}>
          <div className="flex items-center gap-2">
            <div className="flex h-10 flex-1 items-center truncate rounded-lg border border-edge-soft bg-canvas/60 px-3 text-[13px] text-ink-muted">
              {dir || t("Choose a folder...")}
            </div>
            <button
              onClick={handleBrowse}
              className="flex h-10 items-center rounded-lg bg-raised px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-raised/70"
            >
              {t("Browse")}
            </button>
          </div>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={t("Filename")}
            className="h-10 rounded-lg border border-edge-soft bg-canvas/60 px-3 text-[13px] text-ink outline-none transition-colors focus:border-edge"
          />
        </Section>
      </div>
      <Footer>
        <div className="flex min-w-0 flex-1 flex-col text-[12px]">
          {error ? (
            <span className="truncate text-amber-300" title={error}>
              {error}
            </span>
          ) : (
            <span className="text-ink-subtle">{t("Saved as .ts (works in mpv, VLC, ffmpeg)")}</span>
          )}
        </div>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-danger px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="h-2 w-2 rounded-full bg-white" />
          {t("Start recording")}
        </button>
      </Footer>
    </>
  );
}

function ChoiceRow({
  choice,
  selected,
  onSelect,
  renderTrailing,
}: {
  choice: DurationChoice;
  selected: boolean;
  onSelect: () => void;
  renderTrailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors ${
        selected ? "border-ink bg-canvas/70" : "border-edge-soft bg-canvas/40 hover:bg-canvas/60"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-ink" : "border-edge"
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-semibold text-ink">{choice.label}</span>
        <span className="truncate text-[12px] text-ink-muted">{choice.caption}</span>
      </div>
      {renderTrailing}
    </button>
  );
}

function CustomMinutes({
  value,
  onChange,
  active,
}: {
  value: number;
  onChange: (v: number) => void;
  active: boolean;
}) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-2 transition-opacity ${active ? "opacity-100" : "opacity-55"}`}
    >
      <input
        type="number"
        min={5}
        max={720}
        step={5}
        value={value}
        onChange={(e) => onChange(Math.max(5, Math.min(720, Number(e.target.value) || 5)))}
        onClick={(e) => e.stopPropagation()}
        className="h-8 w-16 rounded-md border border-edge-soft bg-canvas px-2 text-end text-[13px] font-mono tabular-nums text-ink outline-none focus:border-edge"
      />
      <span className="text-[12px] text-ink-muted">{t("min")}</span>
    </div>
  );
}
