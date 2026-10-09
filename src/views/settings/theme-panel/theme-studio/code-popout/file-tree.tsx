import { ChevronDown, Download, Folder } from "../../../icons";
import type { CodeLang } from "@/components/code-editor";
import { useT } from "@/lib/i18n";
import { IDE, type ThemeFile } from "./files";

export function FileTree({
  files,
  active,
  lengths,
  projectName,
  onSelect,
  onDownload,
}: {
  files: ThemeFile[];
  active: CodeLang;
  lengths: Record<CodeLang, number>;
  projectName: string;
  onSelect: (id: CodeLang) => void;
  onDownload: (id: CodeLang) => void;
}) {
  const t = useT();
  return (
    <aside
      className="flex w-[264px] shrink-0 flex-col"
      style={{ background: IDE.panel, borderInlineEnd: `1px solid ${IDE.border}` }}
    >
      <div className="px-4 pb-1.5 pt-4">
        <span
          className="text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]"
          style={{ color: IDE.textFaint }}
        >
          {t("Project")}
        </span>
      </div>

      <div className="flex h-11 items-center gap-2 px-3.5">
        <ChevronDown size={16} strokeWidth={2.4} style={{ color: IDE.textDim }} />
        <Folder size={18} strokeWidth={2} style={{ color: IDE.accent }} />
        <span
          className="truncate text-[16.5px] font-medium leading-[24px] tracking-[-0.1px]"
          style={{ color: IDE.text }}
        >
          {projectName}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        {files.map((f) => {
          const Icon = f.icon;
          const on = f.id === active;
          const len = lengths[f.id];
          return (
            <div key={f.id} className="group/row relative">
              {on && (
                <span
                  className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ background: IDE.accent }}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                className={`flex h-11 w-full items-center gap-2.5 rounded-md ps-6 pe-2.5 text-start transition-colors ${
                  on ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" style={{ color: f.tint }} />
                <span
                  className="flex-1 truncate text-[16.5px] font-medium leading-[24px] tracking-[-0.1px]"
                  style={{ color: IDE.text }}
                >
                  {f.name}
                </span>
                {len > 0 && (
                  <span
                    className="shrink-0 tabular-nums text-[15.5px] font-normal leading-[22px] transition-opacity group-hover/row:opacity-0 group-focus-within/row:opacity-0"
                    style={{ color: IDE.textFaint }}
                  >
                    {len.toLocaleString()}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDownload(f.id)}
                aria-label={t("Download {file}", { file: f.name })}
                className="absolute end-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-white/10 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
                style={{ color: IDE.textDim }}
              >
                <Download size={18} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
