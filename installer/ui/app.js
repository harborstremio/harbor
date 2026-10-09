import { t, onLocaleChange } from './i18n.js';
import { minimizeWindow, toggleMaximizeWindow, isMaximized, onWindowResized, harborVersion, isUninstallMode, isNative } from './bridge.js';
import * as start from './screens/start.js';
import * as uninstall from './screens/uninstall.js';
import * as removed from './screens/removed.js';
import * as language from './screens/language.js';
import * as terms from './screens/terms.js';
import * as welcome from './screens/welcome.js';
import * as installing from './screens/installing.js';
import * as finished from './screens/finished.js';

const INSTALL_SCREENS = [start, language, terms, welcome, installing, finished];
const UNINSTALL_SCREENS = [uninstall, removed];
let SCREENS = INSTALL_SCREENS;

const el = {
  titleLine: document.getElementById('hb-title-line'),
  screen: document.getElementById('screen'),
  consequence: document.getElementById('hb-consequence'),
  actions: document.getElementById('hb-actions'),
  back: document.getElementById('hb-back'),
  next: document.getElementById('hb-next'),
  close: document.getElementById('hb-close')
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  lang: 'en',
  accepted: false,
  progress: 0,
  dest: '',
  launchNow: true,
  desktopShortcut: false,
  mode: 'install',
  repair: null
};

let index = 0;
let cleanup = null;
let busy = false;
let rendering = false;
let pending = defaultFooter();

function defaultFooter() {
  return {
    backLabel: null,
    nextLabel: 'Continue',
    nextEnabled: true,
    onNext: null,
    onBack: null
  };
}

function outDuration() {
  return reduced.matches ? 120 : 160;
}

function labelDuration() {
  return reduced.matches ? 0 : 140;
}

const labelTargets = new Map();
const labelTimers = new Map();

[el.back, el.next].forEach((button) => {
  const label = button.querySelector('.hb-pill-label');
  if (label) labelTargets.set(button, label.textContent);
});

function setPillLabel(button, text) {
  const label = button.querySelector('.hb-pill-label');
  if (!label) return;
  if (labelTargets.get(button) === text) return;
  labelTargets.set(button, text);
  window.clearTimeout(labelTimers.get(button));
  if (!button.isConnected) {
    label.textContent = text;
    return;
  }
  label.classList.remove('hb-anim-label-in');
  label.classList.add('hb-anim-label-out');
  labelTimers.set(
    button,
    window.setTimeout(() => {
      label.textContent = text;
      label.classList.remove('hb-anim-label-out');
      label.classList.add('hb-anim-label-in');
    }, labelDuration())
  );
}

function applyFooter(cfg) {
  if (cfg.nextLabel) {
    if (!el.next.isConnected) el.actions.appendChild(el.next);
    setPillLabel(el.next, cfg.nextLabel);
    el.next.disabled = !cfg.nextEnabled;
  } else if (el.next.isConnected) {
    el.next.remove();
  }

  if (cfg.backLabel) {
    if (!el.back.isConnected) {
      el.actions.insertBefore(el.back, el.next.isConnected ? el.next : null);
    }
    setPillLabel(el.back, cfg.backLabel);
  } else if (el.back.isConnected) {
    el.back.remove();
  }
}

function setFooter(cfg) {
  pending = Object.assign(pending, cfg || {});
  if (!rendering) applyFooter(pending);
}

function setState(patch) {
  Object.assign(state, patch || {});
  return state;
}

function next() {
  goTo(index + 1);
}

function back() {
  goTo(index - 1);
}

const ctx = {
  get state() {
    return state;
  },
  setState,
  next,
  back,
  setFooter
};

function resolveIndex(target) {
  if (typeof target === 'number') return target;
  return SCREENS.findIndex((screen) => screen.id === target);
}

function goTo(target) {
  const nextIndex = resolveIndex(target);
  if (nextIndex < 0 || nextIndex >= SCREENS.length) return;
  if (nextIndex === index && el.screen.childElementCount > 0) return;
  if (busy) return;

  if (el.screen.childElementCount === 0) {
    mount(nextIndex);
    return;
  }

  busy = true;
  el.screen.classList.remove('hb-anim-screen-in');
  el.screen.classList.add('hb-anim-screen-out');
  el.titleLine.classList.remove('hb-anim-title-in');
  el.titleLine.classList.add('hb-anim-title-out');

  window.setTimeout(() => {
    try {
      mount(nextIndex);
    } finally {
      busy = false;
    }
  }, outDuration());
}

function mount(nextIndex) {
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (err) {
      console.error('[harbor-installer] cleanup threw', err);
    }
  }
  cleanup = null;

  index = nextIndex;
  const screen = SCREENS[index];

  el.screen.classList.remove('hb-anim-screen-out', 'hb-anim-screen-in');
  el.screen.replaceChildren();
  el.consequence.replaceChildren();

  el.titleLine.classList.remove('hb-anim-title-out', 'hb-anim-title-in');
  el.titleLine.textContent = t(screen.title);

  void el.screen.offsetWidth;
  el.screen.classList.add('hb-anim-screen-in');
  el.titleLine.classList.add('hb-anim-title-in');

  pending = defaultFooter();
  rendering = true;
  let result = null;
  try {
    result = screen.render(el.screen, ctx);
  } catch (err) {
    console.error('[harbor-installer] render threw in screen "' + screen.id + '"', err);
  } finally {
    rendering = false;
  }
  cleanup = typeof result === 'function' ? result : null;

  applyFooter(pending);
}

el.next.addEventListener('click', () => {
  if (el.next.disabled) return;
  if (typeof pending.onNext === 'function') pending.onNext();
  else next();
});

el.back.addEventListener('click', () => {
  if (typeof pending.onBack === 'function') pending.onBack();
  else back();
});

el.close.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('hb:close'));
  const tauri = window.__TAURI__;
  if (tauri && tauri.window && typeof tauri.window.getCurrentWindow === 'function') {
    tauri.window.getCurrentWindow().close();
    return;
  }
  window.close();
});

SCREENS.forEach((screen, i) => {
  if (typeof screen.id !== 'string' || typeof screen.title !== 'string' || typeof screen.render !== 'function') {
    console.error('[harbor-installer] screen at index ' + i + ' does not satisfy the module contract');
  }
});

window.HarborInstaller = {
  state,
  screens: SCREENS.map((screen) => screen.id),
  goTo,
  next,
  back
};

onLocaleChange(() => {
  applyFooter(pending);
  mount(index);
});

if (!isNative()) {
  const eyebrow = document.getElementById('hb-eyebrow');
  if (eyebrow) {
    const tag = document.createElement('span');
    tag.className = 'hb-preview-tag';
    tag.textContent = 'PREVIEW DATA';
    eyebrow.appendChild(tag);
  }
}

const versionEl = document.getElementById('hb-version');
const bootLayer = document.getElementById('hb-boot');
const BOOT_HOLD = 3900;

function playBootAnimation() {
  const host = document.getElementById('bx-lottie');
  if (!host || !window.lottie) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = window.lottie.loadAnimation({
    container: host,
    renderer: 'svg',
    loop: false,
    autoplay: !reduce,
    path: 'assets/boot-box.json',
  });
  if (reduce) anim.addEventListener('DOMLoaded', function () { anim.goToAndStop(anim.totalFrames - 1, true); });
}

function dismissBoot() {
  if (!bootLayer || bootLayer.classList.contains('is-gone')) return;
  bootLayer.classList.add('is-gone');
  window.setTimeout(function () { bootLayer.remove(); }, 520);
}

function startInstallFlow() {
  harborVersion().then(function (v) {
    if (!v) return;
    if (versionEl) versionEl.textContent = v;
  });

  if (!bootLayer) return;
  bootLayer.hidden = false;
  playBootAnimation();
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = typeof location !== 'undefined' && /[?&]hold/.test(location.search);
  if (!hold) window.setTimeout(dismissBoot, reduce ? 900 : BOOT_HOLD);
  bootLayer.addEventListener('click', dismissBoot);
}

isUninstallMode().then(function (yes) {
  if (yes) {
    if (bootLayer) bootLayer.remove();
    SCREENS = UNINSTALL_SCREENS;
    index = 0;
    mount(0);
    return;
  }
  startInstallFlow();
  mount(0);
});

const winMin = document.getElementById('hb-min');
const winMax = document.getElementById('hb-max');
const stage = document.getElementById('hb-window');
const BASE_W = 1028;
const BASE_H = 632;

function fitStage(maxed) {
  if (!stage) return;
  document.body.classList.toggle('is-maximized', !!maxed);
  if (!maxed) {
    stage.style.transform = '';
    return;
  }
  const k = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  stage.style.transform = k > 1.001 ? 'scale(' + k.toFixed(4) + ')' : '';
}

async function syncWindowState() {
  fitStage(await isMaximized());
}

onWindowResized(syncWindowState);
window.addEventListener('resize', syncWindowState);
syncWindowState();
if (winMin) winMin.addEventListener('click', function () { minimizeWindow(); });
if (winMax) winMax.addEventListener('click', function () { toggleMaximizeWindow().then(fitStage); });
