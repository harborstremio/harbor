import { useEffect, useState, type ReactNode } from "react";

export type ReaderSettingsCategory<T extends string> = {
  id: T;
  label: string;
  icon: string;
};

export function ReaderSettingsFrame<T extends string>({
  categories,
  category,
  onCategory,
  onClose,
  direction,
  children,
}: {
  categories: ReaderSettingsCategory<T>[];
  category: T;
  onCategory: (category: T) => void;
  onClose: () => void;
  direction?: "ltr" | "rtl";
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, 180);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosing(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visible = shown && !closing;
  return (
    <>
      <div
        aria-hidden
        onClick={() => setClosing(true)}
        className={`fixed inset-0 z-[87] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[88] flex flex-col items-center px-4">
        <div
          dir={direction}
          style={{ transformOrigin: "bottom center" }}
          className={`pointer-events-auto w-fit max-w-full overflow-hidden rounded-3xl border border-edge-soft bg-raised/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-200 ease-out ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.96] opacity-0"}`}
        >
          <div className="border-b border-edge-soft/70 px-6 py-4">
            <div key={category} className="reader-tab-in">
              {children}
            </div>
          </div>
          <div className="flex items-stretch gap-1 px-3 py-2.5">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onCategory(item.id)}
                onMouseDown={(event) => event.preventDefault()}
                aria-pressed={category === item.id}
                className={`flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition duration-150 active:scale-[0.94] ${category === item.id ? "bg-accent/15" : "hover:bg-elevated/70"}`}
              >
                <img
                  src={`/reader-icons/${item.icon}.png`}
                  alt=""
                  className={`h-[26px] w-[26px] object-contain transition ${category === item.id ? "opacity-100" : "opacity-65"}`}
                />
                <span
                  className={`text-[10.5px] font-medium ${category === item.id ? "text-accent" : "text-ink-muted"}`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
