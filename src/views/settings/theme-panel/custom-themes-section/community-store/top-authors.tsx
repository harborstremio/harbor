import { ArrowDownToLine } from "lucide-react";
import { useT } from "@/lib/i18n";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { requestOpenProfile } from "@/lib/social/open-profile";
import type { AuthorStat } from "./use-store-themes";
import { fmtCount } from "./format";

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TopAuthors({
  authors,
  onSelect,
}: {
  authors: AuthorStat[];
  onSelect: (author: string) => void;
}) {
  const t = useT();
  const top = authors.slice(0, 8);
  if (top.length < 3) return null;
  return (
    <section className="flex flex-col gap-5 ps-[9px]">
      <div className="flex flex-col">
        <h3 className="text-[17px] font-medium tracking-tight text-ink">{t("Top authors")}</h3>
        <p className="text-[12.5px] text-ink-subtle">
          {t("The most-downloaded creators in the community.")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {top.map((a, i) => {
          const hue = hueOf(a.author);
          const h = a.handle;
          const card = (
            <button
              type="button"
              onClick={() => onSelect(a.author)}
              className="group flex w-full items-center gap-3 rounded-md bg-surface p-3 text-start outline-none ring-1 ring-edge-soft transition-[transform,box-shadow] duration-200 hover:harbor-float hover:ring-edge focus-visible:ring-2 focus-visible:ring-accent active:translate-y-0 motion-reduce:transform-none"
            >
              <span className="w-4 shrink-0 text-center text-[13.5px] font-bold tabular-nums text-ink-subtle">
                {i + 1}
              </span>
              {a.avatar ? (
                <img
                  src={a.avatar}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                />
              ) : (
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13.5px] font-bold text-white ring-1 ring-white/15"
                  style={{ background: `oklch(0.58 0.15 ${hue})` }}
                >
                  {initials(a.author)}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  {h ? (
                    <span
                      role="link"
                      tabIndex={0}
                      title={t("Open @{handle} profile", { handle: h })}
                      onClick={(e) => {
                        e.stopPropagation();
                        requestOpenProfile(h);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          requestOpenProfile(h);
                        }
                      }}
                      className="truncate cursor-pointer text-[13.5px] font-semibold text-ink underline-offset-2 outline-none hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline"
                    >
                      {a.author === "Anonymous" ? t("Anonymous") : a.author}
                    </span>
                  ) : (
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {a.author === "Anonymous" ? t("Anonymous") : a.author}
                    </span>
                  )}
                  {h && (
                    <span className="shrink-0 truncate font-display text-[11.5px] text-ink-subtle">
                      @{h}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
                  <span>
                    {a.count} {a.count === 1 ? t("theme") : t("themes")}
                  </span>
                  <span className="text-ink-subtle/50">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <ArrowDownToLine size={10.5} strokeWidth={2.2} />
                    {fmtCount(a.downloads)}
                  </span>
                </span>
              </span>
            </button>
          );
          return h ? (
            <UserHoverCard key={a.author} handle={h}>
              {card}
            </UserHoverCard>
          ) : (
            <span key={a.author} className="contents">
              {card}
            </span>
          );
        })}
      </div>
    </section>
  );
}
