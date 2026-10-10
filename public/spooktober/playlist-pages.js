const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

const seconds = value => Math.max(0, Math.round(Number(value) || 0));
const trackTime = value => `${Math.floor(seconds(value) / 60)}:${String(seconds(value) % 60).padStart(2, '0')}`;
const totalTime = value => {
  const minutes = Math.floor(seconds(value) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
};
const searchable = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
const initialized = new WeakMap();
// Original Harbor Illustrator masters, prepared identically to music-glyph.tsx.
const playIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path fill=\"currentColor\" d=\"M7.05,3.45c-0.66-0.41-1.5,0.07-1.5,0.84v15.42c0,0.77,0.84,1.25,1.5,0.84l12.34-7.71 c0.62-0.39,0.62-1.29,0-1.68L7.05,3.45z\"/> </g></svg>";
const pauseIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path fill=\"currentColor\" d=\"M5.45,3.5h2.9c0.5799,0,1.05,0.4701,1.05,1.05v14.9c0,0.5799-0.4701,1.05-1.05,1.05h-2.9 c-0.5799,0-1.05-0.4701-1.05-1.05V4.55C4.4,3.9701,4.8701,3.5,5.45,3.5L5.45,3.5z\"/> <path fill=\"currentColor\" d=\"M15.65,3.5h2.9c0.5799,0,1.05,0.4701,1.05,1.05v14.9c0,0.5799-0.4701,1.05-1.05,1.05 h-2.9c-0.5799,0-1.05-0.4701-1.05-1.05V4.55C14.6,3.9701,15.0701,3.5,15.65,3.5L15.65,3.5z\"/> </g></svg>";
const shuffleIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\" M1.6,5.1h3.2c5.8,0,6.1,13.8,11.6,13.8H18\"/> <path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\" M1.6,18.9h3.2c2.36,0,3.77-2.12,5.02-5.1\"/> <path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\" M13.23,7.76c0.89-1.65,1.89-2.66,3.17-2.66H18\"/> <path fill=\"currentColor\" d=\"M16.75,1.85c-0.51-0.3-0.87,0.13-0.58,0.6c0.69,1.1,1.09,1.98,1.23,2.65c-0.14,0.67-0.54,1.55-1.23,2.65 c-0.29,0.47,0.07,0.9,0.58,0.6l5.37-2.66c0.48-0.24,0.48-0.94,0-1.18L16.75,1.85z\"/> <path fill=\"currentColor\" d=\"M16.75,15.65c-0.51-0.3-0.87,0.13-0.58,0.6c0.69,1.1,1.09,1.98,1.23,2.65c-0.14,0.67-0.54,1.55-1.23,2.65 c-0.29,0.47,0.07,0.9,0.58,0.6l5.37-2.66c0.48-0.24,0.48-0.94,0-1.18L16.75,15.65z\"/> </g></svg>";
const previousIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path fill=\"currentColor\" d=\"M20.92,4.12c0.65-0.43,1.53,0.04,1.53,0.82v14.12c0,0.78-0.88,1.25-1.53,0.82 l-10.7-7.06c-0.59-0.39-0.59-1.25,0-1.64L20.92,4.12z\"/> <path fill=\"currentColor\" d=\"M4.7,3.8H3.4c-0.4971,0-0.9,0.4029-0.9,0.9v14.6c0,0.4971,0.4029,0.9,0.9,0.9h1.3 c0.4971,0,0.9-0.4029,0.9-0.9V4.7C5.6,4.2029,5.1971,3.8,4.7,3.8L4.7,3.8z\"/> </g></svg>";
const nextIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path fill=\"currentColor\" d=\"M3.08,4.12C2.43,3.69,1.55,4.16,1.55,4.94v14.12c0,0.78,0.88,1.25,1.53,0.82l10.7-7.06 c0.59-0.39,0.59-1.25,0-1.64L3.08,4.12z\"/> <path fill=\"currentColor\" d=\"M19.3,3.8h1.3c0.4971,0,0.9,0.4029,0.9,0.9v14.6c0,0.4971-0.4029,0.9-0.9,0.9h-1.3 c-0.4971,0-0.9-0.4029-0.9-0.9V4.7C18.4,4.2029,18.8029,3.8,19.3,3.8L19.3,3.8z\"/> </g></svg>";
const loadingIcon = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><g> <path opacity=\"0.22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\" M12,2.5L12,2.5c5.2467,0,9.5,4.2533,9.5,9.5l0,0c0,5.2467-4.2533,9.5-9.5,9.5l0,0c-5.2467,0-9.5-4.2533-9.5-9.5l0,0 C2.5,6.7533,6.7533,2.5,12,2.5L12,2.5z\"/> <path fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" d=\" M12,2.5c5.25,0,9.5,4.25,9.5,9.5\"/> </g></svg>";

/** Dedicated page content. The parent owns navigation, song opening and saving. */
export function playlistPage(p, saved, mixArt) {
  const songs = Array.isArray(p.songs) ? p.songs : [];
  const theme = ['party', 'dark', 'scores', 'goth'].includes(p.id) ? p.id : 'dark';
  const allSaved = songs.length > 0 && songs.every(song => saved?.has(song.id));
  const length = totalTime(songs.reduce((sum, song) => sum + seconds(song.duration), 0));
  const titleId = `playlist-page-title-${theme}`;

  return `<article class="playlist-page playlist-page--${theme}" aria-labelledby="${titleId}">
    <header class="playlist-page__hero">
      <div class="playlist-page__intro">
        <p class="playlist-page__eyebrow">Spooktober playlist</p>
        <h1 id="${titleId}" tabindex="-1">${escapeHtml(p.title)}</h1>
        <p class="playlist-page__description">${escapeHtml(p.description)}</p>
        <p class="playlist-page__facts"><span>${songs.length} songs</span><span aria-hidden="true">·</span><span>${length}</span></p>
        <div class="playlist-page__actions">
          <button type="button" class="playlist-page__play" data-playlist-play aria-label="Play previews" title="Play previews"${songs.some(song => song.preview) ? '' : ' disabled'}>${playIcon}</button>
          <button type="button" class="playlist-page__shuffle" data-playlist-shuffle aria-pressed="false" aria-label="Shuffle previews" title="Shuffle"${songs.some(song => song.preview) ? '' : ' disabled'}>${shuffleIcon}</button>
          <button type="button" class="playlist-page__save" id="save-playlist"${allSaved || !songs.length ? ' disabled' : ''}>${allSaved ? 'All songs saved' : 'Save all songs'}</button>
        </div>
        <p class="playlist-page__control-caption">Listen to short song previews.</p>
      </div>
      <div class="playlist-page__art" aria-hidden="true">${mixArt(p)}</div>
    </header>

    <section class="playlist-page__music" aria-labelledby="playlist-page-songs-${theme}">
      <div class="playlist-page__toolbar">
        <div class="playlist-page__heading">
          <h2 id="playlist-page-songs-${theme}">Songs</h2>
          <p data-playlist-count role="status" aria-live="polite" aria-atomic="true">${songs.length} songs</p>
        </div>
        <div class="playlist-page__search">
          <label class="playlist-page__sr-only" for="playlist-page-search-${theme}">Search ${escapeHtml(p.title)} by song, artist or album</label>
          <input id="playlist-page-search-${theme}" type="search" data-playlist-search placeholder="Search this playlist" autocomplete="off" spellcheck="false" aria-controls="playlist-page-tracks-${theme}">
          <button type="button" data-playlist-clear hidden>Clear</button>
        </div>
      </div>

      <div class="playlist-page__columns" aria-hidden="true"><span>#</span><span>Title / artist</span><span>Album</span><span>Time</span></div>
      <ol class="playlist-page__tracks" id="playlist-page-tracks-${theme}">
        ${songs.map((song, index) => `<li class="playlist-page__row" data-playlist-row data-playlist-search-text="${escapeHtml(searchable(`${song.title} ${song.creator} ${song.album}`))}">
          <button type="button" class="playlist-page__track-play" data-preview-index="${index}" aria-label="${song.preview ? 'Play preview of' : 'Preview unavailable for'} ${escapeHtml(song.title)} by ${escapeHtml(song.creator)}" aria-pressed="false"${song.preview ? '' : ' disabled'}>${playIcon}</button>
          <button type="button" class="playlist-page__track" data-item="${escapeHtml(song.id)}" title="Open ${escapeHtml(song.title)}">
            <span class="playlist-page__number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            <img class="playlist-page__cover" src="${escapeHtml(song.poster)}" alt="" width="48" height="48" loading="lazy" decoding="async">
            <span class="playlist-page__name"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(song.creator)}</span></span>
            <span class="playlist-page__album">${escapeHtml(song.album)}</span>
            <span class="playlist-page__duration">${trackTime(song.duration)}</span>
          </button>
        </li>`).join('')}
      </ol>
      <div class="playlist-page__empty" data-playlist-empty${songs.length ? ' hidden' : ''}>
        <h3>No songs found</h3><p>Try a different song, artist or album.</p>
      </div>
      <p class="playlist-page__note">Open a song for its full music links.</p>
    </section>
    <aside class="playlist-page__player" data-playlist-player aria-label="Playlist preview player" hidden>
      <img class="playlist-page__player-cover" data-player-cover alt="" width="48" height="48">
      <div class="playlist-page__player-copy"><strong data-player-title></strong><span data-player-artist></span><p data-player-status role="status" aria-live="polite" aria-atomic="true"></p></div>
      <div class="playlist-page__transport">
        <button type="button" data-player-previous aria-label="Previous preview" disabled>${previousIcon}</button>
        <button type="button" class="playlist-page__player-toggle" data-player-toggle aria-label="Play preview">${playIcon}</button>
        <button type="button" data-player-next aria-label="Next preview" disabled>${nextIcon}</button>
      </div>
      <div class="playlist-page__progress"><span data-player-elapsed>0:00</span><input type="range" data-player-seek min="0" max="0" step="0.1" value="0" disabled aria-label="Seek preview"><span data-player-length>0:00</span></div>
      <audio id="playlist-audio" preload="none"></audio>
    </aside>
  </article>`;
}

/** The parent owns navigation/saving. Calling the returned cleanup stops playback. */
export function initPlaylistPage(root, p) {
  const page = root?.matches?.('.playlist-page') ? root : root?.querySelector?.('.playlist-page');
  if (!page) return () => {};
  initialized.get(page)?.();
  const input = page.querySelector('[data-playlist-search]');
  const clear = page.querySelector('[data-playlist-clear]');
  const count = page.querySelector('[data-playlist-count]');
  const empty = page.querySelector('[data-playlist-empty]');
  const rows = [...page.querySelectorAll('[data-playlist-row]')];
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const filter = () => {
    const terms = searchable(input.value).trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const row of rows) {
      row.hidden = !terms.every(term => row.dataset.playlistSearchText.includes(term));
      if (!row.hidden) visible++;
    }
    count.textContent = terms.length ? `${visible} of ${rows.length} songs` : `${rows.length} songs`;
    empty.hidden = visible > 0;
    clear.hidden = input.value.length === 0;
  };
  input.addEventListener('input', filter, options);
  input.addEventListener('search', filter, options);
  clear.addEventListener('click', () => { input.value = ''; filter(); input.focus(); }, options);
  filter();

  const songs = Array.isArray(p?.songs) ? p.songs : [];
  const playable = songs.map((song, index) => song.preview ? index : -1).filter(index => index >= 0);
  const audio = page.querySelector('#playlist-audio');
  const mainPlay = page.querySelector('[data-playlist-play]');
  const shuffle = page.querySelector('[data-playlist-shuffle]');
  const player = page.querySelector('[data-playlist-player]');
  const playerCover = page.querySelector('[data-player-cover]');
  const playerTitle = page.querySelector('[data-player-title]');
  const playerArtist = page.querySelector('[data-player-artist]');
  const status = page.querySelector('[data-player-status]');
  const toggle = page.querySelector('[data-player-toggle]');
  const previous = page.querySelector('[data-player-previous]');
  const next = page.querySelector('[data-player-next]');
  const seek = page.querySelector('[data-player-seek]');
  const elapsed = page.querySelector('[data-player-elapsed]');
  const length = page.querySelector('[data-player-length]');
  const trackButtons = [...page.querySelectorAll('[data-preview-index]')];
  let queue = [...playable], cursor = -1, current = -1, shuffled = false;
  let phase = 'idle', wantsPlay = false, generation = 0, disposed = false;
  const randomOrder = indices => {
    const order = [...indices];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const progress = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    seek.disabled = duration <= 0;
    seek.max = String(duration);
    seek.value = String(Math.min(audio.currentTime || 0, duration));
    seek.setAttribute('aria-valuetext', `${trackTime(audio.currentTime)} of ${trackTime(duration)}`);
    elapsed.textContent = trackTime(audio.currentTime);
    length.textContent = trackTime(duration);
  };
  const render = () => {
    const active = wantsPlay && (phase === 'playing' || phase === 'loading');
    mainPlay.innerHTML = phase === 'loading' ? loadingIcon : active ? pauseIcon : playIcon;
    mainPlay.disabled = !playable.length || phase === 'loading';
    mainPlay.classList.toggle('is-loading', phase === 'loading');
    mainPlay.setAttribute('aria-busy', String(phase === 'loading'));
    mainPlay.setAttribute('aria-label', active ? 'Pause previews' : 'Play previews');
    mainPlay.title = active ? 'Pause previews' : 'Play previews';
    shuffle.disabled = playable.length < 2;
    shuffle.setAttribute('aria-pressed', String(shuffled));
    player.hidden = current < 0;
    page.classList.toggle('playlist-page--has-player', current >= 0);
    toggle.innerHTML = active ? pauseIcon : playIcon;
    toggle.setAttribute('aria-label', active ? 'Pause preview' : 'Play preview');
    previous.disabled = cursor <= 0;
    next.disabled = cursor < 0 || cursor >= queue.length - 1;
    player.classList.toggle('has-error', phase === 'error');
    for (const [index, button] of trackButtons.entries()) {
      const selected = index === current;
      button.innerHTML = selected && active ? pauseIcon : playIcon;
      button.setAttribute('aria-pressed', String(selected && active));
      button.setAttribute('aria-label', `${selected && active ? 'Pause preview of' : songs[index]?.preview ? 'Play preview of' : 'Preview unavailable for'} ${songs[index]?.title ?? ''} by ${songs[index]?.creator ?? ''}`);
      button.disabled = !songs[index]?.preview;
      rows[index]?.classList.toggle('is-current', selected);
      rows[index]?.classList.toggle('is-playing', selected && phase === 'playing');
    }
    if (current >= 0) {
      const song = songs[current];
      if (playerCover.getAttribute('src') !== song.poster) playerCover.src = song.poster;
      playerTitle.textContent = song.title;
      playerArtist.textContent = song.creator;
      const message = { loading:'Loading preview…', playing:'Playing preview', paused:'Preview paused', finished:'Playlist previews finished', error:'Preview unavailable. Press Play to retry, or choose another song.' }[phase] || 'Preview';
      if (status.textContent !== message) status.textContent = message;
    }
  };
  const pause = () => {
    generation++;
    wantsPlay = false;
    audio.pause();
    if (current >= 0) phase = 'paused';
    render();
  };
  const fail = () => {
    if (disposed || !page.isConnected) return;
    wantsPlay = false;
    audio.pause();
    phase = 'error';
    render();
  };
  const start = async (index, reset = true) => {
    if (disposed || !page.isConnected || !songs[index]?.preview) return;
    const request = ++generation;
    const needsSource = current !== index || !audio.getAttribute('src') || phase === 'error';
    if (needsSource || reset) audio.pause();
    current = index;
    cursor = queue.indexOf(index);
    wantsPlay = true;
    phase = 'loading';
    if (needsSource) audio.src = songs[index].preview;
    if (reset) audio.currentTime = 0;
    progress();
    render();
    try {
      await audio.play();
      if (disposed || !page.isConnected) { audio.pause(); return; }
      if (request !== generation || !wantsPlay) return;
      phase = 'playing';
      render();
    } catch (error) {
      if (request !== generation || disposed || !page.isConnected) return;
      fail();
    }
  };
  const playOrPause = () => {
    if (wantsPlay) { pause(); return; }
    if (current < 0 || phase === 'finished') {
      queue = shuffled ? randomOrder(playable) : [...playable];
      start(queue[0]);
    } else start(current, phase === 'error' || audio.ended);
  };
  mainPlay.addEventListener('click', playOrPause, options);
  toggle.addEventListener('click', playOrPause, options);
  shuffle.addEventListener('click', () => {
    shuffled = !shuffled;
    // Preserve queue history and the current preview; reshuffle only upcoming songs.
    const history = cursor >= 0 ? queue.slice(0, cursor + 1) : [];
    const remaining = playable.filter(index => !history.includes(index));
    queue = [...history, ...(shuffled ? randomOrder(remaining) : remaining)];
    render();
  }, options);
  for (const button of trackButtons) button.addEventListener('click', () => {
    const index = Number(button.dataset.previewIndex);
    if (index === current) { playOrPause(); return; }
    queue = shuffled ? [index, ...randomOrder(playable.filter(value => value !== index))] : [...playable];
    start(index);
  }, options);
  previous.addEventListener('click', () => { if (cursor > 0) start(queue[cursor - 1]); }, options);
  next.addEventListener('click', () => { if (cursor < queue.length - 1) start(queue[cursor + 1]); }, options);
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(Number(seek.value), audio.duration);
    progress();
  }, options);
  audio.addEventListener('loadedmetadata', progress, options);
  // Route departure must also cancel an in-flight preview, while keeping cached state reusable.
  audio.addEventListener('spook:pause', pause, options);
  audio.addEventListener('durationchange', progress, options);
  audio.addEventListener('timeupdate', progress, options);
  audio.addEventListener('playing', () => { if (wantsPlay) { phase = 'playing'; render(); } }, options);
  audio.addEventListener('waiting', () => { if (wantsPlay) { phase = 'loading'; render(); } }, options);
  audio.addEventListener('pause', () => {
    // Source changes also emit pause; do not cancel the pending replacement preview.
    if (audio.paused && phase === 'playing' && !audio.ended) { wantsPlay = false; phase = 'paused'; render(); }
  }, options);
  audio.addEventListener('error', fail, options);
  audio.addEventListener('ended', () => {
    if (!wantsPlay || disposed || !page.isConnected) return;
    if (cursor < queue.length - 1) start(queue[cursor + 1]);
    else { wantsPlay = false; phase = 'finished'; render(); }
  }, options);
  render();
  const destroy = () => {
    disposed = true;
    generation++;
    wantsPlay = false;
    controller.abort();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    initialized.delete(page);
  };
  initialized.set(page, destroy);
  return destroy;
}
