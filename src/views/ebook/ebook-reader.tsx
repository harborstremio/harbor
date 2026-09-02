import type { EBookChapter, EBookChapterContent } from "@/lib/ebook/providers";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { HarborReader, type EBookReaderVolume } from "./harbor-reader";

function textDirection(text: string): "ltr" | "rtl" {
  const rtl = text.match(/[\u0600-\u06ff\u0750-\u077f]/g)?.length ?? 0;
  const ltr = text.match(/[A-Za-z]/g)?.length ?? 0;
  return rtl > ltr ? "rtl" : "ltr";
}

export function EBookReader({
  bookId,
  bookTitle,
  bookCover,
  internalCover,
  chapter,
  content,
  error,
  volumes,
  onSelectChapter,
  onClose,
}: {
  bookId: string;
  bookTitle: string;
  bookCover?: string;
  internalCover?: string;
  chapter: EBookChapter;
  content: EBookChapterContent | null;
  error?: string;
  volumes: EBookReaderVolume[];
  onSelectChapter: (chapter: EBookChapter) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { activeId } = useProfiles();
  const profile = activeId ?? "default";
  const direction = textDirection(content?.text ?? "");

  if (!content || error) {
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0b0b0d] text-ink">
        <div className="text-center">
          <p className={error ? "text-red-400" : "text-ink-muted"}>
            {error ?? t("Loading chapter…")}
          </p>
          {error && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-xl bg-raised px-4 py-2 text-sm"
            >
              {t("Close reader")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <HarborReader
      profile={profile}
      bookId={bookId}
      bookTitle={bookTitle}
      bookCover={bookCover}
      internalCover={internalCover}
      chapter={chapter}
      content={content}
      direction={direction}
      volumes={volumes}
      onSelectChapter={onSelectChapter}
      onClose={onClose}
    />
  );
}
