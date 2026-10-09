import { t } from '../i18n.js';
import { installFacts, pickFolder, freeSpaceAt, existingInstall } from '../bridge.js';

export const id = 'welcome';
export const title = 'What gets installed';
export const label = 'Components';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ROWS = [
  { key: 'harbor', name: 'Harbor', note: 'Player, library, torrent engine' },
  { key: 'mpv', name: 'mpv playback engine', note: 'Hardware decoding, HDR, subtitles' },
  { key: 'ffmpeg', name: 'ffmpeg and ffprobe', note: 'Media inspection and remux' },
  { key: 'ytdlp', name: 'yt-dlp', note: 'Web stream extraction' },
  { key: 'webview2', name: 'WebView2 runtime', note: 'Supplied by Windows' },
  { key: 'shortcuts', name: 'Shortcuts', note: 'Start Menu and desktop' }
];

function mb(bytes) {
  if (!bytes) return '0 MB';
  const m = bytes / 1048576;
  if (m >= 1024) return (m / 1024).toFixed(2) + ' GB';
  return Math.round(m) + ' MB';
}

function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function samePath(a, b) {
  const norm = (value) => String(value || '').replace(/[\\/]+$/, '').toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}

function actionFor(prior, version, dest) {
  if (!prior || !samePath(prior.path, dest)) return { mode: 'install', label: t('Install'), lead: '' };
  const was = prior.version || '';
  const cmp = compareVersions(version, was);
  if (cmp > 0) return { mode: 'install', label: t('Update'), lead: t('Replaces {version}', { version: was }) };
  if (cmp < 0) return { mode: 'install', label: t('Downgrade'), lead: t('Rolls back from {version}', { version: was }) };
  return { mode: 'repair', label: t('Repair'), lead: t('Repairs {version}', { version: was }) };
}

function strokeIcon(d, width) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', width);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}

export function render(mount, ctx) {
  const live = { on: true };

  const grid = document.createElement('ul');
  grid.className = 'hb-welcome-grid';
  grid.setAttribute('aria-label', 'What this installer places on your machine');

  const cells = {};
  ROWS.forEach((item, i) => {
    const row = document.createElement('li');
    row.className = 'hb-welcome-row hb-anim-row-in';
    row.style.setProperty('--i', String(i));

    const mark = document.createElement('span');
    mark.className = 'hb-welcome-mark';
    mark.appendChild(strokeIcon('M6 4 L10 8 L6 12', '1.75'));

    const text = document.createElement('span');
    text.className = 'hb-welcome-text';
    const name = document.createElement('span');
    name.className = 'hb-welcome-name t-label';
    name.textContent = t(item.name);
    const note = document.createElement('span');
    note.className = 'hb-welcome-note t-sub';
    note.textContent = t(item.note);
    text.append(name, note);

    const size = document.createElement('span');
    size.className = 'hb-welcome-size t-meta hb-skeleton';

    cells[item.key] = { size, mark, note, row };
    row.append(mark, text, size);
    grid.appendChild(row);
  });

  const loc = document.createElement('div');
  loc.className = 'hb-welcome-loc hb-well';
  const path = document.createElement('span');
  path.className = 'hb-welcome-path t-path' + (ctx.state.dest ? '' : ' hb-skeleton');
  path.textContent = ctx.state.dest || '';
  const total = document.createElement('span');
  total.className = 'hb-welcome-total t-meta hb-skeleton';
  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'hb-welcome-change hb-pill-mini t-btn-mini';
  change.setAttribute('aria-label', t('Change the install location'));
  change.textContent = t('Change');
  loc.append(path, total, change);

  let needed = 0;
  let facts = null;
  let prior = null;

  function setFree(bytes) {
    total.textContent = bytes ? t('{size} free', { size: mb(bytes) }) : t('Free space unknown');
    total.classList.toggle('is-tight', Boolean(bytes) && bytes < needed);
  }

  function paintAction() {
    if (!facts) return;
    const verb = actionFor(prior, facts.version, ctx.state.dest);
    ctx.setState({ mode: verb.mode });
    ctx.setFooter({ nextLabel: verb.label });
    const detail =
      verb.mode === 'repair'
        ? [verb.lead, t('Only broken files are replaced'), t('Your data is left alone')]
        : [verb.lead, t('{size} on disk', { size: mb(needed) }), t('Nothing to download')];
    line.textContent = detail.filter(Boolean).join(' · ');
  }

  change.addEventListener('click', async () => {
    const picked = await pickFolder(ctx.state.dest);
    if (!picked || !live.on) return;
    const tail = picked.split(/[\\/]/).filter(Boolean).pop() || '';
    const trimmed = picked.replace(/[\\/]+$/, '');
    const dest = tail.toLowerCase() === 'harbor' ? trimmed : trimmed + String.raw`\Harbor`;
    path.textContent = dest;
    ctx.setState({ dest: dest });
    paintAction();
    setFree(await freeSpaceAt(dest));
  });


  mount.append(grid, loc);

  const zone = document.getElementById('hb-consequence');
  const line = document.createElement('p');
  line.className = 't-body hb-welcome-consequence hb-skeleton';
  if (zone) zone.appendChild(line);

  Promise.all([installFacts(), existingInstall()]).then(([f, found]) => {
    if (!live.on) return;
    facts = f;
    prior = found && found.path ? found : null;
    Object.keys(cells).forEach(function (k) { cells[k].size.classList.remove('hb-skeleton'); });
    path.classList.remove('hb-skeleton');
    total.classList.remove('hb-skeleton');
    line.classList.remove('hb-skeleton');
    const byKey = {};
    (f.components || []).forEach((c) => { byKey[c.key] = c.bytes; });

    cells.harbor.size.textContent = mb((byKey.harbor || 0) + (byKey.support || 0));
    cells.mpv.size.textContent = mb(byKey.mpv || 0);
    cells.ffmpeg.size.textContent = mb(byKey.ffmpeg || 0);
    cells.ytdlp.size.textContent = mb(byKey.ytdlp || 0);
    cells.shortcuts.size.textContent = t('No space');

    const wv = cells.webview2;
    if (f.webview2_present) {
      wv.row.classList.add('is-present');
      wv.mark.replaceChildren(strokeIcon('M4 8.4 L6.8 11 L12 5', '2'));
      wv.note.textContent = t('Already on this PC, nothing to do');
      wv.size.textContent = t('Skipped');
    } else {
      wv.note.textContent = t('Not found, Windows will fetch it');
      wv.size.textContent = t('about {size}', { size: mb(f.webview2_bytes) });
    }

    const dest = prior ? prior.path : f.dest;
    path.textContent = dest;
    ctx.setState({ dest: dest });

    needed = f.installed_bytes + (f.webview2_present ? 0 : f.webview2_bytes);
    ctx.setState({ installedSize: mb(f.installed_bytes) });
    setFree(prior ? 0 : f.free_bytes || 0);
    if (prior) freeSpaceAt(dest).then((b) => { if (live.on) setFree(b); });

    paintAction();
  });

  ctx.setState({ mode: 'install' });

  ctx.setFooter({
    backLabel: t('Back'),
    nextLabel: t('Install'),
    nextEnabled: true,
    onBack: () => ctx.back(),
    onNext: () => ctx.next()
  });

  return () => {
    live.on = false;
    if (zone) zone.replaceChildren();
  };
}
