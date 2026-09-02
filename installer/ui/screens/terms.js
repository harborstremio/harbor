import { t, setLocale, getLocale, isRTL, VARIANTS } from '../i18n.js';
import { printTerms } from '../bridge.js';
export const id = 'terms';
export const title = 'Terms of service';
export const label = 'Terms';

const INTRO =
  'Last updated 12 August 2026. These terms cover the Harbor application and the installer you are ' +
  'running now. They are short on purpose. Read them before you continue.';

const SECTIONS = [
  {
    heading: 'Harbor is a media client',
    body: [
      'Harbor is a media client that runs on your own computer. It plays video, remembers what you ' +
        'have watched, and organizes the libraries you point it at.',
      'Harbor is not a streaming service, not a subscription, and not a catalog. Freshly installed and ' +
        'left alone, it has nothing to play.'
    ]
  },
  {
    heading: 'You supply the sources',
    body: [
      'Every catalog, stream, subtitle and piece of artwork that Harbor shows you arrives from an ' +
        'addon. You choose which addons to install and you supply the address of each one. Harbor ' +
        'ships with none of its own.',
      'Harbor does not curate, rank, endorse or verify addons, and it has no relationship with the ' +
        'people who write them. An addon you install can answer any request Harbor makes on your ' +
        'behalf, so install only the ones you trust.'
    ]
  },
  {
    heading: 'No content is hosted or provided',
    body: [
      'Harbor hosts no media, stores no media and indexes no media. Harbor operates no source, no ' +
        'tracker, no index and no debrid service. Nothing you watch is served by us.',
      'When you press play, the request goes to a service you chose and configured, and the response ' +
        'comes back from that service. What it makes available, and whether you are entitled to reach ' +
        'it, is a matter between you and them.'
    ]
  },
  {
    heading: 'Your responsibility',
    body: [
      'You are responsible for the addons you install, the accounts you connect, and the material you ' +
        'reach through them. You agree to use Harbor only in ways that are lawful where you live, and ' +
        'to respect the rights of the people who made the work you are watching. If you cannot tell ' +
        'whether a source is legitimate, do not use it.'
    ]
  },
  {
    heading: 'Your data',
    body: [
      'Your settings, your library and your playback history stay on this computer. If you create a ' +
        'Harbor account and turn on sync, the data you choose to sync is also held on Harbor servers ' +
        'so that your devices can share it. Credentials for the services you connect are kept on your ' +
        'machine and are never sent to us.'
    ]
  },
  {
    heading: 'Updates',
    body: [
      'Harbor checks for updates and can install them for you. A later release may carry revised ' +
        'terms, and the current text always travels with the application. If you keep using Harbor ' +
        'after an update, you accept the terms that came with it.'
    ]
  },
  {
    heading: 'No warranty',
    body: [
      'Harbor is provided as is and as available, without warranty of any kind, whether express or ' +
        'implied, including the implied warranties of merchantability, fitness for a particular ' +
        'purpose, and noninfringement. We do not warrant that playback will be uninterrupted, that ' +
        'any addon will keep working, or that the software is free of defects.'
    ]
  },
  {
    heading: 'Limitation of liability',
    body: [
      'To the fullest extent permitted by law, the Harbor authors and contributors are not liable for ' +
        'any claim, damage, loss of data, lost profit, or other liability arising out of the software ' +
        'or the use of it, whether in an action of contract, tort or otherwise. Where a limitation of ' +
        'this kind is not permitted, our liability is limited to the smallest amount the law allows.'
    ]
  },
  {
    heading: 'License',
    body: [
      'Harbor is open source. The license file that ships with the application governs the source ' +
        'code itself, and nothing written here reduces the rights that license grants you.'
    ]
  },
  {
    heading: 'Accepting these terms',
    body: [
      'Ticking the box below records that you have read these terms and that you accept them. If you ' +
        'do not accept them, close this installer and nothing will be written to your computer.'
    ]
  }
];

const CHECK_GLYPH =
  '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="3" ' +
  'stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M2 5.3 L4 7.4 L8 2.9" pathLength="1" /></svg>';

const AGREE_LABEL = 'I accept the Harbor Terms of Service';
const HINT_OFF = 'Accept the terms to continue.';
const HINT_ON = 'Continue to choose what gets installed.';

const MIN_THUMB = 32;

function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function buildProse() {
  const prose = document.createElement('article');
  prose.className = 'hb-terms-prose';

  const intro = document.createElement('p');
  intro.className = 't-prose';
  intro.textContent = t(INTRO);
  prose.appendChild(intro);

  SECTIONS.forEach((section, i) => {
    const heading = document.createElement('h2');
    heading.className = 't-prose-h';
    heading.textContent = i + 1 + '. ' + t(section.heading);
    prose.appendChild(heading);

    section.body.forEach((copy) => {
      const para = document.createElement('p');
      para.className = 't-prose';
      para.textContent = t(copy);
      prose.appendChild(para);
    });
  });

  return prose;
}

function buildCard() {
  const card = document.createElement('section');
  card.className = 'hb-terms-card';

  const well = document.createElement('div');
  well.className = 'hb-well hb-terms-well';

  const scroll = document.createElement('div');
  scroll.className = 'hb-fade hb-terms-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Harbor terms of service');
  scroll.appendChild(buildProse());
  well.appendChild(scroll);

  const rail = document.createElement('div');
  rail.className = 'hb-rail hb-terms-rail';
  rail.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'hb-rail-thumb';
  rail.appendChild(thumb);

  card.append(well, rail);
  return { card, scroll, rail, thumb };
}

function buildAgree() {
  const agree = document.createElement('div');
  agree.className = 'hb-terms-agree hb-anim-terms-agree';

  const box = document.createElement('button');
  box.type = 'button';
  box.className = 'hb-terms-box';
  box.setAttribute('role', 'checkbox');
  box.setAttribute('aria-checked', 'false');

  const mark = document.createElement('span');
  mark.className = 'hb-check hb-terms-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('aria-checked', 'false');
  mark.innerHTML = CHECK_GLYPH;

  const text = document.createElement('span');
  text.className = 't-body hb-terms-label';
  text.textContent = t(AGREE_LABEL);

  box.append(mark, text);
  agree.appendChild(box);

  const hint = document.createElement('p');
  hint.className = 't-sub hb-terms-hint';

  return { agree, box, mark, hint };
}

export function render(mount, ctx) {
  const { card, scroll, rail, thumb } = buildCard();
  mount.appendChild(card);

  function syncRail() {
    const max = scroll.scrollHeight - scroll.clientHeight;
    rail.hidden = max <= 1;
    if (rail.hidden) return;

    const track = rail.clientHeight;
    const size = Math.max(MIN_THUMB, Math.round(track * (scroll.clientHeight / scroll.scrollHeight)));
    const travel = Math.max(0, track - size);
    const ratio = Math.min(1, Math.max(0, scroll.scrollTop / max));

    thumb.style.height = size + 'px';
    thumb.style.transform = 'translateY(' + (travel * ratio).toFixed(1) + 'px)';
  }

  scroll.addEventListener('scroll', syncRail);

  let observer = null;
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(syncRail);
    observer.observe(scroll.firstElementChild);
  }

  syncRail();

  const { agree, box, mark, hint } = buildAgree();
  const glyph = mark.firstElementChild;
  document.getElementById('hb-consequence').append(agree, hint);

  function setAccepted(value, animate) {
    ctx.setState({ accepted: value });
    box.setAttribute('aria-checked', String(value));
    mark.setAttribute('aria-checked', String(value));
    hint.textContent = value ? t(HINT_ON) : t(HINT_OFF);
    ctx.setFooter({ nextEnabled: value });

    mark.classList.remove('hb-anim-terms-pop');
    glyph.classList.remove('hb-draw');
    if (!animate) return;

    replay(hint, 'hb-anim-terms-hint');
    if (!value) return;

    void mark.offsetWidth;
    mark.classList.add('hb-anim-terms-pop');
    glyph.classList.add('hb-draw');
  }

  box.addEventListener('click', () => setAccepted(!ctx.state.accepted, true));

  const tools = document.createElement('div');
  tools.className = 'hb-terms-tools';

  const picker = document.createElement('div');
  picker.className = 'hb-terms-langs';
  VARIANTS.forEach((variant) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'hb-terms-lang t-btn-mini';
    chip.textContent = variant.label;
    chip.lang = variant.code;
    chip.setAttribute('aria-pressed', String(variant.code === getLocale()));
    chip.addEventListener('click', () => {
      ctx.setState({ lang: variant.code });
      setLocale(variant.code);
    });
    picker.appendChild(chip);
  });

  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'hb-terms-print hb-pill-mini t-btn-mini';
  print.textContent = t('Print');
  print.addEventListener('click', () => {
    printTerms({
      title: t('Terms of service'),
      intro: t(INTRO),
      rtl: isRTL(),
      sections: SECTIONS.map((section) => ({
        heading: t(section.heading),
        paragraphs: section.body.map((copy) => t(copy))
      }))
    });
  });

  tools.append(picker, print);
  mount.appendChild(tools);

  ctx.setFooter({ backLabel: t('Back'), nextLabel: t('Continue') });
  setAccepted(Boolean(ctx.state.accepted), false);

  return function cleanup() {
    if (observer) observer.disconnect();
    observer = null;
  };
}
