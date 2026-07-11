import { HarborLoader } from "@/components/harbor-loader";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useEffect, useRef, useState } from "react";

import { addonKey, idOf } from "./addons-utils";
import { BrowseRow } from "./browse-row";

export function LazyCategorySection({
  eager,
  title,
  items,
  onOpen,
}: {
  eager: boolean;
  title: string;
  items: ResolvedAddon[];
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return (
    <section ref={ref} className="min-h-[140px]">
      <h3 className="mb-5 font-display text-[24px] font-medium tracking-tight text-ink">
        {title}{" "}
        <span className="ms-2 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{items.length}</span>
      </h3>
      {visible ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.slice(0, 24).map((r) => (
            <BrowseRow key={addonKey(r)} resolved={r} onOpen={() => onOpen(idOf(r))} />
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center">
          <HarborLoader size="sm" />
        </div>
      )}
    </section>
  );
}
