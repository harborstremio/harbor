import { t, setLocale } from '../i18n.js';
export const id = 'language';
export const title = 'Choose your language';
export const label = 'Language';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLS = 2;

const LOCALES = [
  { code: 'en', name: 'English', english: 'English', flag: 'assets/flags/flag-eng.svg', rtl: false },
  { code: 'pt', name: 'Português', english: 'Portuguese', flags: ['assets/flags/flag-prt.svg', 'assets/flags/flag-bra.svg'], rtl: false },
  { code: 'ru', name: 'Русский', english: 'Russian', flag: 'assets/flags/flag-rus.svg', rtl: false },
  { code: 'ar', name: 'العربية', english: 'Arabic', flag: 'assets/flags/flag-ara.svg', rtl: true }
];

const STEP = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLS,
  ArrowUp: -COLS
};

function checkGlyph() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('pathLength', '1');
  path.setAttribute('d', 'M2 5.3 L4 7.4 L8 2.9');
  svg.appendChild(path);

  return svg;
}

function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function popCheck(tile) {
  const circle = tile.querySelector('.hb-state');
  const glyph = circle.firstElementChild;
  circle.classList.remove('hb-anim-check-pop');
  glyph.classList.remove('hb-draw');
  void circle.offsetWidth;
  circle.classList.add('hb-anim-check-pop');
  glyph.classList.add('hb-draw');
}

export function render(mount, ctx) {
  const grid = document.createElement('div');
  grid.className = 'hb-lang-grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Language');

  const tiles = LOCALES.map((locale, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'hb-tile t-label hb-anim-tile-in';
    tile.style.setProperty('--i', String(i));
    tile.setAttribute('role', 'radio');
    tile.setAttribute('aria-checked', 'false');
    tile.tabIndex = -1;

    let flag;
    if (locale.flags) {
      flag = document.createElement('span');
      flag.className = 'hb-tile-flag hb-tile-flag-split';
      locale.flags.forEach(function (src) {
        const half = document.createElement('img');
        half.src = src;
        half.alt = '';
        half.draggable = false;
        flag.appendChild(half);
      });
    } else {
      flag = document.createElement('img');
      flag.className = 'hb-tile-flag';
      flag.src = locale.flag;
      flag.alt = '';
      flag.draggable = false;
    }

    const names = document.createElement('span');
    names.className = 'hb-tile-names';

    const endonym = document.createElement('span');
    endonym.className = 'hb-tile-label';
    endonym.lang = locale.code;
    endonym.style.unicodeBidi = 'isolate';
    endonym.textContent = locale.name;

    const english = document.createElement('span');
    english.className = 'hb-tile-english';
    english.textContent = locale.english;

    names.append(endonym, english);

    const circle = document.createElement('span');
    circle.className = 'hb-state';
    circle.appendChild(checkGlyph());

    tile.append(flag, names, circle);
    grid.appendChild(tile);
    return tile;
  });

  mount.appendChild(grid);

  function syncOverflow() {
    grid.classList.remove('hb-lang-scroll', 'hb-fade');
    if (grid.scrollHeight > grid.clientHeight + 1) {
      grid.classList.add('hb-lang-scroll', 'hb-fade');
    }
  }
  const lastTile = tiles[tiles.length - 1];
  if (lastTile) lastTile.addEventListener('animationend', syncOverflow, { once: true });
  window.setTimeout(syncOverflow, 900);

  const consequence = document.getElementById('hb-consequence');
  const line = document.createElement('p');
  line.className = 't-body hb-lang-consequence';

  const langName = document.createElement('span');
  langName.className = 'hb-lang-name';

  function paintConsequence(locale) {
    const parts = t('Harbor will open in {name}.').split('{name}');
    langName.lang = locale.code;
    langName.textContent = locale.name;
    line.replaceChildren(
      document.createTextNode(parts[0] || ''),
      langName,
      document.createTextNode(parts[1] || '')
    );
  }

  consequence.appendChild(line);

  let selected = -1;
  let roving = 0;

  function setRoving(index) {
    roving = index;
    tiles.forEach((tile, i) => {
      tile.tabIndex = i === index ? 0 : -1;
    });
  }

  function select(index, animate) {
    if (index < 0 || index >= tiles.length || index === selected) return;
    if (selected >= 0) tiles[selected].setAttribute('aria-checked', 'false');

    selected = index;
    const locale = LOCALES[index];
    tiles[index].setAttribute('aria-checked', 'true');
    ctx.setState({ lang: locale.code });
    setLocale(locale.code);

    paintConsequence(locale);

    if (!animate) return;
    replay(langName, 'hb-lang-anim-name');
    popCheck(tiles[index]);
  }

  tiles.forEach((tile, i) => {
    tile.addEventListener('click', () => {
      setRoving(i);
      select(i, true);
    });
  });

  grid.addEventListener('focusin', (event) => {
    const i = tiles.indexOf(event.target);
    if (i >= 0 && i !== roving) setRoving(i);
  });

  grid.addEventListener('keydown', (event) => {
    const last = tiles.length - 1;
    let target = -1;

    if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = last;
    } else if (Object.prototype.hasOwnProperty.call(STEP, event.key)) {
      const raw = roving + STEP[event.key];
      target = raw < 0 || raw > last ? (event.key === 'ArrowDown' ? last : roving) : raw;
    }

    if (target < 0) return;
    event.preventDefault();
    setRoving(target);
    tiles[target].focus();
  });

  const start = Math.max(0, LOCALES.findIndex((locale) => locale.code === ctx.state.lang));
  setRoving(start);
  select(start, false);

  ctx.setFooter({
    backLabel: t('Back'),
    nextLabel: t('Continue'),
    nextEnabled: true,
    onBack: null,
    onNext: null
  });
}
