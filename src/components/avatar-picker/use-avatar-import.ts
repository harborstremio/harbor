import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { appendToAvatarPack, UPLOADS_ID } from "@/lib/avatars/packs";
import {
  buildGroups,
  entriesFromFileList,
  isNativePick,
  pickFolderNative,
  pickImagesNative,
  setSlug,
  type ImportEntry,
} from "./avatar-import";
import {
  AvatarPackError,
  pickPackNative,
  readPackFromFile,
  resolvePackGroups,
} from "./avatar-pack-file";
import type { ImportGroup } from "./avatar-import";
import { useT } from "@/lib/i18n";

export function useAvatarImport(section: string) {
  const t = useT();
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [uploadsBadge, setUploadsBadge] = useState(0);
  const [packError, setPackError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const packRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number>(0);

  useEffect(() => {
    if (section === UPLOADS_ID) setUploadsBadge(0);
  }, [section]);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const commitGroups = async (groups: ImportGroup[]) => {
    const touched: string[] = [];
    let uploaded = 0;
    for (const g of groups) {
      const id = g.set ? `set_${setSlug(g.set)}` : UPLOADS_ID;
      const n = await appendToAvatarPack(id, g.set ?? t("Uploads"), g.items);
      if (n) touched.push(id);
      if (!g.set) uploaded += n;
    }
    if (uploaded && section !== UPLOADS_ID) setUploadsBadge((b) => b + uploaded);
    if (touched.length) {
      setFlashIds(touched);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashIds([]), 1400);
    }
  };

  const runPackImport = async (source: { pack: Parameters<typeof resolvePackGroups>[0]; baseDir: string } | null) => {
    if (!source) return;
    setPackError(null);
    setImporting({ done: 0, total: 0 });
    try {
      const { groups, skipped } = await resolvePackGroups(source.pack, source.baseDir, (done, total) =>
        setImporting({ done, total }),
      );
      setImporting(null);
      if (!groups.length) {
        setPackError(t("None of the images in that pack could be loaded."));
        return;
      }
      await commitGroups(groups);
      if (skipped > 0) setPackError(t("{n} images in that pack could not be loaded.", { n: skipped }));
    } catch (err) {
      setImporting(null);
      setPackError(err instanceof AvatarPackError ? err.message : t("That pack could not be imported."));
    }
  };

  const importPack = async () => {
    setPackError(null);
    if (isNativePick()) {
      try {
        await runPackImport(await pickPackNative());
      } catch (err) {
        setPackError(err instanceof AvatarPackError ? err.message : t("That pack could not be imported."));
      }
    } else packRef.current?.click();
  };

  const onPackInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPackError(null);
    try {
      await runPackImport(await readPackFromFile(file));
    } catch (err) {
      setPackError(err instanceof AvatarPackError ? err.message : t("That pack could not be imported."));
    }
  };

  const runImport = async (entries: ImportEntry[]) => {
    if (!entries.length) return;
    setImporting({ done: 0, total: entries.length });
    const groups = await buildGroups(entries, (done, total) => setImporting({ done, total }));
    setImporting(null);
    await commitGroups(groups);
  };

  const importImages = async () => {
    if (isNativePick()) await runImport(await pickImagesNative());
    else fileRef.current?.click();
  };
  const importFolder = async () => {
    if (isNativePick()) await runImport(await pickFolderNative());
    else folderRef.current?.click();
  };
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (files?.length) void runImport(entriesFromFileList(files));
  };

  return {
    importing,
    flashIds,
    uploadsBadge,
    fileRef,
    folderRef,
    packRef,
    packError,
    clearPackError: () => setPackError(null),
    importImages,
    importFolder,
    importPack,
    onInputChange,
    onPackInputChange,
    runImport,
  };
}
