import { sourcePlatformId } from './source-platform';
import type { SourceFile, SourceRelease } from './sources';

export type DesktopTarget = 'windows' | 'linux' | 'macos';
export type SourceCompatibility = { target?: DesktopTarget; status: 'native' | 'compatibility' | 'other' | 'unknown' | 'browse' };
const targets: Record<number, DesktopTarget> = { 6: 'windows', 3: 'linux', 14: 'macos' };

/** Judge the selected package, never the catalog game's list of available ports. */
export function sourceCompatibility(release: Pick<SourceRelease, 'platform'>, file: SourceFile, host: string): SourceCompatibility {
  let filename = file.name;
  if (file.kind === 'direct') {
    try { filename += ` ${decodeURIComponent(new URL(file.url).pathname.split('/').pop() ?? '')}`; } catch { /* Keep the source's filename. */ }
  }
  const hints = new Set<DesktopTarget>();
  if (/\.(exe|msi)(?:\s|$)/i.test(filename) || /(?:^|[\s._-])(?:windows|win32|win64)(?:[\s._-]|$)/i.test(filename)) hints.add('windows');
  if (/\.(dmg|pkg|app)(?:\s|$)/i.test(filename) || /(?:^|[\s._-])(?:macos|osx|mac)(?:[\s._-]|$)/i.test(filename)) hints.add('macos');
  if (/\.(appimage|deb|rpm)(?:\s|$)/i.test(filename) || /(?:^|[\s._-])linux(?:[\s._-]|$)/i.test(filename)) hints.add('linux');
  // Per-file evidence takes precedence: a release can contain separate builds for each OS.
  const target = hints.size === 1 ? [...hints][0] : hints.size > 1 ? undefined : targets[sourcePlatformId(release.platform) ?? -1];
  if (!target) return { status: 'unknown' };
  if (!['windows', 'macos', 'linux'].includes(host)) return { target, status: 'browse' };
  return { target, status: target === host ? 'native' : target === 'windows' && host === 'linux' ? 'compatibility' : 'other' };
}
