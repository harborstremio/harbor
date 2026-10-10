export type MangayomiIndexEntry = {
  id?: string | number;
  name: string;
  lang: string;
  langs?: string[];
  ids?: Record<string, string | number>;
  baseUrl: string;
  apiUrl?: string;
  iconUrl?: string;
  typeSource?: string;
  itemType?: number;
  isManga?: boolean;
  pkgPath?: string;
  version: string;
  sourceCodeUrl: string;
  sourceCodeLanguage: string | number;
  isNsfw?: boolean;
};

export type MangayomiSourceRecord = {
  id: string;
  name: string;
  lang: string;
  baseUrl: string;
  apiUrl: string;
  iconUrl?: string;
  version: string;
  itemType: number;
  isNsfw: boolean;
  repoUrl: string;
  sourceCodeUrl: string;
  source: string;
  hash: string;
  enabled: boolean;
  hasTags: boolean;
};

export type MangayomiSourceMeta = {
  id: string;
  name: string;
  lang: string;
  baseUrl: string;
  apiUrl: string;
  iconUrl?: string;
  version: string;
  isNsfw: boolean;
  pageSize: number;
};
