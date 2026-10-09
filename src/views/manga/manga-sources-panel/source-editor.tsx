import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  addHtmlSource,
  addMangaSource,
  removeMangaSource,
  type MangaSource,
} from "@/lib/manga/sources";
import { parseHtmlConfig, resolveFavicon } from "@/lib/manga/sources/html";
import { INPUT } from "./shared";
import { useT } from "@/lib/i18n";

export function SourceEditor({ source, onDone }: { source: MangaSource; onDone: () => void }) {
  const t = useT();
  const isHtml = source.kind === "html";
  const [name, setName] = useState(source.name);
  const [logo, setLogo] = useState(source.config?.iconUrl ?? "");
  const [config, setConfig] = useState(
    isHtml && source.config ? JSON.stringify(source.config, null, 2) : "",
  );
  const [url, setUrl] = useState(source.baseUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      if (isHtml) {
        const parsed = parseHtmlConfig(config);
        if (!parsed) {
          setError(t("That config is not valid. Check baseUrl, popularPath, list, chapters, and pages."));
          return;
        }
        if (name.trim()) parsed.name = name.trim();
        if (logo.trim()) parsed.iconUrl = logo.trim();
        else if (!parsed.iconUrl) parsed.iconUrl = await resolveFavicon(parsed.baseUrl);
        const next = addHtmlSource(parsed);
        if (!next) {
          setError(t("Could not save that source."));
          return;
        }
        if (next.id !== source.id) removeMangaSource(source.id);
      } else {
        const clean = url.trim();
        if (!clean) {
          setError(t("Enter a URL or path."));
          return;
        }
        const next = addMangaSource(name.trim(), clean, source.kind);
        if (!next) {
          setError(t("Could not save that source."));
          return;
        }
        if (next.id !== source.id) removeMangaSource(source.id);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("Source name")}
        spellCheck={false}
        className={INPUT}
      />
      {isHtml ? (
        <>
          <input
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder={t("Logo URL (optional, auto-detected if blank)")}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            className={INPUT}
          />
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            className={`${INPUT} h-56 resize-y font-mono text-[12px] leading-relaxed`}
          />
        </>
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("URL or path")}
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          className={INPUT}
        />
      )}
      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-canvas transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-70 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Check size={16} strokeWidth={2.6} />
          )}
          {saving ? t("Saving") : t("Save changes")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          <X size={16} /> {t("Cancel")}
        </button>
      </div>
    </div>
  );
}
