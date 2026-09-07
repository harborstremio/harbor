import { AlertTriangle, FileText, ImagePlus, X } from "../icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,text/plain,.txt,.log";
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 6;

function isLog(file: File) {
  return /\.(txt|log)$/i.test(file.name) && (!file.type || file.type === "text/plain" || file.type === "application/octet-stream");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDrop({ files, onChange }: { files: File[]; onChange: (next: File[]) => void }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const back = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reject, setReject] = useState<string | null>(null);

  useLayoutEffect(() => {
    const at = back.current;
    if (at === null) return;
    back.current = null;
    const target = files.length
      ? tileRefs.current[Math.min(at, files.length - 1)]
      : dropRef.current;
    if (target) tvFocus(target);
  }, [files]);

  const add = (incoming: FileList | File[]) => {
    setReject(null);
    const list = Array.from(incoming);
    const next: File[] = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) {
        setReject(t("Max {count} files.", { count: MAX_FILES }));
        break;
      }
      if (f.size > MAX_BYTES) {
        setReject(t("{name} is over 100 MB.", { name: f.name }));
        continue;
      }
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/") && !isLog(f)) {
        setReject(t("{name} is not an image, video, or text log.", { name: f.name }));
        continue;
      }
      next.push(f);
    }
    onChange(next);
  };

  const remove = (ix: number) => {
    const el = document.activeElement;
    back.current = el instanceof HTMLElement && navOwnsFocus(el) ? ix : null;
    onChange(files.filter((_, i) => i !== ix));
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        ref={dropRef}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) add(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-[10px] border px-6 py-9 text-center transition-colors ${
          dragOver
            ? "border-edge bg-raised text-ink"
            : "border-edge-soft bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        <ImagePlus size={24} strokeWidth={1.7} />
        <span className="max-w-[66ch] text-[16.5px] font-medium leading-[24px]">
          {t("Drop attachments here, or click to browse")}
        </span>
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {t("Images, videos, TXT or LOG files. Up to {count} files, 100 MB each.", {
            count: MAX_FILES,
          })}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = "";
        }}
      />
      {reject && (
        <p role="alert" className="flex max-w-[66ch] items-start gap-2 text-[15.5px] leading-[22px] text-danger">
          <AlertTriangle size={17} strokeWidth={2.2} className="mt-[3px] shrink-0" />
          {reject}
        </p>
      )}
      {files.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="relative flex flex-col overflow-hidden rounded-[10px] border border-edge-soft bg-elevated"
            >
              <FilePreview file={f} />
              <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                <span className="break-words text-[15.5px] leading-[22px] text-ink">{f.name}</span>
                <span className="text-[15.5px] leading-[22px] tabular-nums text-ink-subtle">
                  {fmtBytes(f.size)}
                </span>
              </div>
              <button
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                type="button"
                onClick={() => remove(i)}
                aria-label={t("Remove {name}", { name: f.name })}
                className="absolute end-1 top-1 grid h-11 w-11 place-items-center rounded-[10px] bg-canvas text-ink-muted transition-colors hover:text-ink"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (isLog(file)) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (isLog(file)) {
    return <div className="grid aspect-video w-full place-items-center bg-canvas text-ink-muted"><FileText size={32} /></div>;
  }
  if (!url) return <div className="aspect-video w-full bg-canvas" />;
  if (file.type.startsWith("video/")) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="aspect-video w-full bg-canvas object-cover"
        onLoadedMetadata={(e) => {
          (e.currentTarget as HTMLVideoElement).currentTime = 0.1;
        }}
      />
    );
  }
  return (
    <img src={url} alt="" className="aspect-video w-full bg-canvas object-cover" draggable={false} />
  );
}
