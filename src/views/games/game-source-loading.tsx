import { useT } from "@/lib/i18n";

/** Uses the same row geometry as resolved files, including the icon and trailing selection. */
export function SourceFilesLoading({ rows = 1, heading = false }: { rows?: number; heading?: boolean }) {
  const t = useT();
  return <div className="games-source-files-loading" role="status" aria-label={t("common.loading")} aria-busy="true">
    {heading && <div className="games-source-public-heading" aria-hidden="true"><i className="games-source-bone games-source-bone-heading"/><i className="games-source-bone games-source-bone-count"/></div>}
    <div className="games-source-link-files" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <div className="games-source-file-skeleton" key={index}>
      <i className="games-source-bone games-source-bone-icon"/><span><i className="games-source-bone games-source-bone-name"/><i className="games-source-bone games-source-bone-size"/></span><i className="games-source-bone games-source-bone-selection"/>
    </div>)}</div>
  </div>;
}
