import { ArrowLeft, FileX } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Html5ErrorSourceKey } from "@/lib/player/html5/error-map";

export function LocalFileError({
  path,
  errorSourceKey,
  errorDetail,
  onBack,
  onRetry,
}: {
  path: string;
  errorSourceKey: Html5ErrorSourceKey;
  errorDetail: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  const filename = path.split(/[\\/]/).pop() ?? path;
  const looksLikeOneDrive = /onedrive/i.test(path);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-md">
      <div className="flex max-w-xl flex-col items-center gap-5 px-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/15 text-rose-200">
          <FileX size={26} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-[24px] font-semibold text-white">
            {t("Couldn't open this file")}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-white/70">{filename}</p>
        </div>
        {looksLikeOneDrive && (
          <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-[12.5px] leading-relaxed text-amber-100/85">
            {t(
              'This file is in OneDrive. If "Files On-Demand" is on, the file is a cloud placeholder until it\'s downloaded. Right-click it in Explorer and pick',
            )}{" "}
            <span className="font-semibold">{t("Always keep on this device")}</span>
            {t(", then try again.")}
          </p>
        )}
        {!looksLikeOneDrive && (
          <div className="flex flex-col gap-2">
            <p className="rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-[12.5px] leading-relaxed text-white/70">
              {t(errorSourceKey)}
            </p>
            {errorDetail && (
              <p className="break-words rounded-xl border border-white/12 bg-white/5 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-white/65">
                {errorDetail}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            onClick={onBack}
            className="flex h-11 items-center gap-2 rounded-full bg-[#34343b] px-5 text-[13px] font-medium text-white/85 transition-colors hover:bg-[#41414a]"
          >
            <ArrowLeft size={14} strokeWidth={2} className="dir-icon" />
            {t("Back to library")}
          </button>
          <button
            onClick={onRetry}
            className="flex h-11 items-center rounded-full bg-[#26262c] px-5 text-[13px] font-medium text-white/70 transition-colors hover:bg-[#31313a] hover:text-white"
          >
            {t("Try again")}
          </button>
        </div>
      </div>
    </div>
  );
}
