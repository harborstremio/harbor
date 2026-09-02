import { ChevronDown, Plus, X } from "lucide-react";
import { KawaiiBunny } from "./kawaii-bunny";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { EditorView } from "./editor-view";
import { PasswordPrompt } from "./password-prompt";
import { ProfileTile } from "./profile-tile";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ProfilePickerModal() {
  const { profiles, pickerOpen, pickerView, setPickerView, selectProfile, closePicker } = useProfiles();
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [cameFromList, setCameFromList] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!pickerOpen) {
      setSelectingId(null);
      setExiting(false);
      setCameFromList(false);
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    }
  }, [pickerOpen]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 24);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [pickerView.kind, pickerOpen]);

  if (!pickerOpen) return null;

  const goList = () => setPickerView({ kind: "list" });
  const finishEditor = () => (cameFromList ? goList() : closePicker());
  const showClose = pickerView.kind === "create" || pickerView.kind === "edit";

  const handleSelect = (id: string) => {
    const target = profiles.find((p) => p.id === id);
    if (target?.passwordHash) {
      setPickerView({ kind: "unlock", profileId: id });
      return;
    }
    if (prefersReducedMotion()) {
      selectProfile(id);
      return;
    }
    setSelectingId(id);
    timers.current.push(window.setTimeout(() => setExiting(true), 340));
    timers.current.push(window.setTimeout(() => selectProfile(id), 680));
  };

  return createPortal(
    <div
      data-tauri-drag-region
      className={`fixed inset-0 z-[180] flex items-center justify-center bg-black/85 backdrop-blur-2xl transition-opacity duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        exiting ? "opacity-0" : "animate-in fade-in duration-500"
      }`}
    >
      <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-[860px] flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
        <KawaiiBunny />
        {showClose && (
          <button
            type="button"
            onClick={closePicker}
            aria-label={t("common.close")}
            className="absolute end-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/70 text-ink-muted ring-1 ring-edge-soft backdrop-blur transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overscroll-contain px-10 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pickerView.kind === "list" && (
            <ListView
              selectingId={selectingId}
              onCreate={() => {
                setCameFromList(true);
                setPickerView({ kind: "create" });
              }}
              onEdit={(id) => {
                setCameFromList(true);
                setPickerView({ kind: "edit", profileId: id });
              }}
              onSelect={handleSelect}
            />
          )}
          {pickerView.kind === "create" && (
            <EditorView mode={{ kind: "create" }} onCancel={finishEditor} onDone={finishEditor} />
          )}
          {pickerView.kind === "edit" && (() => {
            const target = profiles.find((p) => p.id === pickerView.profileId);
            if (!target) {
              return <NotFoundFallback onBack={finishEditor} />;
            }
            return <EditorView mode={{ kind: "edit", profile: target }} onCancel={finishEditor} onDone={finishEditor} />;
          })()}
          {pickerView.kind === "unlock" && (() => {
            const target = profiles.find((p) => p.id === pickerView.profileId);
            if (!target || !target.passwordHash) {
              return <NotFoundFallback onBack={goList} />;
            }
            return (
              <PasswordPrompt
                profile={target}
                onSuccess={() => selectProfile(target.id, { unlocked: true })}
                onCancel={goList}
              />
            );
          })()}
        </div>
        {moreBelow && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
            <button
              type="button"
              onClick={() =>
                scrollRef.current?.scrollBy({ top: scrollRef.current.clientHeight * 0.8, behavior: "smooth" })
              }
              aria-label={t("Scroll down")}
              className="absolute bottom-3 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 animate-bounce items-center justify-center rounded-full bg-canvas/80 text-ink-muted ring-1 ring-edge-soft backdrop-blur transition-colors hover:text-ink"
            >
              <ChevronDown size={16} strokeWidth={2.4} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ListView({
  selectingId,
  onCreate,
  onEdit,
  onSelect,
}: {
  selectingId: string | null;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { profiles, activeProfile } = useProfiles();
  const t = useT();
  const isPrimary = !!activeProfile?.isPrimary;
  const selecting = selectingId != null;
  return (
    <div className="flex flex-col items-center gap-10">
      <div
        className={`flex flex-col items-center gap-2.5 transition-all duration-[360ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          selecting
            ? "-translate-y-1 opacity-0"
            : "animate-in fade-in slide-in-from-bottom-2 duration-500"
        }`}
      >
        <h1 className="font-display text-[40px] font-medium tracking-tight text-ink">
          {t("Who's watching?")}
        </h1>
        <p className="text-[14px] text-ink-muted">{t("Pick a profile to continue.")}</p>
      </div>
      <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-8">
        {profiles.map((p, i) => {
          const canEditThis = isPrimary || p.id === activeProfile?.id;
          const chosen = selectingId === p.id;
          const dimmed = selecting && !chosen;
          return (
            <div
              key={p.id}
              className={`transition-all duration-[440ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                chosen
                  ? "z-10 scale-[1.14]"
                  : dimmed
                    ? "scale-90 opacity-0 blur-[2px]"
                    : "animate-in fade-in slide-in-from-bottom-1 duration-500"
              }`}
              style={
                selecting
                  ? undefined
                  : { animationDelay: `${140 + Math.min(i, 8) * 55}ms`, animationFillMode: "both" }
              }
            >
              <ProfileTile
                profile={p}
                onSelect={() => onSelect(p.id)}
                onEdit={canEditThis ? () => onEdit(p.id) : undefined}
              />
            </div>
          );
        })}
        {isPrimary && (
          <div
            className={`transition-all duration-[360ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              selecting
                ? "scale-90 opacity-0"
                : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500"
            }`}
            style={
              selecting
                ? undefined
                : { animationDelay: `${140 + Math.min(profiles.length, 8) * 55}ms`, animationFillMode: "both" }
            }
          >
            <AddProfileButton onClick={onCreate} />
          </div>
        )}
      </div>
    </div>
  );
}

function AddProfileButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 outline-none"
      aria-label={t("Add profile")}
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-edge text-ink-subtle transition-all duration-200 group-hover:scale-[1.04] group-hover:border-ink group-hover:text-ink">
        <Plus size={28} strokeWidth={2.2} />
      </span>
      <span className="text-[14px] font-medium text-ink-muted transition-colors group-hover:text-ink">
        {t("Add profile")}
      </span>
    </button>
  );
}

function NotFoundFallback({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[14px] text-ink-muted">{t("Profile not found.")}</p>
      <button
        type="button"
        onClick={onBack}
        className="h-10 rounded-xl bg-ink px-5 text-[13px] font-semibold text-canvas"
      >
        {t("common.back")}
      </button>
    </div>
  );
}
