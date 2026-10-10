import type { DownloadItem } from './download-presentation';

export function downloadContentLabel(item: DownloadItem): string {
  const kind=item.record.game?.contentKind;
  if(kind==='patch'||kind==='mod'||kind==='extra')return `games.download.center.content.${kind}`;
  return item.record.game?'games.download.center.gameFiles':'games.download.center.files';
}
