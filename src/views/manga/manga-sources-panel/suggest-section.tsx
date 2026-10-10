import { ChevronDown, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { suggestSource } from "@/lib/manga/community";
import { CARD, INPUT, PRIMARY_BTN } from "./shared";
import { useT } from "@/lib/i18n";

function fileToIcon(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function SuggestSuccess({ onAgain }: { onAgain: () => void }) {
  const t = useT();
  return (
    <div className="harbor-rise flex flex-col items-center gap-4 py-8 text-center">
      <span
        className="grid h-16 w-16 place-items-center rounded-full bg-accent/15"
        style={{ animation: "harbor-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
      >
        <svg viewBox="0 0 24 24" className="h-9 w-9">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-accent/40"
            style={{ strokeDasharray: 64, strokeDashoffset: 64, animation: "harbor-check-ring 0.5s ease-out forwards" }}
          />
          <path
            d="M7 12.5l3.2 3.2L17 8.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            style={{ strokeDasharray: 22, strokeDashoffset: 22, animation: "harbor-check-draw 0.4s 0.32s ease-out forwards" }}
          />
        </svg>
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[17px] font-semibold text-ink">{t("Suggestion sent")}</p>
        <p className="mx-auto max-w-[19rem] text-[14px] leading-snug text-ink-muted">
          {t("We review every source. Yours will be reviewed and approved shortly if it checks out.")}
        </p>
      </div>
      <button
        type="button"
        onClick={onAgain}
        className="text-[14px] font-semibold text-accent transition-colors hover:text-ink"
      >
        {t("Suggest another")}
      </button>
    </div>
  );
}

export function SuggestSection() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        setIcon(await fileToIcon(f));
      } catch {
        /* ignore bad image */
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!name.trim() || !/^https?:\/\/.+/i.test(url.trim())) {
      setState("error");
      return;
    }
    setState("sending");
    const ok = await suggestSource({ name: name.trim(), url: url.trim(), icon: icon ?? undefined });
    if (ok) {
      setName("");
      setUrl("");
      setIcon(null);
      setState("done");
    } else {
      setState("error");
    }
  };

  return (
    <div className={`overflow-hidden ${CARD}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-start transition-colors hover:bg-raised/40 active:scale-[0.99]"
      >
        <span className="text-[16px] font-semibold text-ink">{t("Suggest a source")}</span>
        <ChevronDown size={19} className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-edge-soft p-5">
          {state === "done" ? (
            <SuggestSuccess onAgain={() => setState("idle")} />
          ) : (
            <div className="harbor-rise flex flex-col gap-3">
              <p className="text-[13.5px] leading-relaxed text-ink-muted">
                {t("Know a good one? Add a name, its API or site URL, and an icon if you have one. We review every suggestion before it goes live.")}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group/icon relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-edge bg-canvas transition-colors hover:border-ink"
                  aria-label={t("Add source icon")}
                >
                  {icon ? (
                    <img src={icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus size={19} className="text-ink-subtle" />
                  )}
                  {icon && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIcon(null);
                      }}
                      className="absolute inset-0 hidden place-items-center bg-black/55 group-hover/icon:grid"
                    >
                      <X size={16} className="text-white" />
                    </span>
                  )}
                </button>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Source name")}
                  className={`${INPUT} min-w-0 flex-1`}
                />
              </div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("https:// API or site URL")}
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                className={INPUT}
              />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
              {state === "error" && (
                <p className="text-[13px] font-medium text-danger">{t("Enter a name and a valid https:// URL.")}</p>
              )}
              <button type="button" onClick={submit} disabled={state === "sending"} className={PRIMARY_BTN}>
                {state === "sending" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                {state === "sending" ? t("Sending...") : t("Send suggestion")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
