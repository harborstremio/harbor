import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { browseFetcher, listBrowseCatalogs } from "@/lib/catalog-browse";
import { queryKeys } from "@/lib/query";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

function typeLabel(ty: string): string {
  return TYPE_LABELS[ty] ?? ty.charAt(0).toUpperCase() + ty.slice(1);
}

type Option = { value: string; label: string; sub?: string; logo?: string };

function OptionIcon({ logo, label }: { logo?: string; label: string }) {
  if (logo)
    return (
      <img
        src={logo}
        alt=""
        draggable={false}
        className="h-[18px] w-[18px] shrink-0 rounded-[5px] object-contain"
      />
    );
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-elevated text-[10px] font-bold text-ink-subtle ring-1 ring-edge-soft">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function PillSelect({
  label,
  value,
  valueLogo,
  hasLogos,
  options,
  onChange,
  searchable,
}: {
  label: string;
  value: string;
  valueLogo?: string;
  hasLogos?: boolean;
  options: Option[];
  onChange: (v: string) => void;
  searchable?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setQ("");
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const filtered =
    searchable && q
      ? options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      : options;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 items-center gap-2 rounded-full border ps-3 pe-3.5 text-start transition-colors ${
          open
            ? "border-edge bg-elevated"
            : "border-edge-soft bg-canvas/50 hover:border-edge hover:bg-canvas/70"
        }`}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {label}
        </span>
        {hasLogos && <OptionIcon logo={valueLogo} label={value} />}
        <span className="max-w-[180px] truncate text-[13.5px] font-medium text-ink">{value}</span>
        <ChevronDown
          size={14}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 top-[calc(100%+8px)] z-30 flex max-h-[340px] w-[300px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-edge bg-canvas shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          {searchable && options.length > 6 && (
            <div className="flex items-center gap-2 border-b border-edge-soft px-3.5 py-2.5">
              <Search size={14} className="text-ink-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Search")}
                className="h-6 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
              />
            </div>
          )}
          <div className="flex flex-col overflow-y-auto py-1.5">
            {filtered.length === 0 && (
              <span className="px-4 py-3 text-[12.5px] text-ink-subtle">{t("No matches")}</span>
            )}
            {filtered.map((o) => {
              const sel = o.label === value;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2 text-start transition-colors ${
                    sel
                      ? "bg-elevated text-ink"
                      : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                  }`}
                >
                  {hasLogos && <OptionIcon logo={o.logo} label={o.label} />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate text-[13.5px] ${sel ? "font-semibold" : ""}`}>
                      {o.label}
                    </span>
                    {o.sub && <span className="truncate text-[11px] text-ink-subtle">{o.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CatalogBrowser() {
  const t = useT();
  const { authKey } = useAuth();
  const { openGrid } = useView();
  const [type, setType] = useState("");
  const [catKey, setCatKey] = useState("");
  const [genre, setGenre] = useState<string | null>(null);

  // Shares the TanStack Query entry the catalogs prefetch already warms.
  const { data: catalogs = [] } = useQuery({
    queryKey: queryKeys.catalog.list(authKey),
    queryFn: () => listBrowseCatalogs(authKey),
    staleTime: 5 * 60_000,
  });

  const types = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of catalogs)
      if (!seen.has(c.type)) {
        seen.add(c.type);
        out.push(c.type);
      }
    return out;
  }, [catalogs]);

  useEffect(() => {
    if (!type && types.length) setType(types[0]);
  }, [types, type]);

  const ofType = useMemo(() => catalogs.filter((c) => c.type === type), [catalogs, type]);

  useEffect(() => {
    if (ofType.length && !ofType.some((c) => c.key === catKey)) {
      setCatKey(ofType[0].key);
      setGenre(null);
    }
  }, [ofType, catKey]);

  const selected = useMemo(
    () => catalogs.find((c) => c.key === catKey) ?? null,
    [catalogs, catKey],
  );

  if (catalogs.length === 0 || types.length === 0) return null;

  const browse = () => {
    if (!selected) return;
    openGrid({
      title: genre ? `${selected.name} · ${genre}` : selected.name,
      fetcher: browseFetcher(selected, genre),
    });
  };

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">
        {t("Browse your catalogs")}
      </h2>
      <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl bg-elevated/30 p-2 ring-1 ring-edge-soft/50">
        <PillSelect
          label={t("Type")}
          value={typeLabel(type)}
          options={types.map((ty) => ({ value: ty, label: typeLabel(ty) }))}
          onChange={(v) => setType(v)}
        />
        <PillSelect
          label={t("Catalog")}
          value={selected?.name ?? "—"}
          valueLogo={selected?.addonLogo}
          hasLogos
          options={ofType.map((c) => ({
            value: c.key,
            label: c.name,
            sub: c.addonName,
            logo: c.addonLogo,
          }))}
          onChange={(v) => {
            setCatKey(v);
            setGenre(null);
          }}
          searchable
        />
        {selected && selected.genres.length > 0 && (
          <PillSelect
            label={t("Genre")}
            value={genre ?? t("All genres")}
            options={[
              { value: "", label: t("All genres") },
              ...selected.genres.map((g) => ({ value: g, label: g })),
            ]}
            onChange={(v) => setGenre(v || null)}
            searchable
          />
        )}
        <button
          onClick={browse}
          className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
        >
          {t("Browse")}
        </button>
      </div>
    </div>
  );
}
