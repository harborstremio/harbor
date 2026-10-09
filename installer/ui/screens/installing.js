import { t } from '../i18n.js';
import { isNative, install as runInstall, repair as runRepair } from '../bridge.js';
export const id = 'installing';
export const title = 'Installing Harbor';
export const label = 'Installing';

const SLIDE_MS = 3300;
const HOLD_MS = 900;

export const PANELS = [
  {
    eyebrow: 'Public domain · 1920',
    headline: 'The Cabinet of Dr. Caligari',
    support: 'Directed by Robert Wiene. Werner Krauss and Conrad Veidt.',
    photo: 'caligari-cabinet.webp',
    focus: 'center 22%'
  },
  {
    eyebrow: 'Public domain · 1927',
    headline: 'Metropolis',
    support: 'Directed by Fritz Lang. Set photograph by Horst von Harbou.',
    photo: 'metropolis-machine.webp',
    focus: 'center 42%'
  },
  {
    eyebrow: 'Public domain · 1924',
    headline: 'Sherlock Jr.',
    support: 'Directed by Buster Keaton. Photographed by Elgin Lessley and Byron Houck.',
    photo: 'sherlock-screen.webp',
    focus: 'center 30%'
  },
  {
    eyebrow: 'Public domain · 1902',
    headline: 'Le Voyage dans la Lune',
    support: 'Directed by Georges Melies. Hand-coloured print.',
    photo: 'melies-moon.webp',
    focus: 'center 46%'
  },
  {
    eyebrow: 'Public domain · 1923',
    headline: 'Safety Last!',
    support: 'Directed by Fred C. Newmeyer and Sam Taylor. Starring Harold Lloyd.',
    photo: 'safety-last.webp',
    focus: 'center 30%'
  }
];

const PHASES = [
  { step: 'Verifying package signature', to: 0, ms: 1400 },
  { step: 'Preparing install location', to: 8, ms: 1200 },
  { step: 'Copying application files', to: 54, ms: 7400 },
  { step: 'Installing playback engine', to: 71, ms: 3200 },
  { step: 'Registering file associations', to: 80, ms: 1400 },
  { step: 'Creating shortcuts', to: 86, ms: 1100 },
  { step: 'Writing configuration', to: 93, ms: 1400 },
  { step: 'Finishing up', to: 100, ms: 1900 }
];

const TOTAL_MS = PHASES.reduce((sum, phase) => sum + phase.ms, 0);

function clipLine(spanClass) {
  const row = document.createElement('p');
  row.className = 'hb-i-line';
  const text = document.createElement('span');
  text.className = spanClass;
  row.appendChild(text);
  return { row, text };
}

function cursorAt(elapsed) {
  let acc = 0;
  let from = 0;
  for (let i = 0; i < PHASES.length; i += 1) {
    const phase = PHASES[i];
    if (elapsed < acc + phase.ms) {
      return { index: i, value: from + (phase.to - from) * ((elapsed - acc) / phase.ms) };
    }
    acc += phase.ms;
    from = phase.to;
  }
  return { index: PHASES.length - 1, value: 100 };
}

export function render(mount, ctx) {
  const repairing = ctx.state.mode === 'repair';
  ctx.setState({ progress: 0, repair: null });

  if (repairing) {
    const titleLine = document.getElementById('hb-title-line');
    if (titleLine) titleLine.textContent = t('Repairing Harbor');
  }

  const band = document.createElement('div');
  band.className = 'hb-bleed hb-i-band';

  const stage = document.createElement('div');
  stage.className = 'hb-i-stage';

  const plates = PANELS.map((panel) => {
    const plate = document.createElement('div');
    plate.className = 'hb-i-plate';
    const drift = document.createElement('div');
    drift.className = 'hb-i-drift';
    const shot = document.createElement('img');
    shot.className = 'hb-i-shot';
    shot.src = 'assets/slideshow/' + panel.photo;
    shot.style.objectPosition = panel.focus;
    shot.alt = '';
    drift.appendChild(shot);
    const veil = document.createElement('div');
    veil.className = 'hb-i-veil';
    plate.appendChild(veil);
    plate.appendChild(drift);
    stage.appendChild(plate);
    return plate;
  });

  const scrim = document.createElement('div');
  scrim.className = 'hb-i-scrim';

  const caption = document.createElement('div');
  caption.className = 'hb-i-caption';
  const capEyebrow = clipLine('t-eyebrow');
  const capHead = clipLine('t-lead');
  const capSupport = clipLine('t-body');
  caption.append(capEyebrow.row, capHead.row, capSupport.row);

  const bar = document.createElement('div');
  bar.className = 'hb-bar';
  const fill = document.createElement('div');
  fill.className = 'hb-bar-fill';
  const sweep = document.createElement('div');
  sweep.className = 'hb-indeterminate';
  bar.append(fill, sweep);

  band.append(stage, scrim, caption, bar);
  mount.appendChild(band);

  const consequence = document.getElementById('hb-consequence');

  const phase = document.createElement('div');
  phase.className = 'hb-i-phase';

  const percent = document.createElement('p');
  percent.className = 't-num hb-i-pct';
  percent.textContent = '0%';

  const stepLine = clipLine('t-body');
  stepLine.row.classList.add('hb-i-step');

  phase.append(percent, stepLine.row);
  consequence.appendChild(phase);

  const native = { active: isNative(), pct: 0, step: '', shown: '', done: false, error: null };
  if (native.active) {
    const onProgress = function (pct, step) {
      native.pct = pct;
      native.step = step;
    };
    const job = repairing
      ? runRepair({ dest: ctx.state.dest, onProgress: onProgress })
      : runInstall({
          dest: ctx.state.dest,
          desktopShortcut: ctx.state.desktopShortcut !== false,
          onProgress: onProgress
        });
    job.then(function (report) {
      if (repairing) ctx.setState({ repair: report || null });
      native.pct = 100;
      native.done = true;
    }).catch(function (e) {
      native.error = String(e && e.message ? e.message : e);
      native.step = repairing
        ? t('Repair failed: {error}', { error: native.error })
        : t('Install failed: {error}', { error: native.error });
      native.done = true;
    });
  }

  let raf = 0;
  let started = 0;
  let slideShown = -1;
  let phaseShown = -1;
  let pctShown = -1;
  let sweeping = true;

  function showPanel(index) {
    const panel = PANELS[index];
    plates.forEach((plate, n) => plate.classList.toggle('is-live', n === index));
    capEyebrow.text.textContent = t(panel.eyebrow);
    capHead.text.textContent = t(panel.headline);
    capSupport.text.textContent = t(panel.support);
    caption.classList.remove('is-in');
    void caption.offsetWidth;
    caption.classList.add('is-in');
  }

  function showStep(text) {
    stepLine.text.textContent = text;
    stepLine.row.classList.remove('is-in');
    void stepLine.row.offsetWidth;
    stepLine.row.classList.add('is-in');
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function frame(now) {
    if (!started) started = now;
    const elapsed = now - started;

    const slide = Math.floor(elapsed / SLIDE_MS) % PANELS.length;
    if (slide !== slideShown) {
      slideShown = slide;
      showPanel(slide);
    }

    let pct;
    if (native.active) {
      if (native.step && native.step !== native.shown) {
        native.shown = native.step;
        showStep(t(native.step));
      }
      pct = Math.max(0, Math.min(100, Math.round(native.pct)));
    } else {
      const cursor = cursorAt(elapsed);
      if (cursor.index !== phaseShown) {
        phaseShown = cursor.index;
        showStep(PHASES[cursor.index].step);
      }
      pct = Math.max(0, Math.min(100, Math.round(cursor.value)));
    }
    if (pct !== pctShown) {
      pctShown = pct;
      percent.textContent = pct + '%';
      fill.style.width = pct + '%';
      ctx.setState({ progress: pct });
    }

    if (sweeping && elapsed >= PHASES[0].ms) {
      sweeping = false;
      sweep.remove();
    }

    if (native.active) {
      if (native.done && elapsed >= HOLD_MS) {
        raf = 0;
        ctx.next();
        return;
      }
    } else if (elapsed >= TOTAL_MS + HOLD_MS) {
      raf = 0;
      ctx.next();
      return;
    }

    raf = window.requestAnimationFrame(frame);
  }

  raf = window.requestAnimationFrame(frame);

  ctx.setFooter({
    backLabel: t('Cancel'),
    nextLabel: null,
    onBack: () => {
      stop();
      ctx.back();
    }
  });

  return stop;
}
