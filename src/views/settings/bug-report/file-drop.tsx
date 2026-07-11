import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 6;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDrop({ files, onChange }: { files: File[]; onChange: (next: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reject, setReject] = useState<string | null>(null);

  const add = (incoming: FileList | File[]) => {
    setReject(null);
    const list = Array.from(incoming);
    const next: File[] = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) {
        setReject(`Max ${MAX_FILES} files.`);
        break;
      }
      if (f.size > MAX_BYTES) {
        setReject(`${f.name} is over 100 MB.`);
        continue;
      }
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
        setReject(`${f.name} is not an image or video.`);
        continue;
      }
      next.push(f);
    }
    onChange(next);
  };

  const remove = (ix: number) => onChange(files.filter((_, i) => i !== ix));

  return (
    <div className="flex flex-col gap-2.5">
      <button
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
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragOver
            ? "border-ink bg-elevated/70 text-ink"
            : "border-edge-soft/70 bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        <ImagePlus size={22} strokeWidth={1.7} />
        <span className="text-[13.5px] font-medium">Drop screenshots or screen recordings, or click to browse</span>
        <span className="text-[11.5px] text-ink-subtle">
          PNG, JPG, WebP, GIF, MP4, WebM, MOV. Up to {MAX_FILES} files, 100 MB each.
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
      {reject && <p className="text-[11.5px] text-danger">{reject}</p>}
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="group relative overflow-hidden rounded-xl border border-edge-soft bg-canvas/50"
            >
              <FilePreview file={f} />
              <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-ink-muted">
                <span className="truncate" title={f.name}>
                  {f.name}
                </span>
                <span className="ms-auto shrink-0 text-ink-subtle">{fmtBytes(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-canvas/85 text-ink-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
              >
                <X size={13} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilePreview({ file }: { file: File }) {
  const url = URL.createObjectURL(file);
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
  return <img src={url} alt="" className="aspect-video w-full bg-canvas object-cover" draggable={false} />;
}
