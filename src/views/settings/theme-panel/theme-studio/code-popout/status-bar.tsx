import { useT } from "@/lib/i18n";
import { IDE, type ThemeFile } from "./files";

export function StatusBar({
  file,
  line,
  col,
  lines,
  chars,
}: {
  file: ThemeFile;
  line: number;
  col: number;
  lines: number;
  chars: number;
}) {
  const t = useT();
  return (
    <footer
      className="flex h-11 shrink-0 items-center gap-4 whitespace-nowrap px-4 text-[15.5px] font-normal leading-[22px]"
      style={{ background: IDE.panel, borderBlockStart: `1px solid ${IDE.border}`, color: IDE.textDim }}
    >
      <span
        className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]"
        style={{ background: `${file.tint}22`, color: file.tint }}
      >
        {file.lang}
      </span>
      <span className="tabular-nums">{t("Ln {line}, Col {col}", { line, col })}</span>
      <span className="tabular-nums">{t("{lines} lines", { lines })}</span>
      <span className="tabular-nums">{t("{chars} chars", { chars: chars.toLocaleString() })}</span>
      <span className="ms-auto flex items-center gap-4">
        <span>{t("Spaces: 2")}</span>
        <span>UTF-8</span>
        <span className="flex items-center gap-1.5" style={{ color: IDE.accent }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: IDE.accent }} />
          {t("Live")}
        </span>
      </span>
    </footer>
  );
}
