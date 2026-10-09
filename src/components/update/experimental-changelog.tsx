import { useLayoutEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@/lib/build-info";
import { useT } from "@/lib/i18n";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { experimentalReleaseNote } from "@/lib/updater/experimental-notes";
import type { ReleaseNote } from "@/lib/updater/release-notes";
import { openUrl } from "@/lib/window";
import { RichNote } from "./rich-notes";

export function ExperimentalChangelog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const note = experimentalReleaseNote(APP_VERSION);
  if (!note) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center rounded-md border border-edge px-4 text-[13px] font-semibold text-ink hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t("View experimental changelog")}
      </button>
      {open && <NotesDialog note={note} onClose={() => setOpen(false)} />}
    </>
  );
}

function NotesDialog({ note, onClose }: { note: ReleaseNote; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const restore = captureFocusReturn();
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      restore();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-modal="true"
      data-tv-focus-scope
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (isBackKey(e.nativeEvent)) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className="m-auto w-[min(680px,calc(100vw-2rem))] max-h-[86vh] overflow-hidden rounded-md border border-edge bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex max-h-[86vh] flex-col">
        <header className="flex items-center justify-between gap-4 p-5">
          <h2 id={titleId} className="text-xl font-semibold">
            {note.title}
          </h2>
          <button
            type="button"
            data-tv-modal-close
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-elevated focus-visible:outline-2"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div
          tabIndex={0}
          className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <RichNote note={{ ...note, title: undefined }} />
        </div>
        <footer className="border-t border-edge p-5">
          <button
            type="button"
            onClick={() => void openUrl("https://harborsystem.online")}
            className="min-h-11 rounded-md px-3 text-accent hover:bg-elevated focus-visible:outline-2"
          >
            {t("Report an issue")}
          </button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
