export type CatalogSource = {
  addonId: string;
  type: string;
  catalogId: string;
};

export type NativeSource = {
  title: string;
  sortBy?: string;
  filters?: Record<string, any>;
  provider: string;
  mediaType: string;
  tmdbSourceType?: string;
  tmdbId?: string | number | null;
  traktListId?: string | number | null;
};

export type SourceFolder = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  focusGifUrl: string | null;
  coverEmoji?: string | null;
  tileShape: "LANDSCAPE" | "POSTER";
  hideTitle?: boolean;
  catalogSources?: CatalogSource[];
  sources?: NativeSource[];
  _coverMode?: "image" | "emoji" | string;
};

export type SourceRow = {
  id: string;
  title: string;
  backdropImageUrl?: string | null;
  pinToTop?: boolean;
  focusGlowEnabled?: boolean;
  viewMode?: string;
  showAllTab?: boolean;
  folders: SourceFolder[];
};

export function isValidSourceRow(data: any): data is SourceRow {
  if (!data || typeof data !== "object") return false;
  if (typeof data.id !== "string" || typeof data.title !== "string") return false;
  if (!Array.isArray(data.folders) || data.folders.length === 0) return false;

  for (const folder of data.folders) {
    if (!folder || typeof folder !== "object") return false;
    if (typeof folder.id !== "string" || typeof folder.title !== "string") return false;
    if (folder.tileShape !== "LANDSCAPE" && folder.tileShape !== "POSTER") return false;

    const hasCatalogSources =
      Array.isArray(folder.catalogSources) && folder.catalogSources.length > 0;
    const hasNativeSources = Array.isArray(folder.sources) && folder.sources.length > 0;

    if (!hasCatalogSources && !hasNativeSources) return false;

    if (hasCatalogSources) {
      for (const source of folder.catalogSources!) {
        if (!source || typeof source !== "object") return false;
        if (
          typeof source.addonId !== "string" ||
          typeof source.type !== "string" ||
          typeof source.catalogId !== "string"
        ) {
          return false;
        }
      }
    }

    if (hasNativeSources) {
      for (const source of folder.sources!) {
        if (!source || typeof source !== "object") return false;
        if (typeof source.provider !== "string" || typeof source.mediaType !== "string") {
          return false;
        }
      }
    }
  }

  return true;
}

export function parseSourceRows(jsonString: string): SourceRow[] {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return data.filter(isValidSourceRow);
    } else if (isValidSourceRow(data)) {
      return [data];
    }
    return [];
  } catch {
    return [];
  }
}
