import { MANGA_PAGE } from "@/lib/manga/model";
import { DOM_PRELUDE } from "./prelude/dom";
import { CRYPTO_PRELUDE } from "./prelude/crypto";
import { RUNTIME_PRELUDE } from "./prelude/runtime";
import type { MangayomiSourceMeta, MangayomiSourceRecord } from "./types";

export const MANGAYOMI_PRELUDE = DOM_PRELUDE + "\n" + CRYPTO_PRELUDE + "\n" + RUNTIME_PRELUDE;

const EPILOGUE = String.raw`
;(function () {
  var __Ext = typeof DefaultExtension !== "undefined" ? DefaultExtension
    : typeof MangayomiExtension !== "undefined" ? MangayomiExtension
    : null;
  if (!__Ext) throw new Error("mangayomi source defines no DefaultExtension class");
  var __inst = new __Ext(__harborSource);
  __inst.source = __harborSource;
  if (!__inst.client) __inst.client = new Client();
  harbor.register(__hyAdapt(__inst, __harborSource));
})();
`;

function metaOf(record: MangayomiSourceRecord): MangayomiSourceMeta {
  return {
    id: record.id,
    name: record.name,
    lang: record.lang,
    baseUrl: record.baseUrl,
    apiUrl: record.apiUrl,
    iconUrl: record.iconUrl,
    version: record.version,
    isNsfw: record.isNsfw,
    pageSize: MANGA_PAGE,
  };
}

export function buildMangayomiSource(record: MangayomiSourceRecord): string {
  const meta = JSON.stringify(metaOf(record));
  return (
    MANGAYOMI_PRELUDE +
    "\nvar __harborSource = " +
    meta +
    ";\n" +
    record.source +
    "\n" +
    EPILOGUE
  );
}
