import { useT } from '@/lib/i18n';
import { osClass } from '@/lib/platform';
import { sourceCompatibility } from '@/lib/games/source-compatibility';
import type { SourceFile, SourceRelease } from '@/lib/games/sources';
export function GameSourceCompatibility({ release, file }: { release: SourceRelease; file: SourceFile }) {
  const t = useT(), host = osClass(), { target, status } = sourceCompatibility(release, file, host);
  const names: Record<string, string> = { windows: 'Windows', linux: 'Linux', macos: 'macOS' };
  const label = t('games.sources.platform.' + status, { platform: names[target ?? ''] ?? '', host: names[host] ?? '' });
  return <small className={'games-source-compatibility is-' + status} title={t('games.sources.platform.' + status + 'Note')}>{label}</small>;
}
