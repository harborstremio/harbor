import { t } from '../i18n.js';
import { openExternal, runUninstall, closeWindow } from '../bridge.js';

export const id = 'removed';
export const title = 'Uninstalling Harbor';
export const label = 'Removed';

const SVG_NS = 'http://www.w3.org/2000/svg';

function checkGlyph() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 22 22');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M5.2 11.6 L9.4 15.8 L16.8 7');
  path.setAttribute('pathLength', '1');
  svg.appendChild(path);
  return { svg, path };
}

export function render(mount, ctx) {
  const live = { on: true };

  const head = document.createElement('div');
  head.className = 'hb-rm-confirm';

  const badge = document.createElement('div');
  badge.className = 'hb-rm-badge';
  const { svg, path } = checkGlyph();
  badge.appendChild(svg);

  const copy = document.createElement('div');
  copy.className = 'hb-rm-copy';

  const lead = document.createElement('p');
  lead.className = 't-lead';
  lead.textContent = t('Uninstalling Harbor');

  const sub = document.createElement('p');
  sub.className = 't-sub';
  sub.textContent = t('This takes a moment.');

  copy.append(lead, sub);
  head.append(badge, copy);

  const note = document.createElement('p');
  note.className = 'hb-rm-note t-prose';

  mount.append(head, note);

  ctx.setFooter({ backLabel: null, nextLabel: t('Close'), nextEnabled: false, onNext: null });

  function setTitle(text) {
    const line = document.getElementById('hb-title-line');
    if (!line) return;
    line.textContent = text;
    line.classList.remove('hb-anim-title-in');
    void line.offsetWidth;
    line.classList.add('hb-anim-title-in');
  }

  function onProgress(_value, label) {
    if (!live.on || !label) return;
    const next = t(label);
    if (next === sub.textContent) return;
    sub.textContent = next;
    sub.classList.remove('hb-rm-step-in');
    void sub.offsetWidth;
    sub.classList.add('hb-rm-step-in');
  }

  runUninstall({
    dest: ctx.state.dest,
    removeData: ctx.state.removeData === true,
    onProgress
  })
    .then(() => {
      if (!live.on) return;
      sub.classList.remove('hb-rm-step-in');
      badge.classList.add('is-done');
      setTitle(t('Harbor has been removed'));
      path.classList.add('hb-draw');

      lead.textContent = t('Harbor has been removed');
      sub.textContent = ctx.state.removeData
        ? t('Your data was removed as well.')
        : t('Thanks for giving it a run.');

      if (!ctx.state.removeData) {
        note.textContent = t(
          'Your library and settings are still on this computer, so reinstalling picks up exactly where you left off.',
        );
      }

      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'hb-rm-link';
      back.textContent = t('Download Harbor again');
      back.addEventListener('click', () => openExternal('https://harbor.site'));
      mount.appendChild(back);

      ctx.setFooter({ nextEnabled: true, onNext: () => closeWindow() });
    })
    .catch(() => {
      if (!live.on) return;
      sub.classList.remove('hb-rm-step-in');
      setTitle(t('Harbor could not be removed'));
      lead.textContent = t('Harbor could not be removed');
      sub.textContent = t('Close Harbor if it is running, then try again.');
      ctx.setFooter({ nextEnabled: true, onNext: () => closeWindow() });
    });

  return () => {
    live.on = false;
  };
}
