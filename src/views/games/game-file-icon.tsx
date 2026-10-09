/** Original file marks; extensions identify the format, not whether Harbor can install it. */
export function gameFileFormat(filename: string): { kind: "archive" | "disc" | "installer" | "rom" | "file"; label: string } {
  const name = filename.trim().toLowerCase();
  const packed = /\.(zip|7z|rar)(?:\.\d{3})?$/.exec(name);
  if (packed) return { kind: "archive", label: packed[1].toUpperCase() };
  const tar = /\.(tar(?:\.(?:gz|bz2|xz|zst))?|tgz|tbz2|txz|gz|bz2|xz|zst|cab)$/.exec(name);
  if (tar) return { kind: "archive", label: tar[1].startsWith("tar.") ? "TAR" : tar[1].toUpperCase() };
  if (/\.(?:r\d{2}|z\d{2}|\d{3})$/.test(name)) return { kind: "archive", label: "PART" };
  const ext = /\.([a-z0-9]{1,12})$/.exec(name)?.[1] ?? "";
  if (["iso", "cue", "chd", "cso", "img", "mdf", "nrg"].includes(ext)) return { kind: "disc", label: ext.toUpperCase() };
  if (["exe", "msi", "msix", "dmg", "pkg", "deb", "rpm", "apk", "appimage", "sh", "run"].includes(ext)) return { kind: "installer", label: ext === "appimage" ? "APP" : ext.toUpperCase() };
  if (["gba", "gbc", "gb", "nds", "3ds", "cia", "nes", "sfc", "smc", "n64", "z64", "v64", "xci", "nsp"].includes(ext)) return { kind: "rom", label: ext.toUpperCase() };
  return { kind: "file", label: ext.length <= 4 ? ext.toUpperCase() : "" };
}

export function GameFileIcon({ name }: { name: string }) {
  const { kind, label } = gameFileFormat(name);
  return <svg className="games-file-mark" data-file-kind={kind} data-file-format={label} viewBox="0 0 36 44" width={32} height={40} fill="none" aria-hidden="true" focusable="false">
    <path d="M7 2.5h15l8 8V38a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5.5a3 3 0 0 1 3-3Z" fill="currentColor" opacity=".07"/>
    <path d="M21.5 2.5H7a3 3 0 0 0-3 3V38a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3V11L21.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M21.5 3v7a1 1 0 0 0 1 1h7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    {kind === "archive" ? <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 5h3m-6 3h3m0 3h3m-6 3h3m0 3h3"/><rect x="12" y="20" width="5" height="6" rx="1.5"/></g>
      : kind === "disc" ? <g stroke="currentColor" strokeWidth="1.4"><circle cx="17" cy="21" r="7"/><circle cx="17" cy="21" r="2"/><path d="m12 16 2 2m6 6 2 2"/></g>
      : kind === "installer" ? <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="15" width="16" height="12" rx="2"/><path d="m12 19 3 2-3 2m6 0h4"/></g>
      : kind === "rom" ? <g stroke="currentColor" strokeWidth="1.5"><path d="M10 17h14v11H10zM13 17v-3h8v3m-8 7v4m4-4v4m4-4v4"/><path d="M13 20h8"/></g>
      : <path d="M10 17h13m-13 4h13m-13 4h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
    {label && <><rect x="7" y="30" width="26" height="11" rx="2" className="games-file-mark-label"/><text x="20" y="38" textAnchor="middle" fill="currentColor" fontSize="7.5" fontWeight="700" fontFamily="var(--font-sans)">{label}</text></>}
  </svg>;
}
