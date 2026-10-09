import { t } from '../i18n.js';
import { openExternal, uninstallFacts } from '../bridge.js';

export const id = 'uninstall';
export const title = 'Uninstall Harbor';
export const label = 'Uninstall';

const KEPT = [
  'Your library, watch history and continue watching',
  'Settings, themes, addons and profiles',
  'Downloaded manga and subtitle caches'
];

const ALTERNATIVES = [
  {
    name: 'Stremio',
    note: 'The original. Addons, catalogs, its own player.',
    url: 'https://www.stremio.com',
    logo: 'assets/alt-stremio.png'
  },
  {
    name: 'Stremio Enhanced',
    note: 'Stremio with community themes and plugins.',
    url: 'https://github.com/REVENGE977/stremio-enhanced-community',
    logo: 'assets/alt-stremio.png',
    tag: 'E'
  },
  {
    name: 'Nuvio',
    note: 'An open source player for TV, mobile and desktop, with plenty of features.',
    url: 'https://nuvio.tv/',
    logo: 'assets/alt-nuvio.png'
  }
];

function mb(bytes) {
  if (!bytes) return '0 MB';
  const m = bytes / 1048576;
  if (m >= 1024) return (m / 1024).toFixed(2) + ' GB';
  return Math.round(m) + ' MB';
}

function altTile(spec, i) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'hb-alt';
  row.style.setProperty('--i', String(i));
  row.addEventListener('click', () => openExternal(spec.url));

  const badge = document.createElement('span');
  badge.className = 'hb-alt-badge';

  const img = document.createElement('img');
  img.src = spec.logo;
  img.alt = '';
  img.draggable = false;
  badge.appendChild(img);

  if (spec.tag) {
    const tag = document.createElement('span');
    tag.className = 'hb-alt-tag';
    tag.textContent = spec.tag;
    badge.appendChild(tag);
  }

  const text = document.createElement('span');
  text.className = 'hb-alt-text';

  const name = document.createElement('span');
  name.className = 'hb-alt-name';
  name.textContent = spec.name;

  const note = document.createElement('span');
  note.className = 'hb-alt-note t-sub';
  note.textContent = t(spec.note);

  text.append(name, note);
  row.append(badge, text);
  return row;
}

export function render(mount, ctx) {
  const live = { on: true };

  const lead = document.createElement('p');
  lead.className = 'hb-un-lead t-body';
  lead.textContent = t('This removes the Harbor app from this computer. Nothing else is touched.');

  const grid = document.createElement('div');
  grid.className = 'hb-un-grid';

  const goes = document.createElement('div');
  goes.className = 'hb-un-col';
  const goesHead = document.createElement('p');
  goesHead.className = 'hb-un-head t-eyebrow';
  goesHead.textContent = t('What gets removed');
  const goesList = document.createElement('ul');
  goesList.className = 'hb-un-list';
  goes.append(goesHead, goesList);

  const stays = document.createElement('div');
  stays.className = 'hb-un-col';
  const staysHead = document.createElement('p');
  staysHead.className = 'hb-un-head t-eyebrow';
  staysHead.textContent = t('What stays');
  const staysList = document.createElement('ul');
  staysList.className = 'hb-un-list';
  stays.append(staysHead, staysList);

  grid.append(goes, stays);

  function item(list, text, tone) {
    const li = document.createElement('li');
    li.className = 'hb-un-item t-prose' + (tone ? ' ' + tone : '');
    li.style.setProperty('--i', String(list.childElementCount));
    const dot = document.createElement('span');
    dot.className = 'hb-un-dot';
    const copy = document.createElement('span');
    copy.textContent = text;
    li.append(dot, copy);
    list.appendChild(li);
    return li;
  }

  const wipe = document.createElement('button');
  wipe.type = 'button';
  wipe.className = 'hb-un-wipe';
  wipe.setAttribute('role', 'checkbox');
  wipe.setAttribute('aria-checked', 'false');

  const wipeBox = document.createElement('span');
  wipeBox.className = 'hb-un-box';

  const wipeText = document.createElement('span');
  wipeText.className = 'hb-un-wipe-text t-prose';
  wipeText.textContent = t('Remove my data too');

  wipe.append(wipeBox, wipeText);

  let removeData = false;
  wipe.addEventListener('click', () => {
    removeData = !removeData;
    wipe.setAttribute('aria-checked', String(removeData));
    ctx.setState({ removeData });
    staysList.classList.toggle('is-struck', removeData);
  });

  const altHead = document.createElement('p');
  altHead.className = 'hb-un-head t-eyebrow hb-alt-head';
  altHead.textContent = t('If Harbor was not for you');

  const alts = document.createElement('div');
  alts.className = 'hb-alts';
  ALTERNATIVES.forEach((spec, i) => alts.appendChild(altTile(spec, i)));

  mount.append(lead, grid, wipe, altHead, alts);

  uninstallFacts().then((f) => {
    if (!live.on || !f) return;
    ctx.setState({ dest: f.dest, version: f.version });

    const versionEl = document.getElementById('hb-version');
    if (versionEl && f.version) versionEl.textContent = f.version;
    item(goesList, t('Harbor {version} and its player files', { version: f.version }));
    item(goesList, t('{size} in {path}', { size: mb(f.program_bytes), path: f.dest }));
    item(goesList, t('Start Menu and desktop shortcuts'));
    KEPT.forEach((line) => item(staysList, t(line)));
    if (f.data_bytes) {
      wipeText.textContent = t('Remove my data too ({size})', { size: mb(f.data_bytes) });
    }
  });

  ctx.setFooter({
    backLabel: t('Keep Harbor'),
    nextLabel: t('Uninstall'),
    nextEnabled: true,
    onBack: () => document.getElementById('hb-close').click(),
    onNext: () => ctx.next()
  });

  return () => {
    live.on = false;
  };
}
