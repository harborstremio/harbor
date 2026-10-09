import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { CriticismEpisode } from "@/lib/providers/podcast-criticism";
import { CriticismPanel } from "./criticism-panel";

export function CriticismRow({
  title,
  episodes,
}: {
  title: string;
  episodes: CriticismEpisode[];
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const lead = episodes[0];
  if (!lead) return null;

  return (
    <>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <button
          ref={ref}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md text-start text-ink underline-offset-4 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-subtle"
        >
          {lead.show}
        </button>
        <span className="flex items-center">
          <span className="me-1.5 text-ink-subtle">·</span>
          <span className="text-ink-muted">{t("{n} min", { n: lead.minutes })}</span>
        </span>
      </span>
      <CriticismPanel
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        episodes={episodes}
      />
    </>
  );
}
