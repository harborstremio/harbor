import { Files, Gamepad2, Info, Package, Puzzle, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { HoverTooltip } from '@/components/hover-tooltip';
import { useT, useUiLanguage } from '@/lib/i18n';
import type { DownloadItem } from '@/lib/games/download-presentation';
import { downloadContentLabel } from '@/lib/games/download-content';

function DownloadContentTooltip({ item, children }: { item: DownloadItem; children: (label: string, count: number, formatted: string) => ReactNode }) {
  const t = useT(), language = useUiLanguage(), count = item.kind === 'torrent' ? item.record.selected.length : 1;
  const formatted = count.toLocaleString(language);
  const type = t(downloadContentLabel(item));
  const label = t('games.download.center.contentInfo'), description = `${type} · ${t('games.download.center.fileCount', { count: formatted })}`;
  const kind = item.record.game?.contentKind;
  const Mark = kind === 'patch' ? Wrench : kind === 'mod' ? Puzzle : kind === 'extra' ? Package : item.record.game ? Gamepad2 : Files;
  return <HoverTooltip label={label} sublabel={description} mark={<Mark size={17} aria-hidden/>} side="top" className="games-download-content">
    {children(`${label}: ${description}`, count, formatted)}
  </HoverTooltip>;
}

export function DownloadContentInfo({ item, details, expanded, toggle }: { item: DownloadItem; details: string; expanded: boolean; toggle: () => void }) {
  return <DownloadContentTooltip item={item}>{(label, count, formatted) => <button className="games-download-content-info" aria-label={label} aria-expanded={expanded} aria-controls={details} onClick={toggle}><Info size={14} aria-hidden/>{count > 1 && <span aria-hidden>{formatted}</span>}</button>}</DownloadContentTooltip>;
}

/** The feature has no file disclosure; this is an informational hover/focus target. */
export function DownloadContentIndicator({ item }: { item: DownloadItem }) {
  return <DownloadContentTooltip item={item}>{(label, count, formatted) => <span className="games-download-content-info" tabIndex={0} role="img" aria-label={label}><Info size={14} aria-hidden/>{count > 1 && <span aria-hidden>{formatted}</span>}</span>}</DownloadContentTooltip>;
}
