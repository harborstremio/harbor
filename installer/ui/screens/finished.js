import { t } from '../i18n.js';
import { launch, closeWindow } from '../bridge.js';
export const id = 'finished';
export const title = 'Harbor is ready';
export const label = 'Finished';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CONFIRM_PATH = 'M5.2 11.6 L9.4 15.8 L16.8 7';
const CHOICE_PATH = 'M2.3 5.4 L4.4 7.5 L7.9 3.2';

function drawnCheck(size, d, className) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) svg.setAttribute('class', className);

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('pathLength', '1');
  svg.appendChild(path);

  return svg;
}

function replayDraw(svg) {
  svg.classList.remove('hb-draw');
  void svg.getBoundingClientRect();
  svg.classList.add('hb-draw');
}

function choice(text, checked, onToggle) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'hb-fin-choice';
  row.setAttribute('role', 'checkbox');
  row.setAttribute('aria-checked', String(checked));

  const box = document.createElement('span');
  box.className = 'hb-check';
  box.setAttribute('aria-hidden', 'true');
  box.setAttribute('aria-checked', String(checked));

  const mark = drawnCheck(10, CHOICE_PATH);
  box.appendChild(mark);

  const label = document.createElement('span');
  label.className = 't-label hb-fin-choice-label';
  label.textContent = text;

  row.append(box, label);

  row.addEventListener('click', () => {
    const value = row.getAttribute('aria-checked') !== 'true';
    row.setAttribute('aria-checked', String(value));
    box.setAttribute('aria-checked', String(value));
    if (value) replayDraw(mark);
    onToggle(value);
  });

  return row;
}

function repairLines(report) {
  const broken = (report.missing || 0) + (report.damaged || 0);
  const lines = [
    broken
      ? t('Checked {total} files and restored {count}.', { total: report.checked, count: broken })
      : t('Checked {total} files. Nothing needed repair.', { total: report.checked })
  ];
  if (report.shortcut_restored) lines.push(t('The Start Menu shortcut was put back.'));
  if (report.registry_restored) lines.push(t('The uninstall entry was rewritten.'));
  lines.push(t('Your library and settings were not touched.'));
  return lines;
}

function repairWell(report) {
  const well = document.createElement('div');
  well.className = 'hb-fin-repair hb-well hb-well-lg';
  repairLines(report).forEach((text) => {
    const row = document.createElement('p');
    row.className = 'hb-fin-repair-line t-body';
    const dot = document.createElement('span');
    dot.className = 'hb-dot';
    const copy = document.createElement('span');
    copy.textContent = text;
    row.append(dot, copy);
    well.appendChild(row);
  });
  return well;
}

export function render(mount, ctx) {
  const versionEl = document.getElementById('hb-version');
  const version = versionEl ? versionEl.textContent.trim() : '0.9.121';
  const report = ctx.state.repair || null;

  const launchNow = ctx.state.launchNow !== false;
  const desktopShortcut = ctx.state.desktopShortcut === true;
  ctx.setState({ launchNow, desktopShortcut });

  const confirm = document.createElement('div');
  confirm.className = 'hb-fin-confirm';

  const badge = document.createElement('div');
  badge.className = 'hb-confirm hb-anim-confirm-pop';
  badge.appendChild(drawnCheck(22, CONFIRM_PATH, 'hb-fin-mark hb-draw'));

  const copy = document.createElement('div');
  copy.className = 'hb-fin-confirm-text';

  const lead = document.createElement('p');
  lead.className = 't-lead';
  lead.textContent = report ? t('Harbor is repaired') : t('Harbor is installed');

  const sub = document.createElement('p');
  sub.className = 't-sub';
  sub.textContent = t('Version {version}, {size}', { version: version, size: ctx.state.installedSize || '' }).replace(/,\s*$/, '');

  copy.append(lead, sub);
  confirm.append(badge, copy);

  const consequence = document.getElementById('hb-consequence');

  const outcome = document.createElement('p');
  outcome.className = 't-body hb-fin-line';

  const where = document.createElement('p');
  where.className = 't-meta hb-fin-line';
  where.textContent = t('Installed to {path}', { path: ctx.state.dest || '' });

  function paintOutcome() {
    outcome.textContent = ctx.state.launchNow
      ? t('Harbor will open when this window closes.')
      : t('Harbor will not open now.');
  }

  const choices = document.createElement('div');
  choices.className = 'hb-fin-choices';
  choices.append(
    choice(t('Launch Harbor now'), launchNow, (value) => {
      ctx.setState({ launchNow: value });
      paintOutcome();
    }),
    choice(t('Create a desktop shortcut'), desktopShortcut, (value) => {
      ctx.setState({ desktopShortcut: value });
    })
  );

  mount.append(confirm);
  if (report) mount.appendChild(repairWell(report));
  mount.appendChild(choices);

  paintOutcome();
  consequence.append(outcome, where);

  ctx.setFooter({
    backLabel: null,
    nextLabel: t('Close'),
    nextEnabled: true,
    onNext: () => {
      document.dispatchEvent(
        new CustomEvent('hb:finish', {
          detail: {
            launchNow: ctx.state.launchNow,
            desktopShortcut: ctx.state.desktopShortcut
          }
        })
      );
      const done = ctx.state.launchNow ? launch(ctx.state.dest) : Promise.resolve();
      done.then(function () {
        return closeWindow();
      }).then(function () {
        const btn = document.getElementById('hb-close');
        if (btn) btn.click();
      });
    }
  });
}
