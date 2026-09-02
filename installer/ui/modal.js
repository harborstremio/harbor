export function openModal(options) {
  const restore = document.activeElement;

  const scrim = document.createElement('div');
  scrim.className = 'hb-modal-scrim';

  const panel = document.createElement('div');
  panel.className = 'hb-modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', options.label || '');
  panel.tabIndex = -1;

  const body = document.createElement('div');
  body.className = 'hb-modal-body';
  if (options.build) options.build(body);

  panel.appendChild(body);

  if (options.action) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'hb-modal-action';
    action.setAttribute('aria-label', options.action.label);
    action.title = options.action.label;

    const glyph = document.createElement('span');
    glyph.className = 'hb-modal-action-icon';
    action.appendChild(glyph);

    action.addEventListener('click', function () {
      options.action.onClick(action);
    });
    panel.appendChild(action);
  }

  scrim.appendChild(panel);
  document.body.appendChild(scrim);

  let shut = false;
  function dismiss() {
    if (shut) return;
    shut = true;
    scrim.classList.add('is-out');
    document.removeEventListener('keydown', onKey, true);
    window.setTimeout(function () {
      scrim.remove();
      if (restore && typeof restore.focus === 'function') restore.focus();
    }, 200);
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
  }

  scrim.addEventListener('mousedown', function (event) {
    if (event.target === scrim) dismiss();
  });
  document.addEventListener('keydown', onKey, true);

  window.requestAnimationFrame(function () {
    panel.focus();
  });

  return dismiss;
}
