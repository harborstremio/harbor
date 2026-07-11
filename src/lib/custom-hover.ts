const KEY = "harbor.custom-hover.v1";

export type CustomHoverConfig = {
  id: string;
  name: string;
  scale: number;
  blur: number;
  dim: number;
  glow: boolean;
  overlay: "none" | "gradient" | "panel";
  showTitle: boolean;
  showMeta: boolean;
  showPlay: boolean;
  css: string;
};

export const DEFAULT_CUSTOM: Omit<CustomHoverConfig, "id" | "name"> = {
  scale: 106,
  blur: 0,
  dim: 30,
  glow: false,
  overlay: "gradient",
  showTitle: true,
  showMeta: true,
  showPlay: false,
  css: "",
};

const subs = new Set<() => void>();
let cache: CustomHoverConfig[] | null = null;
let version = 0;

export function customHoverVersion(): number {
  return version;
}

function read(): CustomHoverConfig[] {
  if (cache) return cache;
  let next: CustomHoverConfig[];
  try {
    const raw = localStorage.getItem(KEY);
    next = raw ? (JSON.parse(raw) as CustomHoverConfig[]) : [];
  } catch {
    next = [];
  }
  cache = Array.isArray(next) ? next : [];
  return cache;
}

function write(list: CustomHoverConfig[]): void {
  cache = list;
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  for (const fn of subs) fn();
}

export function listCustomHovers(): CustomHoverConfig[] {
  return read();
}

export function getCustomHover(id: string): CustomHoverConfig | null {
  return read().find((c) => c.id === id) ?? null;
}

export function upsertCustomHover(config: CustomHoverConfig): void {
  const list = read().slice();
  const idx = list.findIndex((c) => c.id === config.id);
  if (idx >= 0) list[idx] = config;
  else list.push(config);
  write(list);
}

export function deleteCustomHover(id: string): void {
  write(read().filter((c) => c.id !== id));
}

export function newCustomHoverId(name: string, count: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${slug || "style"}-${count}`;
}

export function scopeHoverCss(css: string, scopeClass: string): string {
  return css
    .split(".group:hover .harbor-custom-hover")
    .join(`.${scopeClass}`)
    .split(".group:focus-within .harbor-custom-hover")
    .join(`.${scopeClass}`)
    .split(".harbor-custom-hover")
    .join(`.${scopeClass}`);
}

export function subscribeCustomHovers(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
