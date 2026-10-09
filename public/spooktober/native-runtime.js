// Generated from the approved Spooktober modules; each mount owns its module state.
const factories={
"app.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { twilightMarkup, initTwilight, spotlightsMarkup } = __require("cult-features.js");
const { mountHorrorPaths } = __require("horror-paths.js");
const { playlistPage, initPlaylistPage } = __require("playlist-pages.js");
const { createPageNavigation } = __require("page-navigation.js");
const { initInlineSurface } = __require("inline-surface.js");
const { setEditorialCollections, editorialMarkup, editorialCollection, collectionDialog } = __require("editorial.js");
const { initBackToTop } = __require("back-to-top.js");
const { mastersMarkup, initMasters, DIRECTORS } = __require("masters.js");
const { setMusicCollections, musicCollections, playlistMarkup, mixArt } = __require("mixtapes.js");
const { playOfficialVideo, stopOfficialVideo } = __require("official-video.js");
const { heroMarkup, shudderShelf, musicWorld, videoDialog, initCinema } = __require("cinema.js");
const { createCatalog } = __require("catalog.js");
const { initSceneLife } = __require("scene-life.js");
const { initHeroDepth } = __require("hero-depth.js");
const { railMarkup, initRails, scrollRail, updateRail } = __require("rails.js");
const { loadFreshReleases } = __require("fresh-releases.js");
const { loadHalloweenNight, isHalloweenNight, HALLOWEEN_NIGHT_SECTION } = __require("halloween-night.js");
const { initShudderArt } = __require("shudder-art.js");
const { mountEncounter } = __require("encounter.js");
const { isHarborEmbedded, initHarborBridge, hostOpenItem, hostOpenPlaylist, notifyHarborReady } = __require("harbor-bridge.js");
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const displayYear = item => item.yearBasis === 'English edition' ? item.year + ' edition' : item.year;
const inlineSurface = initInlineSurface($('#detail'));
const pages = createPageNavigation(() => { $$('#song-audio,#playlist-audio').forEach(audio => { audio.dispatchEvent(new Event('spook:pause')); audio.pause(); }); stopOfficialVideo(); }, () => restorePageRoute());
let restoringRoute = false;
let twilightData = { items: [] }, spotlightData = [];
let songShelf = { songIds: [] }, mangaShelf = null, horrorPaths = null, seriesHighlights = [], expandedShelves = {};
function showFullPage(html, trigger, key, title) { pages.show(html, { key, title, trigger, replace: restoringRoute }); }
const art = name => `/spooktober/assets/art/${name}.svg`;
let screening = { features: [], shudder: [], videos: [] };
let musicUnavailable = false, catalogView, directorContext = null, playlistContext = null, collectionContext = null, dialogFromCatalog = false;
let items = [], saved = new Set(), lastTrigger = null;
try {
    const data = JSON.parse(localStorage.getItem('harbor-spookfest-list') || '[]');
    if (Array.isArray(data))
        saved = new Set(data.filter(x => typeof x === 'string'));
}
catch { }
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let motion = !reduced.matches;
let hostPaused = false;
try {
    motion = !reduced.matches && localStorage.getItem('harbor-spookfest-motion') !== 'off';
}
catch { }
const sectionDefinitions = [
    ['classics', '01', 'THE OLD GROUNDS', 'Halloween classics', 'Essential horror films.'],
    ['new', '02', 'FRESHLY UNEARTHED', 'New & coming soon', '2026 releases.'],
    ['series', '03', 'THE LONG WAY HOME', 'Horror series', 'Find your next series.'],
    ['books', '04', 'THE FORBIDDEN LIBRARY', 'Horror books', 'Your Halloween reading list.'],
    ['manga', '05', 'BEYOND THE VEIL', 'Horror manga', 'Discover horror manga.'],
    ['cozy', '06', 'THE PUMPKIN PATCH', 'Halloween favorites', 'For a lighter Halloween.'],
    ['modern', '07', '', 'Modern horror', 'Contemporary horror.'],
    ['international', '08', '', 'Horror from around the world', 'International films.'],
    ['music', '09', '', 'Halloween songs', 'Listen to song previews.'],
    ['true-crime', '10', '', 'Reality is scarier than fiction', 'True-crime documentaries.'],
    ['anime', '11', '', 'Anime after dark', 'Anime series & films.'],
];
const POSTER_LABELS = { halloween: 'Slasher', shining: 'Psychological', thing: 'Sci-fi horror', psycho: 'Suspense', alien: 'Sci-fi horror', exorcist: 'Possession', dracula: 'Gothic novel', frankenstein: 'Gothic novel', uzumaki: 'Junji Ito', tomie: 'Junji Ito', gyo: 'Junji Ito', coraline: 'Stop-motion', 'hallow-eve': 'Anthology', backrooms: 'Horror', obsession: 'Horror', 'other-mommy': 'Oct 9', tt39143902: 'Horror' };
function malScore(item) { return Number.isInteger(item.malId) && item.malId > 0 && Number.isFinite(item.malRating) && item.malRating > 0 && item.malRating <= 10 ? item.malRating.toFixed(2) : null; }
function cardRatings(item) {
    const imdb = item.imdbRating ? `<span class="media-rating imdb-rating"><img src="/spooktober/assets/services/imdb.svg" alt="IMDb" width="28" height="14"><span>${escape(item.imdbRating)}</span></span>` : '';
    const mal = malScore(item);
    if (!mal)
        return imdb;
    const entry = [item.malTitle || item.title, item.malYear].filter(Boolean).join(' · ');
    const label = `MyAnimeList: ${mal} / 10 — ${entry}`;
    return `<span class="media-ratings">${imdb}<span class="media-rating mal-rating" title="${escape(label + (item.malCheckedAt ? ' · Checked ' + item.malCheckedAt : ''))}"><img src="/spooktober/assets/services/myanimelist.svg" alt="MAL" width="30" height="12"><span>${mal}</span></span></span>`;
}
function card(item, decorated = false) {
    const label = decorated ? (item.shelfLabel || POSTER_LABELS[item.id] || (item.type === 'Music' ? Math.floor(item.duration / 60) + ':' + String(item.duration % 60).padStart(2, '0') : item.type === 'Manga' ? 'Manga' : item.type === 'Book' ? 'Book' : item.release?.includes('In theaters') ? 'In theaters' : item.genres?.[1] || item.genres?.[0] || item.type)) : '';
    const metadata = item.type === 'Music' ? item.creator : ([item.seasonLabel || displayYear(item), (item.runtime && !item.seasonLabel ? item.runtime + (item.type === 'Series' ? ' / ep.' : '') : '') || (item.type === 'Book' || item.type === 'Manga' ? item.creator : item.seasonLabel ? item.seasonYear : item.type)].filter(Boolean).join(' · '));
    return `<button class="media-card ${item.type === 'Music' ? 'music-card' : ''}" data-item="${item.id}" aria-label="View ${escape(item.title)}, ${item.type}, ${item.year}${decorated && malScore(item) ? ', MyAnimeList ' + malScore(item) + ' out of 10 for ' + escape(item.malTitle || item.title) + (item.malYear ? ' ' + escape(item.malYear) : '') : ''}"><span class="poster-mat"><span class="poster-wrap"><img src="${item.poster}" alt="" loading="lazy" width="320" height="480"></span>${label ? `<span class="poster-label ${item.type === 'Music' ? 'label-music' : ''}">${escape(label)}</span>` : ''}</span><span class="media-title">${escape(item.title)}</span><span class="media-meta" title="${escape(metadata)}">${escape(metadata)}</span>${decorated ? cardRatings(item) : ''}</button>`;
}
function shelf(def) {
    const [id, n, kicker, title, description] = def;
    const ordered = expandedShelves[id] || (id === 'music' ? songShelf.songIds : id === 'manga' ? mangaShelf?.collection?.itemIds : id === 'series' ? [...new Set([...seriesHighlights.map(i => i.id), ...items.filter(i => i.section === 'series').map(i => i.id)])] : null);
    const lookup = new Map(items.map(i => [i.id, i]));
    const selected = ordered?.length ? ordered.map(id => lookup.get(id)).filter(Boolean) : items.filter(i => i.section === id);
    if (!selected.length)
        return '';
    const scenery = id === 'new' ? `<div class="shelf-garden" aria-hidden="true"><img class="garden-tree" src="${art('foreground-tree')}" alt=""><img class="garden-ghost" src="${art('ghost-float')}" alt=""><img class="garden-stone-front" src="${art('headstone-ornate')}" alt=""><img class="garden-grass" src="${art('grass-clump')}" alt=""></div>` : id === 'books' ? `<div class="reading-stone" aria-hidden="true"><img src="${art('headstone-cross')}" alt=""><img src="${art('grass-clump')}" alt=""></div>` : '';
    return `<section id="section-${id}" class="shelf scene ${id === 'cozy' ? 'cozy-shelf' : ''}" data-section="${id}" tabindex="-1" aria-labelledby="heading-${id}">
   
   <div class="section-top"><div class="section-heading"><img class="collection-icon" src="/spooktober/assets/icons/${({ classics: 'midnight-film', new: 'candle', series: 'ghost-tv', books: 'haunted-book', manga: 'ink-eye', cozy: 'candy', modern: 'moon', anime: 'anime-spirit', international: 'ink-eye', music: 'haunted-record', 'true-crime': 'case-file', gotham: 'moon' })[id]}.svg" alt=""><div><h2 id="heading-${id}">${title}</h2><p>${id === 'music' ? selected.length + (isHarborEmbedded ? ' songs. Play in Harbor.' : ' songs. Listen to previews.') : id === 'manga' ? selected.length + ' titles to discover.' : id === 'true-crime' ? selected.length + ' documentaries and docuseries.' : id === 'anime' ? selected.length + ' anime series &amp; films.' : description}</p></div></div>${sectionAction(id)}</div></div>
   ${id === 'new' ? '<div class="new-release-layout">' : ''}${railMarkup(selected.map(i => card(i, true)).join(''), title, 'media-row', id === 'new' ? 'garden-rail' : '')}
   ${scenery}${id === 'new' ? '</div>' : ''}
 </section>`;
}
let observer;
function render() {
    observer?.disconnect();
    $('#collections').innerHTML = formatDoorways() + shelf(sectionDefinitions[0]) + shudderShelf(screening, railMarkup) + shelf(sectionDefinitions[1]) + mastersMarkup(railMarkup) + '<div id="editorial-mount"></div>' + shelf(sectionDefinitions[6]) + shelf(sectionDefinitions[10]) + '<div id="spotlight-mount"></div>' + shelf(sectionDefinitions[7]) + '<div id="horror-paths-mount"></div><div id="encounter-mount"></div>' + shelf(sectionDefinitions[5]) + '<div id="twilight-mount"></div>' + shelf(sectionDefinitions[2]) + shelf(sectionDefinitions[9]) + `<div class="reading-pair">${shelf(sectionDefinitions[3])}${shelf(sectionDefinitions[4])}</div>` + musicWorld(screening, railMarkup) + playlistMarkup(items, railMarkup) + shelf(sectionDefinitions[8]) + (isHalloweenNight() ? shelf(HALLOWEEN_NIGHT_SECTION) : '');
    initWatchers();
    initRails();
    initShudderArt();
    initMasters();
    observer = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('offscreen', !e.isIntersecting)), { rootMargin: '100px' });
    $$('.scene').forEach(el => observer.observe(el));
}
function setMotion() { document.body.classList.toggle('motion-off', !motion || document.hidden || hostPaused); }
setMotion();
document.addEventListener('visibilitychange', () => { setMotion(); syncWatchers(); });
reduced.addEventListener('change', () => { motion = !reduced.matches; setMotion(); });
document.addEventListener('click', e => {
    const saveFeature = e.target.closest('[data-feature-save]');
    if (saveFeature) {
        const id = saveFeature.dataset.featureSave;
        saved.has(id) ? saved.delete(id) : saved.add(id);
        persist();
        syncFeatureSaves();
        return;
    }
    const collection = e.target.closest('[data-collection]');
    if (collection) {
        openCollection(collection.dataset.collection, collection);
        return;
    }
    const filter = e.target.closest('[data-collection-filter]');
    if (filter) {
        filterCollection(filter.dataset.collectionFilter);
        return;
    }
    const playlist = e.target.closest('[data-playlist]');
    if (playlist) {
        openPlaylist(playlist.dataset.playlist, playlist);
        return;
    }
    const video = e.target.closest('[data-video]');
    if (video) {
        const v = screening.videos.find(x => x.id === video.dataset.video);
        if (v)
            showFullPage(videoDialog(v), video, 'video/' + v.id, v.title);
        return;
    }
    const load = e.target.closest('[data-load-video]');
    if (load) {
        const v = screening.videos.find(x => x.id === load.dataset.loadVideo);
        if (v)
            playOfficialVideo(v, load);
        return;
    }
    const browse = e.target.closest('[data-browse]');
    if (browse) {
        browseFormat(browse.dataset.browse);
        return;
    }
    const item = e.target.closest('[data-item]');
    if (item) {
        openItem(item.dataset.item, item);
        return;
    }
    const direction = e.target.closest('[data-direction]');
    if (direction) {
        scrollRail($('.rail-track', direction.closest('.harbor-rail')), Number(direction.dataset.direction));
        return;
    }
    const director = e.target.closest('[data-director]');
    if (director)
        openDirector(director.dataset.director, director);
});
document.addEventListener('keydown', e => {
    const cardEl = e.target.closest('.media-card');
    if (cardEl && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        const cards = $$('.media-card', cardEl.parentElement);
        let index = cards.indexOf(cardEl);
        index = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : index + (e.key === 'ArrowRight' ? 1 : -1);
        if (cards[index]) {
            e.preventDefault();
            cards[index].focus({ preventScroll: true });
            __env.scrollIntoView(cards[index], { behavior: motion ? 'smooth' : 'instant', block: 'nearest', inline: 'nearest' });
        }
    }
});
function showDialog(html, trigger) {
    const dialog = $('#detail');
    if (dialog.open && trigger && !dialog.contains(trigger) && trigger !== lastTrigger)
        dialog.close();
    $('#song-audio')?.pause();
    stopOfficialVideo();
    if (!dialog.open) {
        lastTrigger = trigger || document.activeElement;
        dialogFromCatalog = !!lastTrigger?.closest('.gallery-section');
        directorContext = null;
        playlistContext = null;
        collectionContext = null;
    }
    $('#dialog-back').hidden = true;
    $('#dialog-content').innerHTML = html;
    inlineSurface.open(trigger);
    $('.dialog-close').focus({ preventScroll: true });
    dialog.scrollTop = 0;
}
function bindSave(id, button) {
    const paint = () => { button.setAttribute('aria-pressed', String(saved.has(id))); button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${saved.has(id) ? 'm5 12 4 4L19 6' : 'M6 4h12v17l-6-4-6 4Z'}"/></svg><span>${saved.has(id) ? 'Saved for later' : 'Save for later'}</span>`; };
    paint();
    button.onclick = () => { const exists = saved.has(id); exists ? saved.delete(id) : saved.add(id); persist(); paint(); toast(exists ? 'Removed from saved titles.' : 'Saved for later.'); };
}
function openItem(id, trigger) {
    const i = items.find(x => x.id === id);
    if (!i)
        return;
    if (hostOpenItem(i))
        return;
    const parent = $('#detail').open ? directorContext : null;
    const collectionParent = $('#detail').open ? collectionContext : null;
    if (collectionParent)
        collectionParent.scroll = $('#detail').scrollTop;
    if (parent)
        parent.scroll = $('#detail').scrollTop;
    if (i.type === 'Music') {
        openSong(i, trigger);
        return;
    }
    const typeLabel = i.shelfLabel === 'Documentary' ? (i.type === 'Series' ? 'Documentary series' : 'Documentary') : ({ Film: 'Movie', Series: 'Show', Book: 'Book', Manga: 'Manga' }[i.type] || i.type);
    showDialog(`<div class="detail-layout"><div class="detail-art"><img class="detail-poster" src="${i.poster}" alt="${escape(i.title)} cover"></div><div class="detail-copy"><p class="detail-meta">${escape(i.release || [typeLabel, i.seasonLabel, i.seasonYear || displayYear(i), i.seasonLabel ? '' : i.runtime, i.imdbRating ? 'IMDb ' + i.imdbRating : ''].filter(Boolean).join(' · '))}</p><h2 id="dialog-title">${escape(i.title)}</h2>${i.creator ? `<p class="detail-creator">${escape(i.creator)}</p>` : ''}${i.description ? `<p class="description">${escape(i.description)}</p>` : ''}<button id="save-item" class="primary-button save-title"></button>${i.serviceUrl ? `<a class="source-link provider-detail" href="${escape(i.serviceUrl)}" target="_blank" rel="noopener">View on ${escape(i.service)} ↗</a>` : ''}${['dracula', 'frankenstein'].includes(i.id) ? `<a class="source-link" href="https://www.gutenberg.org/ebooks/${i.id === 'dracula' ? '345' : '84'}" target="_blank" rel="noopener">Read at Project Gutenberg ↗</a>` : ''}<a class="source-link" href="${escape(i.source)}" target="_blank" rel="noopener noreferrer">${i.type === 'Book' || i.type === 'Manga' ? 'About this edition' : 'More about this title'} <span aria-hidden="true">↗</span></a></div></div>`, trigger);
    bindSave(id, $('#save-item'));
    if (collectionParent) {
        const back = $('#dialog-back');
        back.hidden = false;
        back.onclick = () => { openCollection(collectionParent.id, collectionParent.trigger, collectionParent.filter); $('#detail').scrollTop = collectionParent.scroll; $('.collection-title-grid [data-item="' + id + '"]')?.focus({ preventScroll: true }); };
    }
    if (parent) {
        const back = $('#dialog-back');
        back.hidden = false;
        back.onclick = () => { openDirector(parent.name, parent.trigger); $('#detail').scrollTop = parent.scroll; const item = $('.list-item[data-item="' + id + '"]'); item?.focus({ preventScroll: true }); };
    }
}
function openDirector(name, trigger) {
    const person = DIRECTORS[name];
    if (!person)
        return;
    const choices = [...new Map(items.filter(i => i.creator === name && i.type === 'Film').map(i => [i.title + '-' + i.year, i])).values()];
    showDialog(`<div class="director-detail"><div class="director-intro"><img src="${person.photo}" alt="${escape(name)}"><div><p class="detail-meta">The masters of horror</p><h2 id="dialog-title">${escape(name)}</h2><p>${person.line}</p><span>${choices.length} films to explore</span></div></div><div class="list-items director-films">${choices.map(i => `<button class="list-item" data-item="${i.id}"><img src="${i.poster}" alt="" loading="lazy"><span class="list-item-text"><strong>${escape(i.title)}</strong><small>${i.year}</small></span></button>`).join('')}</div></div>`, trigger);
    directorContext = { name, trigger, scroll: 0 };
}
function openPlaylist(id, trigger) { const p = musicCollections(items).find(p => p.id === id); if (!p)
    return; if (hostOpenPlaylist(id))
    return; showFullPage(playlistPage(p, saved, mixArt), trigger, 'playlist/' + id, p.title); initPlaylistPage($('#route-root'), p); const button = $('#save-playlist'); button.onclick = () => { p.songs.forEach(i => saved.add(i.id)); persist(); button.textContent = 'All songs saved'; button.disabled = true; }; }
function filterCollection(type) {
    if (collectionContext)
        collectionContext.filter = type;
    $$('[data-collection-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.collectionFilter === type)));
    $$('[data-collection-type]').forEach(el => el.hidden = type !== 'all' && el.dataset.collectionType !== type);
}
function openCollection(id, trigger, filter = 'all') {
    const c = editorialCollection(id, items);
    if (!c)
        return;
    if (!c.entries.length) {
        toast('The collection is still loading. Try again in a moment.');
        return;
    }
    showDialog(collectionDialog(c, card), trigger);
    directorContext = null;
    playlistContext = null;
    collectionContext = { id, trigger, filter, scroll: 0 };
    filterCollection(filter);
}
function syncFeatureSaves() { $$('[data-feature-save]').forEach(b => { const active = saved.has(b.dataset.featureSave); b.setAttribute('aria-pressed', String(active)); $('span', b).textContent = active ? 'Saved' : 'Save'; }); }
function persist() { syncFeatureSaves(); catalogView?.refreshSaved(); try {
    localStorage.setItem('harbor-spookfest-list', JSON.stringify([...saved]));
}
catch {
    toast('Your list is available for this visit.');
} }
$('.dialog-close').onclick = () => $('#detail').close();
$('#detail').addEventListener('close', () => { directorContext = null; playlistContext = null; collectionContext = null; $('#song-audio')?.pause(); stopOfficialVideo(); if (lastTrigger?.isConnected)
    lastTrigger.focus({ preventScroll: true });
else if (dialogFromCatalog && $('#saved-only'))
    $('#saved-only').focus({ preventScroll: true });
else
    $('#about-button').focus({ preventScroll: true }); });
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
$('#about-button').onclick = e => showDialog(`<div class="list-content"><p class="eyebrow">HARBOR SPOOKTOBER</p><h2 id="dialog-title" style="margin-top:16px">About Spooktober</h2><p>${isHarborEmbedded ? 'Explore Halloween films, shows, books, manga and music in Harbor. Films and shows open their Harbor details; songs and playlists use your music player.' : 'A standalone design preview using Harbor’s original vector artwork. The opening 2026 films follow Cinemeta’s horror popularity feed checked September 28, 2026. Seasonal, upcoming and service picks follow; this preview is a dated snapshot. Your list stays in this browser. ' + items.filter(i => i.type === 'Music' && i.preview).length + ' song previews, curated playlists and ' + screening.videos.length + ' official YouTube videos are available; full films and the Harbor library are not connected.'}</p><p style="margin-top:18px">Recent release details checked September 28, 2026. Dates refer to the U.S. release where shown; availability varies by region. Cover art belongs to its respective owners.</p><div class="about-links"><a href="credits.html" target="_blank" rel="noopener">Artwork &amp; sources ↗</a><a href="/spooktober/assets/art/Harbor-Spookfest-Original.svg" target="_blank">Original illustration ↗</a></div></div>`, e.currentTarget);
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => $$('.rail-track').forEach(updateRail), 100); }, { passive: true });
async function init() {
    try {
        const response = await fetch('content.json?v=ec8991e26f');
        if (!response.ok)
            throw Error('content');
        items = await response.json();
        try {
            const songs = await fetch('music.json?v=4cf8c17c53');
            if (!songs.ok)
                throw Error('songs');
            items.push(...await songs.json());
        }
        catch {
            musicUnavailable = true;
        }
        try {
            const r = await fetch('screening.json?v=5c41a4b956');
            if (!r.ok)
                throw Error('screening');
            screening = await r.json();
            for (const i of [...screening.features, ...screening.shudder]) {
                const found = items.find(x => x.id === i.id);
                if (found)
                    Object.assign(found, i, { section: found.section });
                else
                    items.push(i);
            }
            $('#cinema-root').innerHTML = heroMarkup(screening, railMarkup);
        }
        catch {
            $('#cinema-root').innerHTML = '<p class="cinema-error">Featured films couldn’t load. <button id="retry-feature">Try again</button></p>';
            $('#retry-feature').onclick = () => location.reload();
        }
        try {
            const r = await fetch('playlist-data.json?v=7e7943d45e');
            if (r.ok)
                setMusicCollections(await r.json());
        }
        catch { }
        try {
            const r = await fetch('alt-collections.json?v=c8ce825689');
            if (r.ok) {
                const c = await r.json();
                setEditorialCollections(c);
                const known = new Set(items.map(i => i.id));
                for (const i of c.flatMap(c => c.items || [])) {
                    if (!known.has(i.id)) {
                        items.push(i);
                        known.add(i.id);
                    }
                }
            }
        }
        catch { }
        for (const [file, assign] of [['twilight-data.json?v=3fc0f22c45', data => twilightData = data], ['spotlight-data.json?v=5ede2e3c17', data => spotlightData = data]]) {
            try {
                const r = await fetch(file);
                if (!r.ok)
                    continue;
                const data = await r.json();
                assign(data);
                const records = Array.isArray(data) ? data.flatMap(c => c.items || []) : data.items || [];
                for (const i of records) {
                    const existing = items.find(x => x.id === i.id);
                    if (existing)
                        Object.assign(existing, i, { section: existing.section });
                    else
                        items.push(i);
                }
            }
            catch { }
        }
        await loadExpandedShelves();
        try {
            await loadFreshReleases(items, expandedShelves);
        }
        catch { }
        try {
            await loadHalloweenNight(items);
        }
        catch { }
        persist();
        render();
        initHeroDepth();
        initSceneLife();
        initCinema(screening);
        await initCatalog();
        initBackToTop();
        catalogView?.refreshSaved();
        restorePageRoute();
        notifyHarborReady();
    }
    catch {
        $('#collections').innerHTML = '<div class="collection-error"><p>The collection couldn’t load.</p><button class="primary-button" id="retry">Try again</button></div>';
        $('#retry').onclick = init;
    }
}
init();
async function loadExpandedShelves() {
    const results = await Promise.allSettled(['halloween-song-shelf.json?v=d497a9c2d0', 'manga-expanded.json?v=ce72547fad', 'horror-paths.json?v=2cb40c0307', 'series-features.json?v=7b424912e4', 'new-releases-expanded.json?v=63a5ce1cac', 'international-expanded.json?v=289531393b', 'reading-cozy-expanded.json?v=977871a4ca', 'screen-shelves-expanded.json?v=99cceb7688', 'true-crime-expanded.json?v=6ccc45d52c', 'anime-expanded.json?v=465221f3ac'].map(async (file) => { const r = await fetch(file); if (!r.ok)
        throw Error(file); return r.json(); }));
    results.forEach((result, index) => {
        if (result.status !== 'fulfilled')
            return;
        const data = result.value;
        if (index === 0)
            songShelf = data;
        else if (index === 1)
            mangaShelf = data;
        else if (index === 2)
            horrorPaths = data;
        else if (index === 3)
            seriesHighlights = Array.isArray(data) ? data : data.features || [];
        else
            Object.assign(expandedShelves, data.shelves || {});
        for (const item of [...(data.items || []), ...(index === 3 ? seriesHighlights : [])]) {
            const existing = items.find(i => i.id === item.id);
            if (existing)
                Object.assign(existing, item, { section: existing.section });
            else
                items.push(item);
        }
    });
    if (seriesHighlights.length) {
        const keys = new Set(seriesHighlights.map(i => i.imdbId || i.id)), films = screening.features.filter(i => !keys.has(i.imdbId || i.id));
        screening.features = [];
        for (let n = 0; n < Math.max(seriesHighlights.length, films.length); n++) {
            if (seriesHighlights[n])
                screening.features.push(seriesHighlights[n]);
            if (films[n])
                screening.features.push(films[n]);
        }
        $('#cinema-root').innerHTML = heroMarkup(screening, railMarkup);
    }
}
async function initCatalog() {
    try {
        const r = await fetch('catalog.json?v=be6e2e58a4');
        if (!r.ok)
            throw Error('catalog');
        const enriched = new Map(items.map(i => [i.id, i]));
        const catalogItems = (await r.json()).map(i => ({ ...i, ...enriched.get(i.id) }));
        const catalogIds = new Set(catalogItems.map(i => i.id));
        catalogItems.push(...items.filter(i => !catalogIds.has(i.id)));
        const known = new Set(items.map(i => i.id));
        items.push(...catalogItems.filter(i => !known.has(i.id)));
        const editorial = $('#editorial-mount');
        editorial.innerHTML = editorialMarkup(items, card, railMarkup);
        initRails(editorial);
        const twilight = $('#twilight-mount');
        twilight.innerHTML = twilightMarkup(twilightData, card, railMarkup);
        initTwilight();
        initRails(twilight);
        const spotlights = $('#spotlight-mount');
        spotlights.innerHTML = spotlightsMarkup(spotlightData, items, card, railMarkup);
        initRails(spotlights);
        mountHorrorPaths($('#horror-paths-mount'), horrorPaths, items, card);
        mountEncounter($('#encounter-mount'), horrorPaths, items, card);
        catalogView = createCatalog($('#collections'), { items: catalogItems, card, isSaved: id => saved.has(id) });
    }
    catch (error) {
        console.error('Spooktober catalog failed to load:', error);
        $('#collections').insertAdjacentHTML('beforeend', '<section class="gallery-section"><h2>Keep exploring</h2><p class="catalog-status">The extended collection couldn’t load.</p><button id="catalog-retry" class="load-more">Try again</button></section>');
        $('#catalog-retry').onclick = () => { $('.gallery-section').remove(); initCatalog(); };
    }
}
reduced.addEventListener('change', syncWatchers);
function watcher(kind, position) { return `<span class="watcher ${position}" data-watcher="${kind}" aria-hidden="true"><img class="eye-lids" src="/spooktober/assets/art/eyes-${kind}.svg" alt=""></span>`; }
function sectionAction(id) {
    const types = { classics: ['Film', 'Explore films'], series: ['Series', 'Explore shows'], books: ['Book', 'Explore books'], manga: ['Manga', 'Explore manga'], music: ['Music', 'Explore songs'] };
    const choice = types[id];
    return `<div class="section-actions">${choice ? `<button class="section-cta" data-browse="${choice[0]}"><span>${choice[1]}</span></button>` : ''}`;
}
function formatDoorways() {
    const formats = [['classics', 'midnight-film', 'Movies'], ['series', 'ghost-tv', 'Shows'], ['books', 'haunted-book', 'Books'], ['manga', 'ink-eye', 'Manga'], ['music', 'haunted-record', 'Music']];
    return `<section class="discovery-formats" aria-label="Explore Spooktober by format">${formats.map(([id, icon, label]) => `<a class="format-link" href="${id === 'music' ? '#music-world' : '#section-' + id}"><img src="/spooktober/assets/icons/${icon}.svg" alt=""><span>${label}</span></a>`).join('')}</section>`;
}
function browseFormat(type) {
    if (!$('#catalog-type')) {
        toast('The collection is still loading. Try again in a moment.');
        return;
    }
    catalogView.browse(type);
    const heading = $('#catalog-title');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    __env.scrollIntoView(heading, { behavior: motion ? 'smooth' : 'instant', block: 'start' });
}
function openSong(i, trigger) {
    if (hostOpenItem(i))
        return;
    const minutes = Math.floor(i.duration / 60), seconds = String(i.duration % 60).padStart(2, '0');
    showFullPage(`<div class="song-detail"><img class="song-cover" src="${i.poster}" alt="${escape(i.album)} cover"><div class="detail-copy"><p class="detail-meta">Song · ${minutes}:${seconds}</p><h2 id="dialog-title">${escape(i.title)}</h2><p class="song-artist">${escape(i.creator)}</p><p class="song-album">${escape(i.album)}</p>${i.preview ? `<label class="song-preview-label" for="song-audio">Song preview</label><audio id="song-audio" controls preload="none" src="${escape(i.preview)}"></audio><div id="preview-failure" class="preview-failure" hidden><p role="status">This preview couldn’t play.</p><button id="retry-song" class="quiet-button">Try preview again</button></div>` : ''}<button id="save-song" class="primary-button">${saved.has(i.id) ? '✓ In tonight’s list' : '+ Add to tonight’s list'}</button><a class="source-link" href="${escape(i.source)}" target="_blank" rel="noopener noreferrer">Listen on Apple Music ↗</a></div></div>`, trigger, 'song/' + i.id, i.title);
    bindSave(i.id, $('#save-song'));
    $('#save-song').classList.add('save-title');
    const audio = $('#song-audio'), failure = $('#preview-failure');
    if (audio) {
        audio.addEventListener('error', () => failure.hidden = false);
        audio.addEventListener('playing', () => failure.hidden = true);
        $('#retry-song').onclick = () => { failure.hidden = true; audio.load(); audio.play().catch(() => failure.hidden = false); };
    }
}
/* Eye storyboard:
 * On entering view: open eyes appear quietly in the dark.
 * After 3.2–5.8s: close → open over 190ms, then wait 6.1–10.3s.
 * Offscreen / hidden / reduced motion: cancel the timer, hold eyes open.
 * Different offsets keep the three creatures from blinking together.
 */
const EYE_TIMING = { first: 3200, stagger: 1300, blink: 190, rest: 6100, variation: 4200 };
let eyeStates = [], eyeObserver;
function initWatchers() {
    eyeObserver?.disconnect();
    eyeStates.forEach(s => clearTimeout(s.timer));
    eyeStates = $$('[data-watcher]').map((el, index) => ({ el, index, visible: false, timer: 0 }));
    eyeObserver = new IntersectionObserver(entries => { for (const entry of entries) {
        const s = eyeStates.find(s => s.el === entry.target);
        if (!s)
            continue;
        s.visible = entry.isIntersecting;
        scheduleEye(s, true);
    } }, { threshold: .5 });
    eyeStates.forEach(s => eyeObserver.observe(s.el));
}
function scheduleEye(s, first = false) {
    clearTimeout(s.timer);
    s.el.classList.remove('blinking');
    if (!s.visible || !motion || reduced.matches || document.hidden || hostPaused)
        return;
    s.timer = setTimeout(() => {
        s.el.classList.add('blinking');
        s.timer = setTimeout(() => { s.el.classList.remove('blinking'); scheduleEye(s); }, EYE_TIMING.blink);
    }, first ? EYE_TIMING.first + s.index * EYE_TIMING.stagger : EYE_TIMING.rest + Math.random() * EYE_TIMING.variation);
}
function syncWatchers() { eyeStates.forEach(s => scheduleEye(s, true)); }
initHarborBridge({ onVisibilityChange(paused) {
        hostPaused = paused;
        setMotion();
        syncWatchers();
        if (paused) {
            $$('audio,video').forEach(media => { media.dispatchEvent(new Event('spook:pause')); media.pause(); });
            stopOfficialVideo();
        }
    } });
function restorePageRoute() {
    const match = location.hash.match(/^#(playlist|song|video)\/(.+)$/);
    if (!match)
        return;
    restoringRoute = true;
    if (match[1] === 'song') {
        const song = items.find(i => i.id === match[2] && i.type === 'Music');
        if (song)
            openSong(song, null);
    }
    else if (match[1] === 'video') {
        const video = screening.videos.find(i => i.id === match[2]);
        if (video)
            showFullPage(videoDialog(video), null, 'video/' + video.id, video.title);
    }
    else
        openPlaylist(match[2], null);
    restoringRoute = false;
}

Object.assign(__exports,{});
},
"back-to-top.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const JUMP_SECTIONS = [
    ['Movies', '#section-classics', 'midnight-film'],
    ['Shows', '#section-series', 'ghost-tv'],
    ['Books', '#section-books', 'haunted-book'],
    ['Manga', '#section-manga', 'ink-eye'],
    ['Music', '#music-world', 'haunted-record'],
    ['New & coming soon', '#section-new', 'candle'],
    ['Shudder picks', '#section-shudder', 'midnight-film'],
    ['Masters of horror', '#masters-world', 'moon'],
    ['Anime', '#section-anime', 'anime-spirit'],
    ['Playlists', '.playlist-world', 'haunted-record', 'playlist-heading'],
    ['True crime', '#section-true-crime', 'case-file'],
    ['Go deeper', '.horror-paths', 'path-folk-horror', 'horror-paths-heading'],
    ['Aliens & abductions', '#encounter-world', 'moon'],
    ['Filters & search', '.gallery-section', null, 'catalog-title']
];
const FILTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></svg>';
function initBackToTop() {
    if (document.querySelector('.scroll-return'))
        return;
    const dock = document.createElement('div');
    dock.className = 'scroll-return';
    dock.inert = true;
    dock.setAttribute('aria-hidden', 'true');
    dock.innerHTML = `<button type="button" class="back-to-filters" aria-label="Back to filters and search" hidden>${FILTER_ICON}<span>Filters &amp; search</span></button><button type="button" class="jump-trigger" aria-label="Jump to section" aria-haspopup="menu" aria-controls="scroll-jump-menu" aria-expanded="false" title="Jump to section"><span>Jump to</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg></button><button type="button" class="back-to-top" aria-label="Back to top" title="Back to top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button><div class="scroll-jump-menu" id="scroll-jump-menu" role="menu" aria-label="Jump to section" hidden></div>`;
    document.body.append(dock);
    const top = dock.querySelector('.back-to-top'), filters = dock.querySelector('.back-to-filters'), trigger = dock.querySelector('.jump-trigger'), menu = dock.querySelector('.scroll-jump-menu'), reduced = matchMedia('(prefers-reduced-motion:reduce)');
    let frame = 0;
    const behavior = () => reduced.matches || document.body.classList.contains('motion-off') ? 'instant' : 'smooth';
    const menuItems = () => [...menu.querySelectorAll('[role="menuitem"]')];
    function closeMenu(restoreFocus = false) {
        if (menu.hidden)
            return;
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus)
            trigger.focus({ preventScroll: true });
    }
    function openMenu(last = false) {
        menu.innerHTML = JUMP_SECTIONS.map(([label, selector, icon], index) => document.querySelector(selector) ? `${index === 5 ? '<div class="jump-divider" role="separator"></div>' : ''}<button type="button" role="menuitem" tabindex="-1" data-jump="${index}">${icon ? `<img src="/spooktober/assets/icons/${icon}.svg" alt="" width="24" height="24">` : FILTER_ICON}<span>${label.replaceAll('&', '&amp;')}</span></button>` : '').join('');
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const choices = menuItems();
        (last ? choices.at(-1) : choices[0])?.focus({ preventScroll: true });
        menu.scrollTop = last ? menu.scrollHeight : 0;
    }
    function jumpTo(index) {
        const [, selector, , anchor] = JUMP_SECTIONS[index], section = document.querySelector(selector);
        if (!section)
            return;
        closeMenu();
        const heading = [...section.querySelectorAll('h2,h1')].find(el => !el.closest('[inert],[hidden],[aria-hidden="true"]')) || section;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        history.replaceState(history.state, '', location.pathname + location.search + '#' + (anchor || section.id));
        __env.scrollIntoView(section, { behavior: behavior(), block: 'start' });
    }
    function update() {
        frame = 0;
        const toolbar = document.querySelector('.catalog-toolbar'), show = __env.scrollY > Math.min(720, __env.innerHeight * .85) && !document.body.classList.contains('viewing-page') && !document.querySelector('#detail[open]');
        const deepCatalog = !!toolbar && __env.rect(toolbar).bottom < 0;
        if (!show)
            closeMenu();
        if (!deepCatalog && document.activeElement === filters)
            trigger.focus({ preventScroll: true });
        dock.classList.toggle('is-visible', show);
        dock.classList.toggle('has-filters', deepCatalog);
        dock.inert = !show;
        dock.setAttribute('aria-hidden', String(!show));
        filters.hidden = !deepCatalog;
    }
    function queue() { if (!frame)
        frame = requestAnimationFrame(update); }
    document.addEventListener('spook:navigate', () => { closeMenu(); queue(); });
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    const collections = document.querySelector('#collections'), detail = document.querySelector('#detail');
    if (collections)
        new ResizeObserver(queue).observe(collections);
    if (detail)
        new MutationObserver(queue).observe(detail, { attributes: true, attributeFilter: ['open'] });
    new MutationObserver(queue).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    top.addEventListener('click', () => { closeMenu(); const title = document.querySelector('.festival-title h1'); if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
    } history.replaceState(history.state, '', location.pathname + location.search); scrollTo({ top: 0, behavior: behavior() }); });
    filters.addEventListener('click', () => jumpTo(JUMP_SECTIONS.length - 1));
    trigger.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu(true));
    menu.addEventListener('click', event => { const item = event.target.closest('[data-jump]'); if (item)
        jumpTo(Number(item.dataset.jump)); });
    dock.addEventListener('keydown', event => {
        if (event.target === trigger && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp' || event.key === 'End');
            return;
        }
        if (menu.hidden)
            return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeMenu(true);
            return;
        }
        if (event.key === 'Tab') {
            closeMenu(true);
            return;
        }
        if (!menu.contains(event.target))
            return;
        const choices = menuItems(), index = choices.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown')
            next = (index + 1) % choices.length;
        if (event.key === 'ArrowUp')
            next = (index - 1 + choices.length) % choices.length;
        if (event.key === 'Home')
            next = 0;
        if (event.key === 'End')
            next = choices.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            choices[next].focus();
        }
    });
    document.addEventListener('pointerdown', event => { if (!dock.contains(event.target))
        closeMenu(); });
    dock.addEventListener('focusout', event => { if (!dock.contains(event.relatedTarget))
        closeMenu(); });
    update();
}

Object.assign(__exports,{initBackToTop});
},
"catalog.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
// A small local catalog. The main app will supply its own data and UI primitives
// when this standalone design is approved for integration.
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
let opened = null;
function choiceControl(button, options, onChange) {
    let value = options[0].value, active = 0, buffer = '', typingTimer;
    const panel = document.createElement('div');
    panel.className = 'catalog-menu';
    panel.id = button.id + '-options';
    panel.role = 'listbox';
    panel.setAttribute('aria-label', button.getAttribute('aria-label'));
    panel.tabIndex = -1;
    panel.hidden = true;
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panel.id);
    document.body.append(panel);
    function render() {
        const selected = options.find(o => o.value === value);
        button.innerHTML = `<span>${esc(selected.label)}</span>${chevron}`;
        panel.innerHTML = options.map((o, i) => `<div id="${panel.id}-${i}" role="option" aria-selected="${o.value === value}" data-index="${i}" class="catalog-option"><span>${o.icon ? `<img src="/spooktober/assets/icons/${o.icon}.svg" alt="">` : ''}${esc(o.label)}</span>${o.count !== undefined ? `<small>${o.count}</small>` : ''}${check}</div>`).join('');
        highlight();
    }
    function highlight() {
        [...panel.children].forEach((el, i) => el.classList.toggle('highlighted', active === i));
        panel.setAttribute('aria-activedescendant', panel.id + '-' + active);
        if (!panel.hidden)
            __env.scrollIntoView(panel.children[active], { block: 'nearest' });
    }
    function place() {
        if (panel.hidden)
            return;
        const r = __env.rect(button);
        const width = Math.min(__env.innerWidth - 24, Math.max(230, r.width));
        panel.style.width = width + 'px';
        panel.style.left = Math.max(12, Math.min(__env.innerWidth - width - 12, r.left)) + 'px';
        const below = __env.innerHeight - r.bottom - 16, above = r.top - 16;
        const up = below < Math.min(panel.scrollHeight, 300) && above > below;
        panel.style.maxHeight = Math.max(90, Math.min(360, up ? above : below)) + 'px';
        panel.classList.toggle('opens-up', up);
        panel.style.top = (up ? Math.max(12, r.top - panel.offsetHeight - 8) : r.bottom + 8) + 'px';
    }
    function close(restore = false) {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (opened?.panel === panel)
            opened = null;
        buffer = '';
        clearTimeout(typingTimer);
        if (restore)
            button.focus({ preventScroll: true });
    }
    function open() {
        opened?.close();
        active = options.findIndex(o => o.value === value);
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        opened = { panel, button, close, place };
        place();
        highlight();
        panel.focus({ preventScroll: true });
    }
    function select() { value = options[active].value; render(); close(true); onChange(value); }
    button.onclick = () => panel.hidden ? open() : close(true);
    button.onkeydown = e => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        open();
        if (e.key === 'Home')
            active = 0;
        if (e.key === 'End')
            active = options.length - 1;
        highlight();
    } };
    panel.onpointermove = e => { const el = e.target.closest('[data-index]'); if (el) {
        active = Number(el.dataset.index);
        highlight();
    } };
    panel.onclick = e => { const el = e.target.closest('[data-index]'); if (el) {
        active = Number(el.dataset.index);
        select();
    } };
    panel.onkeydown = e => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            active = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            highlight();
        }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close(true);
        }
        else if (e.key === 'Tab') {
            close(true);
        }
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            clearTimeout(typingTimer);
            buffer += e.key.toLowerCase();
            let index = options.findIndex(o => o.label.toLowerCase().startsWith(buffer));
            if (index < 0) {
                buffer = e.key.toLowerCase();
                index = options.findIndex(o => o.label.toLowerCase().startsWith(buffer));
            }
            if (index >= 0) {
                active = index;
                highlight();
            }
            typingTimer = setTimeout(() => buffer = '', 600);
        }
    };
    render();
    return { set(next) { if (options.some(o => o.value === next)) {
            value = next;
            render();
        } }, close };
}
document.addEventListener('pointerdown', e => { if (opened && !opened.panel.contains(e.target) && !opened.button.contains(e.target))
    opened.close(); });
document.addEventListener('focusin', e => { if (opened && !opened.panel.contains(e.target) && !opened.button.contains(e.target))
    opened.close(); });
addEventListener('resize', () => opened?.place());
addEventListener('scroll', () => opened?.place(), { passive: true });
function createCatalog(root, { items, card, isSaved }) {
    let type = 'All', query = '', sort = 'curated', onlySaved = false, offset = 0, searchTimer;
    const formats = [['All', 'Everything', 'moon'], ['Film', 'Movies', 'midnight-film'], ['Series', 'Shows', 'ghost-tv'], ['Book', 'Books', 'haunted-book'], ['Manga', 'Manga', 'ink-eye'], ['Music', 'Music', 'haunted-record']];
    root.insertAdjacentHTML('beforeend', `<section class="gallery-section" aria-labelledby="catalog-title">
  <div class="gallery-heading"><div><h2 id="catalog-title" tabindex="-1">Keep exploring</h2><p id="catalog-count"></p></div>
   <label class="catalog-search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="catalog-search" type="search" placeholder="Search titles or creators" aria-label="Search the horror collection" autocomplete="off"><button type="button" id="clear-search" aria-label="Clear search" hidden>×</button></label></div>
  <div class="catalog-toolbar"><div class="catalog-filters"><button id="catalog-type" class="choice-trigger" aria-label="Media format"></button><button id="saved-only" class="saved-filter" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg>Saved<span id="saved-total"></span></button></div><button id="catalog-sort" class="choice-trigger sort-trigger" aria-label="Sort collection"></button></div>
  <div id="catalog-grid" class="catalog-grid"></div><p id="catalog-status" class="catalog-status" aria-live="polite" aria-atomic="true"></p><button id="load-more" class="load-more">Load more</button>
 </section>`);
    const $ = selector => root.querySelector(selector), grid = $('#catalog-grid'), search = $('#catalog-search'), load = $('#load-more');
    const format = choiceControl($('#catalog-type'), formats.map(([value, label, icon]) => ({ value, label, icon, count: (value === 'All' ? items : items.filter(i => i.type === value)).length })), value => { type = value; draw(true); });
    const order = choiceControl($('#catalog-sort'), [{ value: 'curated', label: 'Collection order' }, { value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'title', label: 'Title A–Z' }], value => { sort = value; draw(true); });
    function matching() {
        const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const terms = normalize(query).split(/\s+/).filter(Boolean);
        const list = items.filter(i => (type === 'All' || i.type === type) && (!onlySaved || isSaved(i.id)) && terms.every(term => normalize(`${i.title} ${i.creator || ''}`).includes(term)));
        if (sort === 'newest' || sort === 'oldest') {
            const direction = sort === 'newest' ? -1 : 1;
            list.sort((a, b) => ((parseInt(a.year) || 0) - (parseInt(b.year) || 0)) * direction);
        }
        else if (sort === 'title')
            list.sort((a, b) => a.title.localeCompare(b.title));
        return list;
    }
    function draw(reset = false) {
        const list = matching();
        if (reset) {
            document.dispatchEvent(new Event('catalog:reset'));
            offset = 0;
            grid.innerHTML = '';
        }
        const batch = list.slice(offset, offset + 24);
        offset += batch.length;
        grid.insertAdjacentHTML('beforeend', batch.map(i => card(i)).join(''));
        if (!list.length) {
            grid.innerHTML = `<div class="catalog-empty"><img src="/spooktober/assets/icons/${onlySaved && !query ? 'haunted-book' : 'ink-eye'}.svg" alt=""><h3>${onlySaved && !query ? 'Your collection starts here' : 'No titles found'}</h3><p>${onlySaved && !query ? 'Open a title and save it for later.' : 'Try a different title, creator, or format.'}</p><button id="reset-catalog" class="quiet-button">${onlySaved ? 'Browse all titles' : 'Clear filters'}</button></div>`;
            $('#reset-catalog').onclick = () => { resetAll(); search.focus({ preventScroll: true }); };
        }
        $('#catalog-count').textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'title' : 'titles'}${onlySaved ? ' saved' : ' to explore'}`;
        $('#catalog-status').textContent = list.length ? `${offset.toLocaleString()} of ${list.length.toLocaleString()}` : 'No matching titles';
        $('#saved-total').textContent = items.filter(i => isSaved(i.id)).length;
        $('#saved-only').setAttribute('aria-pressed', String(onlySaved));
        $('#clear-search').hidden = !search.value;
        load.hidden = offset >= list.length;
    }
    function resetAll() { clearTimeout(searchTimer); type = 'All'; query = ''; onlySaved = false; format.set('All'); search.value = ''; draw(true); }
    search.oninput = () => { clearTimeout(searchTimer); $('#clear-search').hidden = !search.value; searchTimer = setTimeout(() => { query = search.value.trim(); draw(true); }, 180); };
    search.onkeydown = e => { if (e.key === 'Escape' && search.value) {
        e.preventDefault();
        clearSearch();
    } };
    function clearSearch() { clearTimeout(searchTimer); query = ''; search.value = ''; draw(true); search.focus({ preventScroll: true }); }
    $('#clear-search').onclick = clearSearch;
    $('#saved-only').onclick = () => { onlySaved = !onlySaved; draw(true); };
    load.onclick = () => draw();
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && !load.hidden)
        draw(); }, { rootMargin: '250px' });
    observer.observe(load);
    draw();
    return {
        browse(next) { clearTimeout(searchTimer); type = next; query = ''; onlySaved = false; format.set(next); search.value = ''; draw(true); format.close(); order.close(); },
        refreshSaved() { $('#saved-total').textContent = items.filter(i => isSaved(i.id)).length; if (onlySaved)
            draw(true); }
    };
}

Object.assign(__exports,{createCatalog});
},
"cinema.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { revealRailCard } = __require("rails.js");
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rating = value => `<span class="imdb-rating"><img src="/spooktober/assets/services/imdb.svg" alt="IMDb" width="28" height="14"><span>${esc(value)}</span></span>`;
const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>';
const meta = i => [i.seasonLabel, i.seasonYear || i.year, i.seasonLabel ? '' : i.runtime ? i.runtime + (i.type === 'Series' ? ' / ep.' : '') : '', i.genres?.slice(0, 2).join(' / ')].filter(Boolean).join(' · ');
function heroMarkup(data, rail) {
    const selectors = data.features.map((i, n) => `<button data-slide="${n}" class="feature-selector" aria-label="Show ${esc(i.title)}${i.seasonLabel ? ', ' + esc(i.seasonLabel) : ''}" aria-pressed="${n === 0}"><img src="${i.seasonLabel ? i.poster : i.background}" alt="" loading="lazy"><span class="queue-copy"><strong>${esc(i.title)}</strong><small class="queue-facts"><span>${esc(i.seasonLabel || i.service)} · ${esc(i.seasonLabel ? i.service : i.year)}</span><span aria-hidden="true">${esc(i.seasonLabel ? i.featureTag || i.type : i.runtime || i.type)}${i.imdbRating ? ` · ${rating(i.imdbRating)}` : ''}</span></small></span><i aria-hidden="true"></i></button>`).join('');
    return `<div class="cinema-images" aria-hidden="true">${data.features.map((i, n) => `<div class="cinema-image ${n === 0 ? 'is-current' : ''}" data-backdrop="${n}"><img src="${i.background}" alt="" ${n ? 'loading="lazy"' : 'fetchpriority="high"'}></div>`).join('')}</div><div class="film-hero" role="region" aria-roledescription="carousel" aria-label="Spooktober featured titles">
 <div class="feature-slides">${data.features.map((i, n) => `<article class="feature-slide ${n === 0 ? 'is-current' : ''}" data-feature="${n}" aria-hidden="${n !== 0}" ${n ? 'inert' : ''}>
 <div class="cinema-copy"><p class="service-line">${i.serviceLogo ? `<img class="brand-${i.service.toLowerCase().replace(/[^a-z]/g, '')}" src="${i.serviceLogo}" alt="${esc(i.service)}">` : `<span class="service-wordmark service-${i.service.toLowerCase().replace(/[^a-z]/g, '')}">${esc(i.service)}</span>`}${i.featureTag ? `<span>${esc(i.featureTag)}</span>` : ''}</p>
 <h2 class="film-title"><span class="sr-only">${esc(i.title)}</span>${i.logo ? `<img src="${i.logo}" alt="" onerror="this.hidden=true;this.previousElementSibling.className=''" />` : esc(i.title)}</h2>
 <div class="feature-metadata"><span>${esc(meta(i))}</span>${i.imdbRating ? `<span class="hero-imdb">${rating(i.imdbRating)}</span>` : ''}</div><p class="feature-synopsis">${esc(i.description)}</p>
 <div class="film-actions"><button class="primary-button feature-explore" data-item="${i.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>Explore ${i.type === 'Series' ? 'show' : 'film'}</button><button class="feature-save" data-feature-save="${i.id}" aria-label="Save ${esc(i.title)} for later" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg><span>Save</span></button><a class="provider-link" href="${esc(i.serviceUrl)}" target="_blank" rel="noopener">${esc(i.serviceAction || 'View on ' + i.service)}</a></div></div></article>`).join('')}</div>
 <div class="feature-controller"><div class="queue-top"><span>Featured now</span><span class="queue-position">1 / ${data.features.length}</span><button class="rotation-toggle" role="switch" aria-label="Automatically change featured title" aria-checked="true"><span>Auto-advance</span><i aria-hidden="true"></i></button></div><div class="feature-queue">${rail(selectors, 'Featured titles', 'feature-selectors')}</div></div>
 <p class="sr-only" id="feature-status" aria-live="polite"></p></div>`;
}
function shudderShelf(data, rail) {
    return `<section class="shudder-shelf shelf scene" id="section-shudder" aria-labelledby="shudder-title"><div class="shudder-intro"><div><p class="service-heading">Spotlight on <img src="${data.shudderLogo}" alt="Shudder"></p><h2 id="shudder-title">Shudder picks</h2></div><a class="section-cta" href="https://www.shudder.com/" target="_blank" rel="noopener">Explore Shudder</a></div>
 ${rail(data.shudder.map(i => `<button class="media-card landscape-card" data-item="${i.id}" aria-label="View ${esc(i.title)}"><span class="poster-wrap"><img class="landscape-image" src="${i.background}" alt="" loading="lazy"><span class="landscape-shade"></span>${i.backdropHasTitle ? '' : `<img class="landscape-logo" src="${i.logo}" alt="" loading="lazy">`}<span class="art-label">${esc(i.genres?.[1] || 'Horror')}</span></span><span class="media-title">${esc(i.title)}</span><span class="media-meta">${esc(i.year)} · ${esc(i.runtime || 'Movie')}${i.imdbRating ? `<span class="rating-meta">${rating(i.imdbRating)}</span>` : ''}</span></button>`).join(''), 'Shudder picks', 'media-row landscape-row')}
 <p class="availability-note">U.S. collection checked September 28. Availability varies by region.</p></section>`;
}
function musicWorld(data, rail) {
    if (!data.videos.length)
        return '';
    const [lead, ...rest] = data.videos;
    const card = v => `<button class="media-card video-card" data-video="${v.id}" aria-label="Watch ${esc(v.title)}, ${esc(v.artist)}"><span class="poster-wrap"><img src="${v.image}" alt="" loading="lazy"><span class="video-card-play">${play}</span></span><span class="media-title">${esc(v.title)}</span><span class="media-meta">${esc(v.artist)}</span></button>`;
    return `<section id="music-world" class="music-world scene" tabindex="-1" aria-labelledby="music-feature-title"><div class="section-top"><div><p class="feature-label">Music &amp; videos</p><h2 id="music-feature-title">Halloween music videos</h2><p>${data.videos.length} official videos.</p></div></div>
 <div class="video-program"><div class="video-frame"><button class="video-feature" data-video="${lead.id}" aria-label="Watch ${esc(lead.title)}, ${esc(lead.artist)}"><img src="${lead.image}" alt="${esc(lead.artist)} in ${esc(lead.title)}" loading="lazy"><span class="video-scrim"></span><span class="video-type">Official music video</span><span class="video-caption"><span class="video-play">${play}</span><span><strong>${esc(lead.title)}</strong><small>${esc(lead.artist)}</small></span></span></button><div class="video-pumpkins" aria-hidden="true"><img src="/spooktober/assets/art/pumpkin-mischief.svg" alt=""><img src="/spooktober/assets/art/pumpkin-grin.svg" alt=""></div></div>
 <div class="video-side">${rest.slice(0, 2).map(v => `<button class="video-tile" data-video="${v.id}" aria-label="Watch ${esc(v.title)}, ${esc(v.artist)}"><span class="video-picture"><img src="${v.image}" alt="" loading="lazy"><span>${play}</span></span><span class="video-tile-copy"><strong>${esc(v.title)}</strong><span>${esc(v.artist)}</span></span></button>`).join('')}</div></div>
 <div class="video-library"><h3>Keep watching</h3>${rail(rest.slice(2).map(card).join(''), 'Halloween music videos', 'media-row video-row')}</div></section>`;
}
function videoDialog(video) {
    return `<div class="video-detail"><p class="detail-meta">Official artist video · ${esc(video.channel)}</p><h2 id="dialog-title">${esc(video.title)}</h2><p>${esc(video.artist)}</p><div class="video-player"><button class="load-video" data-load-video="${video.id}"><img src="${video.image}" alt=""><span>${play}<strong>Play official video</strong><small>Loads the YouTube player</small></span></button></div><a class="source-link" href="${video.url}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div>`;
}
function initCinema(data) {
    const hero = document.querySelector('.film-hero');
    if (!hero)
        return;
    const stage = document.querySelector('.graveyard-stage'), original = stage?.querySelector('.original-scene');
    if (stage && original && !document.querySelector('.cinema-tree-stage')) {
        const trees = stage.cloneNode(false), scene = original.cloneNode(false);
        trees.className = 'graveyard-stage cinema-tree-stage';
        scene.removeAttribute('id');
        const near = original.querySelector('.near-depth'), layer = near?.cloneNode(false);
        if (layer) {
            layer.removeAttribute('data-depth');
            for (const tree of near.querySelectorAll('.art-foreground-tree')) {
                const copy = tree.cloneNode(true);
                copy.removeAttribute('id');
                copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
                layer.append(copy);
            }
            scene.append(layer);
            trees.append(scene);
            stage.after(trees);
        }
    }
    const slides = [...hero.querySelectorAll('[data-feature]')], buttons = [...hero.querySelectorAll('[data-slide]')], toggle = hero.querySelector('.rotation-toggle'), track = hero.querySelector('.feature-selectors');
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    const ROTATION_DELAY = 10000;
    let index = 0, paused = reduced.matches, visible = true, hovered = false, timer = 0;
    function schedule() {
        clearTimeout(timer);
        const running = !paused && !hovered && visible && !document.hidden && !reduced.matches && !document.querySelector('#detail[open]');
        hero.classList.toggle('rotation-running', running);
        if (running)
            timer = setTimeout(() => select((index + 1) % slides.length), ROTATION_DELAY);
    }
    function select(next, manual = false) {
        index = next;
        slides.forEach((el, n) => { el.classList.toggle('is-current', n === next); el.inert = n !== next; el.setAttribute('aria-hidden', String(n !== next)); });
        buttons.forEach((b, n) => b.setAttribute('aria-pressed', String(n === next)));
        document.querySelectorAll('[data-backdrop]').forEach((el, n) => el.classList.toggle('is-current', n === next));
        hero.querySelector('.queue-position').textContent = (next + 1) + ' / ' + slides.length;
        revealRailCard(buttons[next]);
        if (manual)
            hero.querySelector('#feature-status').textContent = data.features[next].title;
        schedule();
    }
    function paint() { toggle.setAttribute('aria-checked', String(!paused)); schedule(); }
    buttons.forEach((b, n) => b.addEventListener('click', () => { paused = true; select(n, true); paint(); }));
    toggle.addEventListener('click', () => { paused = !paused; paint(); });
    hero.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    hero.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    hero.addEventListener('focusin', event => { if (event.target !== toggle) {
        paused = true;
        paint();
    } });
    document.addEventListener('visibilitychange', schedule);
    document.querySelector('#detail')?.addEventListener('close', schedule);
    new MutationObserver(schedule).observe(document.querySelector('#detail'), { attributes: true, attributeFilter: ['open'] });
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: .25 }).observe(hero);
    reduced.addEventListener('change', () => { if (reduced.matches)
        paused = true; paint(); });
    paint();
}

Object.assign(__exports,{heroMarkup,shudderShelf,musicWorld,videoDialog,initCinema});
},
"cult-features.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { revealRailCard } = __require("rails.js");
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function twilightMarkup(data, card, rail) {
    if (!data?.items?.length)
        return '';
    return `<section id="twilight-world" class="twilight-world scene" aria-labelledby="twilight-heading">
 <div class="twilight-choice">
 <div class="twilight-characters" aria-hidden="true"><div class="twilight-character twilight-edward"></div><div class="twilight-character twilight-jacob"></div></div>
 <div class="twilight-copy"><img class="twilight-wordmark" src="/spooktober/assets/twilight/tt1099212-logo.png" alt="Twilight" loading="lazy" width="180" height="85"><h2 id="twilight-heading">Edward or Jacob?</h2><p>Some debates never die.</p>
 <div class="twilight-teams" role="group" aria-label="Choose your Twilight team">${['Edward', 'Jacob'].map(name => `<button type="button" data-team="${name.toLowerCase()}" aria-pressed="false"><span>Team ${name}</span></button>`).join('')}</div><p class="twilight-status" aria-live="polite">Pick a team. Find your next watch.</p></div></div>
 <div class="twilight-films shelf"><div class="section-top"><h3>The complete saga</h3><div class="twilight-film-action"><span data-saga-order>5 films · In order</span><button type="button" class="section-cta" data-team-explore hidden></button></div></div>${rail(data.items.map(i => card({ ...i, title: i.title.replace('The Twilight Saga: ', '') }, true)).join(''), 'The Twilight Saga', 'media-row twilight-row')}</div></section>`;
}
function initTwilight() {
    const root = document.querySelector('#twilight-world');
    if (!root)
        return;
    let chosen = '';
    try {
        chosen = localStorage.getItem('spooktober-twilight-team') || '';
    }
    catch { }
    const buttons = [...root.querySelectorAll('[data-team]')], cards = [...root.querySelectorAll('.twilight-row .media-card')];
    const picks = { edward: { id: 'tt1099212', title: 'Twilight', note: 'Start with Twilight.' }, jacob: { id: 'tt1259571', title: 'New Moon', note: 'See Jacob’s story in New Moon.' } };
    cards.forEach(card => { const badge = document.createElement('span'); badge.className = 'twilight-pick'; badge.setAttribute('aria-hidden', 'true'); badge.textContent = 'Start here'; card.querySelector('.poster-wrap').append(badge); });
    let active = '';
    function paint(team, announce = false) {
        if (!['edward', 'jacob'].includes(team))
            return;
        const changed = active !== team;
        active = team;
        root.dataset.team = team;
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.team === team)));
        const pick = picks[team];
        const status = root.querySelector('.twilight-status');
        status.textContent = pick.note;
        const action = root.querySelector('[data-team-explore]');
        action.hidden = false;
        action.dataset.item = pick.id;
        action.textContent = 'Explore ' + pick.title;
        root.querySelector('[data-saga-order]').hidden = true;
        cards.forEach(card => { const selected = card.dataset.item === pick.id; card.classList.toggle('is-team-pick', selected); const label = card.getAttribute('aria-label').replace(/, Start here$/, ''); card.setAttribute('aria-label', label + (selected ? ', Start here' : '')); });
        if (announce && changed && !matchMedia('(prefers-reduced-motion:reduce)').matches && !document.body.classList.contains('motion-off')) {
            status.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' });
        }
        if (announce) {
            const card = cards.find(c => c.dataset.item === pick.id);
            if (card)
                revealRailCard(card);
        }
        if (announce)
            try {
                localStorage.setItem('spooktober-twilight-team', team);
            }
            catch { }
    }
    buttons.forEach(b => b.addEventListener('click', () => paint(b.dataset.team, true)));
    paint(chosen);
}
function spotlightsMarkup(collections, items, card, rail) {
    const lookup = new Map(items.map(i => [i.id, i]));
    return collections.map(c => { const entries = c.itemIds.map(id => lookup.get(id)).filter(Boolean); return `<section id="spotlight-${esc(c.id)}" class="spotlight-shelf editorial-shelf scene" aria-labelledby="spotlight-${esc(c.id)}-heading"><div class="editorial-intro"><img class="editorial-backdrop" src="${esc(c.background)}" alt="" loading="lazy"><div class="editorial-intro-copy"><span class="spotlight-role">${c.id === 'zombie' ? 'Directed by' : 'Starring'}</span><h2 id="spotlight-${esc(c.id)}-heading">${esc(c.name)}</h2><p>${esc(c.description)}</p><span class="spotlight-count">${entries.length} films</span></div></div>${rail(entries.map(i => card(i, true)).join(''), c.name + ' films', 'media-row editorial-row')}</section>`; }).join('');
}

Object.assign(__exports,{twilightMarkup,initTwilight,spotlightsMarkup});
},
"editorial.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let collections = [];
function setEditorialCollections(data) { collections = Array.isArray(data) ? data : []; }
function editorialCollection(id, items) { const c = collections.find(c => c.id === id); if (!c)
    return null; const byId = new Map(items.map(i => [i.id, i])); return { ...c, entries: c.itemIds.map(id => byId.get(id)).filter(Boolean) }; }
function editorialMarkup(items, card, rail) {
    if (!collections.length)
        return '';
    return `<div class="editorial-world" aria-labelledby="editorial-heading"><div class="section-top editorial-heading"><h2 id="editorial-heading">Find your kind of horror</h2></div>${collections.map(collection => { const c = editorialCollection(collection.id, items); return `<section class="editorial-shelf scene editorial-${esc(c.id)}" aria-labelledby="collection-${c.id}-heading"><div class="editorial-intro"><img class="editorial-backdrop" src="${esc(c.background)}" alt="" loading="lazy"><div class="editorial-intro-copy"><span class="editorial-count">${c.itemIds.length} titles</span><h3 id="collection-${c.id}-heading">${esc(c.title)}</h3><p>${esc(c.description)}</p><button class="section-cta" data-collection="${esc(c.id)}" aria-label="Explore ${esc(c.title)}, ${c.itemIds.length} titles">Explore collection</button></div></div>${rail(c.entries.map(i => card(i, true)).join(''), c.title, 'media-row editorial-row')}</section>`; }).join('')}</div>`;
}
function collectionDialog(c, card) {
    const groups = [...new Set(c.entries.map(i => i.type))];
    const labels = { Film: 'Films', Series: 'Shows', Book: 'Books', Manga: 'Manga' };
    return `<div class="editorial-detail"><div class="editorial-detail-heading"><p class="detail-meta">Spooktober collection · ${c.entries.length} titles</p><h2 id="dialog-title">${esc(c.title)}</h2><p>${esc(c.description)}</p></div>${groups.length > 1 ? `<div class="collection-filters" aria-label="Filter collection"><button class="quiet-button" data-collection-filter="all" aria-pressed="true">All</button>${groups.map(type => `<button class="quiet-button" data-collection-filter="${type}" aria-pressed="false">${labels[type] || type}</button>`).join('')}</div>` : ''}<div class="collection-title-grid">${c.entries.map(i => `<div data-collection-type="${i.type}">${card(i, true)}</div>`).join('')}</div></div>`;
}

Object.assign(__exports,{setEditorialCollections,editorialCollection,editorialMarkup,collectionDialog});
},
"encounter.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { railMarkup, initRails } = __require("rails.js");
const encounterCleanups = new WeakMap();
function mountEncounter(root, data, items, card) {
    encounterCleanups.get(root)?.();
    const collection = data?.collections?.find(c => c.id === 'aliens-abductions');
    if (!collection)
        return;
    const lookup = new Map(items.map(i => [i.id, i])), records = collection.itemIds.map(id => lookup.get(id)).filter(Boolean);
    const staticLights = ['m43 60 9 2', 'm75 65 12 1', 'm110 66 12-1', 'm140 66 9-3'];
    root.innerHTML = `<section id="encounter-world" class="shelf encounter-world scene" aria-labelledby="encounter-heading">
 <div class="encounter-field" aria-hidden="true"><div class="encounter-mist"></div><div class="encounter-hill far"></div><div class="encounter-hill near"></div><img class="encounter-tree" src="/spooktober/assets/art/foreground-tree.svg" alt="" loading="lazy"><img class="encounter-grass grass-left" src="/spooktober/assets/art/grass-clump.svg" alt="" loading="lazy"><img class="encounter-grass grass-right" src="/spooktober/assets/art/grass-clump.svg" alt="" loading="lazy"></div>
 <div class="encounter-craft" aria-hidden="true"><div class="encounter-beam"></div><svg viewBox="0 0 200 84"><defs><clipPath id="encounter-rim-clip"><path d="m8 45 60 13 78-2 45-3-45 20-85-3Z"/></clipPath></defs><path d="M62 38 74 15 93 6 119 12 135 38Z" fill="#81958e"/><path d="m93 6 4 32h38l-16-26Z" fill="#4b6260"/><path d="m8 45 46-13 86 2 51 19-45 20-85-3Z" fill="#62716f"/><path d="m8 45 60 13 78-2 45-3-45 20-85-3Z" fill="#29383b"/><g class="encounter-rim-lights" clip-path="url(#encounter-rim-clip)" fill="none" stroke="#d4dec1" stroke-width="3">${Array.from({ length: 8 }, (_, i) => `<path data-rim-light d="${staticLights[i] || 'M0 0'}"${i > 3 ? ' visibility="hidden"' : ''}/>`).join('')}</g><path d="m21 46 44 6 84-2 27 2-29 9-80 1Z" fill="#aeb7a0"/><path d="m61 70 85 3-22 9-40-2Z" fill="#1c282a"/></svg></div>
 <div class="section-top"><div><h2 id="encounter-heading">Aliens &amp; abductions</h2><p>Something is out there.</p></div></div>
 ${railMarkup(records.map(i => card(i, true)).join(''), 'Aliens & abductions', 'media-row')}
 </section>`;
    initRails(root);
    const section = root.querySelector('.encounter-world'), reduced = matchMedia('(prefers-reduced-motion:reduce)');
    const craft = section.querySelector('.encounter-craft'), lights = [...section.querySelectorAll('[data-rim-light]')];
    let frame = 0, visible = false, orbitFrame = 0, craftVisible = false, lastTick = 0, phase = 0, disposed = false;
    const motionDisabled = () => reduced.matches || document.body.classList.contains('motion-off');
    function staticRim() { lights.forEach((light, i) => { light.setAttribute('d', staticLights[i] || 'M0 0'); light.setAttribute('visibility', i < 4 ? 'visible' : 'hidden'); light.removeAttribute('opacity'); light.removeAttribute('stroke-width'); }); }
    function stopOrbit() { cancelAnimationFrame(orbitFrame); orbitFrame = 0; lastTick = 0; }
    // Project equally spaced lamps onto the existing underside; the top rim occludes them.
    // This loop only writes SVG attributes. Scroll-driven layout reads stay in paint().
    function orbit(now) {
        orbitFrame = 0;
        if (!section.isConnected) {
            cleanup();
            return;
        }
        if (!craftVisible || document.hidden || motionDisabled()) {
            lastTick = 0;
            return;
        }
        if (lastTick)
            phase = (phase + Math.min(now - lastTick, 64) * Math.PI * 2 / 7200) % (Math.PI * 2);
        lastTick = now;
        const point = a => { const x = 96 + 68 * Math.cos(a); return [x, 54 + 13 * Math.sin(a) + (x - 96) * .045]; };
        lights.forEach((light, i) => {
            const angle = phase + Math.PI / 8 + i * Math.PI / 4, depth = Math.sin(angle);
            // Rear lamps are behind the hull. Foreshortening and a short edge fade carry depth.
            if (depth <= 0) {
                light.setAttribute('visibility', 'hidden');
                return;
            }
            const half = .086 * (.82 + .18 * depth), a = point(angle - half), b = point(angle + half), edge = Math.min(1, depth / .18);
            light.setAttribute('d', `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`);
            light.setAttribute('stroke-width', (2.3 + .7 * depth).toFixed(2));
            light.setAttribute('opacity', ((.72 + .28 * depth) * edge * edge * (3 - 2 * edge)).toFixed(3));
            light.setAttribute('visibility', 'visible');
        });
        orbitFrame = requestAnimationFrame(orbit);
    }
    function paint() { frame = 0; if (!visible)
        return; const disabled = reduced.matches || document.body.classList.contains('motion-off'), rect = __env.rect(section); const p = disabled ? .7 : Math.max(0, Math.min(1, (__env.innerHeight - rect.top) / (__env.innerHeight + rect.height * .3))); section.style.setProperty('--craft-x', ((p - .6) * 240).toFixed(1) + 'px'); section.style.setProperty('--craft-y', (-Math.sin(p * Math.PI) * 8).toFixed(1) + 'px'); section.style.setProperty('--beam-opacity', disabled ? '.3' : String(Math.min(.4, Math.max(0, (p - .2) * .65)))); section.classList.add('encounter-ready'); }
    const schedule = () => { if (!disposed && visible && !document.hidden && !frame)
        frame = requestAnimationFrame(paint); };
    function syncMotion() {
        if (disposed)
            return;
        if (!section.isConnected) {
            cleanup();
            return;
        }
        if (document.hidden || !craftVisible || motionDisabled()) {
            stopOrbit();
            if (document.hidden) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
            if (motionDisabled())
                staticRim();
        }
        else if (!orbitFrame)
            orbitFrame = requestAnimationFrame(orbit);
        schedule();
    }
    const sectionObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!section.isConnected) {
        cleanup();
        return;
    } schedule(); }, { rootMargin: '100px' });
    const craftObserver = new IntersectionObserver(entries => { craftVisible = entries[0].isIntersecting; syncMotion(); });
    const motionObserver = new MutationObserver(syncMotion);
    function cleanup() {
        if (disposed)
            return;
        disposed = true;
        cancelAnimationFrame(frame);
        stopOrbit();
        sectionObserver.disconnect();
        craftObserver.disconnect();
        motionObserver.disconnect();
        removeEventListener('scroll', schedule);
        removeEventListener('resize', schedule);
        reduced.removeEventListener('change', syncMotion);
        document.removeEventListener('visibilitychange', syncMotion);
        encounterCleanups.delete(root);
    }
    sectionObserver.observe(section);
    craftObserver.observe(craft);
    motionObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    reduced.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    encounterCleanups.set(root, cleanup);
    syncMotion();
}

Object.assign(__exports,{mountEncounter});
},
"fresh-releases.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
// Studios keep shipping horror through October, so the shelf asks Cinemeta for what
// landed since the bundled snapshot instead of staying frozen at build time.
const CINEMETA = 'https://v3-cinemeta.strem.io/catalog';
const FEEDS = [['movie', 'catalog', 'Film'], ['series', 'series', 'Series']];
const CACHE_KEY = 'spooktober.fresh.v1';
const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_PER_FEED = 14;
function posterFor(id) { return `https://images.metahub.space/poster/medium/${id}/img`; }
function toItem(meta, section, type) {
    const id = typeof meta?.imdb_id === 'string' && meta.imdb_id ? meta.imdb_id : meta?.id;
    if (typeof id !== 'string' || !/^tt\d{6,}$/.test(id))
        return null;
    const title = typeof meta.name === 'string' ? meta.name.trim() : '';
    if (!title)
        return null;
    const year = String(meta.releaseInfo ?? meta.year ?? '').slice(0, 4);
    if (!/^\d{4}$/.test(year))
        return null;
    return {
        id, title, type, section, year,
        poster: typeof meta.poster === 'string' && meta.poster ? meta.poster.replace('/poster/small/', '/poster/medium/') : posterFor(id),
        description: typeof meta.description === 'string' ? meta.description : '',
        genres: Array.isArray(meta.genres) ? meta.genres.filter(g => typeof g === 'string') : [],
        creator: typeof meta.director === 'string' ? meta.director : Array.isArray(meta.director) ? meta.director.join(', ') : '',
        source: `https://www.imdb.com/title/${id}/`,
        fresh: true,
    };
}
function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw)
            return null;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved.at !== 'number' || Date.now() - saved.at > CACHE_MS)
            return null;
        return Array.isArray(saved.items) ? saved.items : null;
    }
    catch {
        return null;
    }
}
function writeCache(list) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items: list }));
    }
    catch { }
}
async function feed(kind, section, type, earliest) {
    const response = await fetch(`${CINEMETA}/${kind}/top/genre=Horror.json`, { cache: 'no-cache' });
    if (!response.ok)
        throw Error(kind);
    const metas = (await response.json())?.metas;
    if (!Array.isArray(metas))
        return [];
    const out = [];
    for (const meta of metas) {
        const item = toItem(meta, section, type);
        if (item && Number(item.year) >= earliest)
            out.push(item);
        if (out.length >= MAX_PER_FEED)
            break;
    }
    return out;
}
/** Adds anything newer than the bundled data to the front of New & coming soon. */
async function loadFreshReleases(items, expandedShelves) {
    const earliest = new Date().getFullYear() - 1;
    let fresh = readCache();
    if (!fresh) {
        const settled = await Promise.allSettled(FEEDS.map(([kind, section, type]) => feed(kind, section, type, earliest)));
        fresh = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        if (!fresh.length)
            return 0;
        writeCache(fresh);
    }
    const known = new Map(items.map(item => [item.id, item]));
    const added = [];
    for (const item of fresh) {
        const existing = known.get(item.id);
        if (existing) {
            if (!existing.poster)
                existing.poster = item.poster;
            continue;
        }
        known.set(item.id, item);
        items.push(item);
        added.push(item.id);
    }
    if (!added.length)
        return 0;
    const ordered = Array.isArray(expandedShelves.new) ? expandedShelves.new : [];
    expandedShelves.new = [...added, ...ordered.filter(id => !added.includes(id))];
    return added.length;
}

Object.assign(__exports,{loadFreshReleases});
},
"halloween-night.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
// Devil's Night belongs to Gotham. This shelf exists on October 31 and no other day.
const CINEMETA = 'https://v3-cinemeta.strem.io/meta/movie';
const GOTHAM = ['tt14324650', 'tt14402926', 'tt0106364'];
const SECTION = 'gotham';
const HALLOWEEN_NIGHT_SECTION = [SECTION, '**', 'DEVIL’S NIGHT', 'Halloween night in Gotham', 'Only tonight.'];
function isHalloweenNight(date = new Date()) {
    return date.getMonth() === 9 && date.getDate() === 31;
}
function toItem(meta) {
    const id = typeof meta?.imdb_id === 'string' && meta.imdb_id ? meta.imdb_id : meta?.id;
    if (typeof id !== 'string' || !/^tt\d{6,}$/.test(id))
        return null;
    const title = typeof meta.name === 'string' ? meta.name.trim() : '';
    if (!title)
        return null;
    return {
        id, title, type: 'Film', section: SECTION,
        year: String(meta.releaseInfo ?? meta.year ?? '').slice(0, 4),
        poster: typeof meta.poster === 'string' && meta.poster ? meta.poster.replace('/poster/small/', '/poster/medium/') : `https://images.metahub.space/poster/medium/${id}/img`,
        description: typeof meta.description === 'string' ? meta.description : '',
        genres: Array.isArray(meta.genres) ? meta.genres.filter(g => typeof g === 'string') : [],
        creator: typeof meta.director === 'string' ? meta.director : Array.isArray(meta.director) ? meta.director.join(', ') : '',
        runtime: typeof meta.runtime === 'string' ? meta.runtime : '',
        source: `https://www.imdb.com/title/${id}/`,
        shelfLabel: 'Halloween night',
    };
}
/** Returns how many Gotham films joined the catalogue; zero on any night but the 31st. */
async function loadHalloweenNight(items, date = new Date()) {
    if (!isHalloweenNight(date))
        return 0;
    const known = new Set(items.map(item => item.id));
    const settled = await Promise.allSettled(GOTHAM.filter(id => !known.has(id)).map(async (id) => {
        const response = await fetch(`${CINEMETA}/${id}.json`, { cache: 'no-cache' });
        if (!response.ok)
            throw Error(id);
        return toItem((await response.json())?.meta);
    }));
    let added = 0;
    for (const result of settled) {
        if (result.status !== 'fulfilled' || !result.value)
            continue;
        items.push(result.value);
        added += 1;
    }
    return added;
}

Object.assign(__exports,{HALLOWEEN_NIGHT_SECTION,isHalloweenNight,loadHalloweenNight});
},
"harbor-bridge.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const CHANNEL = 'harbor-spooktober';
const isHarborEmbedded = true;
function send(intent, payload = {}) { window.__spookIntent({ channel: CHANNEL, intent, ...payload }); return true; }
function hostItem(item) {
    const result = {};
    for (const key of ['id', 'imdbId', 'title', 'type', 'year', 'creator', 'album', 'duration', 'description', 'runtime', 'imdbRating', 'seasonLabel', 'seasonYear']) {
        const value = item[key];
        if (typeof value === 'string' || typeof value === 'number')
            result[key] = value;
    }
    if (Array.isArray(item.genres))
        result.genres = item.genres.filter(value => typeof value === 'string');
    if (typeof item.explicit === 'boolean')
        result.explicit = item.explicit;
    for (const key of ['poster', 'source', 'preview', 'serviceUrl'])
        if (typeof item[key] === 'string')
            result[key] = new URL(item[key], location.href).href;
    if (result.poster)
        result.image = result.poster;
    result.imdbId = [result.imdbId, result.source?.match(/imdb\.com\/title\/(tt\d+)(?:\/|$|\?)/)?.[1], result.id].find(value => typeof value === 'string' && /^tt\d+$/.test(value));
    return result;
}
function hostOpenItem(item) {
    const intent = { Film: 'meta', Series: 'meta', Music: 'track' }[item?.type];
    if (!intent)
        return false;
    const metadata = hostItem(item);
    if (intent === 'meta' && !metadata.imdbId)
        return false;
    return send(intent, { item: metadata });
}
function hostOpenVideo(video) { if (!video || typeof video.id !== 'string' || !/^[\w-]{11}$/.test(video.id))
    return false; return send('video', { item: { id: video.id, title: String(video.title || ''), artist: String(video.artist || ''), image: typeof video.image === 'string' ? new URL(video.image, location.href).href : '' } }); }
function hostOpenPlaylist(id) { return typeof id === 'string' && send('playlist', { id }); }
function notifyHarborReady() { return send('ready'); }
function initHarborBridge({ onVisibilityChange } = {}) {
    document.body.classList.add('harbor-native');
    document.addEventListener('visibilitychange', () => onVisibilityChange?.(document.hidden));
    function external(event) {
        if (event.type === 'auxclick' && event.button !== 1)
            return;
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || event.defaultPrevented)
            return;
        const raw = anchor.getAttribute('href');
        if (!raw)
            return;
        if (raw.startsWith('#')) {
            const target = document.querySelector(raw);
            if (target) {
                event.preventDefault();
                __env.scrollIntoView(target, { behavior: document.body.classList.contains('motion-off') ? 'instant' : 'smooth', block: 'start' });
                target.focus?.({ preventScroll: true });
            }
            return;
        }
        let url;
        try {
            url = new URL(raw, location.href);
        }
        catch {
            return;
        }
        if (!['http:', 'https:', 'tauri:'].includes(url.protocol))
            return;
        event.preventDefault();
        event.stopPropagation();
        send('external', { url: url.href });
    }
    document.addEventListener('click', external, true);
    document.addEventListener('auxclick', external, true);
    document.addEventListener('keydown', event => {
        if (event.defaultPrevented || !(event.key === 'Escape' || event.altKey && event.key === 'ArrowLeft'))
            return;
        event.preventDefault();
        event.stopPropagation();
        if (!window.__spookBack())
            send('back');
    });
}

Object.assign(__exports,{isHarborEmbedded,hostOpenItem,hostOpenVideo,hostOpenPlaylist,notifyHarborReady,initHarborBridge});
},
"hero-depth.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
/* SCROLL STORYBOARD
 * Enter: retain the original hero composition.
 * Scroll: distant scenery lingers and the film gently pushes in; foreground props stay anchored.
 * Settle: an 85ms response softens wheel steps without changing native scrolling.
 * Reverse: retrace the same depth; offscreen/hidden/reduced motion stops the loop.
 */
const DEPTH = { response: 85, settle: .35, film: .22, zoom: .055, scenery: 1.7, copy: -.025, title: .055, mobile: .55 };
let dispose;
function initHeroDepth() {
    dispose?.();
    const hero = document.querySelector('.hero');
    if (!hero)
        return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const layers = [...hero.querySelectorAll('[data-depth]')].map(el => ({ el, depth: Number(el.dataset.depth) * DEPTH.scenery }));
    let frame = 0, lastTime = 0, current = 0, height = hero.offsetHeight, top = __env.rect(hero).top + __env.scrollY, visible = false;
    const enabled = () => !reduced.matches && !document.hidden && !document.body.classList.contains('motion-off') && !document.body.classList.contains('viewing-page');
    const target = () => Math.max(0, Math.min(height, __env.scrollY - top));
    const stop = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
    function paint(value) {
        const travel = value * (__env.innerWidth <= 750 ? DEPTH.mobile : 1), progress = height ? value / height : 0;
        for (const { el, depth } of layers)
            el.style.transform = `translate3d(0,${(travel * depth).toFixed(2)}px,0)`;
        hero.style.setProperty('--hero-film-y', (travel * DEPTH.film).toFixed(2) + 'px');
        hero.style.setProperty('--hero-film-scale', (1 + progress * DEPTH.zoom * (__env.innerWidth <= 750 ? DEPTH.mobile : 1)).toFixed(5));
        hero.style.setProperty('--hero-copy-y', (travel * DEPTH.copy).toFixed(2) + 'px');
        hero.style.setProperty('--hero-title-y', (travel * DEPTH.title).toFixed(2) + 'px');
    }
    function update(now) {
        frame = 0;
        if (!enabled() || !visible) {
            reset();
            return;
        }
        const next = target(), dt = lastTime ? Math.min(64, now - lastTime) : 1000 / 60;
        lastTime = now;
        current += (next - current) * (1 - Math.exp(-dt / DEPTH.response));
        if (Math.abs(next - current) <= DEPTH.settle) {
            current = next;
            lastTime = 0;
        }
        paint(current);
        if (current !== next)
            frame = requestAnimationFrame(update);
    }
    function request() { if (visible && enabled() && !frame)
        frame = requestAnimationFrame(update); }
    function reset() {
        stop();
        const active = visible && enabled();
        hero.classList.toggle('depth-active', active);
        current = active ? target() : 0;
        paint(current);
    }
    function measure() {
        height = hero.offsetHeight;
        top = __env.rect(hero).top + __env.scrollY;
        // Reserve the entire possible downward travel, even when compositor scrolling
        // reaches the top before this damped animation (or its next frame) catches up.
        hero.style.setProperty('--hero-film-bleed', Math.ceil(height * DEPTH.film * (__env.innerWidth <= 750 ? DEPTH.mobile : 1) + 2) + 'px');
        reset();
    }
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; reset(); }, { rootMargin: '80px 0px' });
    const size = new ResizeObserver(measure);
    const preferences = new MutationObserver(reset);
    visibility.observe(hero);
    size.observe(hero);
    measure();
    preferences.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', measure, { passive: true });
    document.addEventListener('visibilitychange', reset);
    document.addEventListener('spook:navigate', measure);
    reduced.addEventListener('change', reset);
    dispose = () => {
        stop();
        visibility.disconnect();
        size.disconnect();
        preferences.disconnect();
        removeEventListener('scroll', request);
        removeEventListener('resize', measure);
        document.removeEventListener('visibilitychange', reset);
        document.removeEventListener('spook:navigate', measure);
        reduced.removeEventListener('change', reset);
        hero.classList.remove('depth-active');
        paint(0);
    };
}

Object.assign(__exports,{initHeroDepth});
},
"horror-paths.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { railMarkup, initRails } = __require("rails.js");
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mountHorrorPaths(root, data, items, card) {
    if (!data?.collections?.length)
        return;
    const lookup = new Map(items.map(i => [i.id, i]));
    const collections = data.collections.filter(c => c.id !== 'aliens-abductions' && c.itemIds.some(id => lookup.has(id)));
    root.innerHTML = `<section class="shelf horror-paths scene" aria-labelledby="horror-paths-heading"><div class="section-top"><h2 id="horror-paths-heading">Go deeper</h2></div><div class="horror-path-tabs" role="tablist" aria-label="Explore horror traditions">${collections.map((c, n) => `<button type="button" id="path-tab-${esc(c.id)}" role="tab" aria-selected="${n === 0}" aria-controls="path-panel-${esc(c.id)}" tabindex="${n === 0 ? 0 : -1}"><img src="/spooktober/assets/icons/path-${esc(c.id)}.svg" alt="" width="34" height="34"><span>${esc(c.title)}</span></button>`).join('')}</div><div class="horror-path-panels">${collections.map((c, n) => {
        const records = c.itemIds.map(id => lookup.get(id)).filter(Boolean);
        const posters = records.map(i => card(i, true)).join('');
        return `<div class="horror-path-panel ${n ? '' : 'is-current'}" id="path-panel-${esc(c.id)}" role="tabpanel" aria-labelledby="path-tab-${esc(c.id)}" ${n ? 'inert aria-hidden="true"' : ''}><p class="horror-path-note">${esc(c.description)}</p>${railMarkup(n ? posters.replace(/<img src=/g, '<img data-src=') : posters, c.title, 'media-row')}</div>`;
    }).join('')}</div></section>`;
    const tabs = [...root.querySelectorAll('[role="tab"]')], panels = [...root.querySelectorAll('[role="tabpanel"]')];
    function select(index) {
        tabs.forEach((tab, n) => { tab.setAttribute('aria-selected', String(n === index)); tab.tabIndex = n === index ? 0 : -1; });
        panels.forEach((panel, n) => { const active = n === index; panel.classList.toggle('is-current', active); panel.inert = !active; panel.setAttribute('aria-hidden', String(!active)); if (active)
            panel.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; delete img.dataset.src; }); });
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(index));
        tab.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
            return; e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; select(next); tabs[next].focus({ preventScroll: true }); });
    });
    initRails(root);
}

Object.assign(__exports,{mountHorrorPaths});
},
"inline-surface.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
// A section swap keeps its original geometry and scrollable rail in the DOM.
function initInlineSurface(panel) {
    let host = null, source = null, replaced = [], observer = null;
    const restore = () => { for (const [el, inert] of replaced) {
        el.classList.remove('inline-replaced');
        el.inert = inert;
    } replaced = []; };
    function layout() {
        if (!host || !source?.isConnected || !host.offsetWidth)
            return;
        restore();
        if (host.id === 'catalog-grid') {
            const top = source.offsetTop;
            const row = [...host.children].filter(el => el !== panel && Math.abs(el.offsetTop - top) < 3);
            const height = Math.max(...row.map(el => el.offsetHeight));
            panel.style.top = top + 'px';
            panel.style.height = height + 'px';
            replaced = row.map(el => [el, el.inert]);
        }
        else {
            panel.style.top = '';
            panel.style.height = '';
            replaced = [...host.children].filter(el => el !== panel).map(el => [el, el.inert]);
        }
        for (const [el] of replaced) {
            el.classList.add('inline-replaced');
            el.inert = true;
        }
    }
    function close() {
        if (!panel.open)
            return;
        observer?.disconnect();
        restore();
        host?.classList.remove('inline-host');
        panel.hidden = true;
        panel.open = false;
        panel.removeAttribute('open');
        panel.classList.remove('inline-enter');
        document.body.append(panel);
        host = null;
        source = null;
        panel.dispatchEvent(new Event('close'));
    }
    function open(trigger) {
        if (!panel.open) {
            source = trigger;
            host = source?.closest('#catalog-grid,.editorial-shelf,.playlist-world,.video-program,.video-library,.masters-world,.shelf,.film-hero') || document.querySelector('.film-hero');
            if (!host)
                return;
            host.classList.add('inline-host');
            host.append(panel);
            panel.hidden = false;
            panel.open = true;
            panel.setAttribute('open', '');
            layout();
            observer = new ResizeObserver(layout);
            observer.observe(host);
        }
        panel.classList.remove('inline-enter');
        void panel.offsetWidth;
        panel.classList.add('inline-enter');
    }
    panel.hidden = true;
    panel.open = false;
    panel.close = close;
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.open && !document.body.classList.contains('viewing-page')) {
        event.preventDefault();
        close();
    } });
    document.addEventListener('catalog:reset', () => { if (host?.id === 'catalog-grid')
        close(); });
    return { open, close };
}

Object.assign(__exports,{initInlineSurface});
},
"masters.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const { revealRailCard } = __require("rails.js");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const filmmakers = [
    { name: 'Alfred Hitchcock', image: 'hitchcock', sub: 'Suspense', film: 'Psycho · 1960', line: 'Explore his suspense classics.', photo: 'https://image.tmdb.org/t/p/w500/108fiNM6poRieMg7RIqLJRxdAwG.jpg', background: 'https://images.metahub.space/background/medium/tt0054215/img' },
    { name: 'John Carpenter', image: 'carpenter', sub: 'Cult classics', film: 'The Thing · 1982', line: 'Independent horror and cult classics.', photo: 'https://image.tmdb.org/t/p/w500/3Qp0mg61u1qSZNJh30BFEUZrIMG.jpg', background: 'https://images.metahub.space/background/medium/tt0084787/img' },
    { name: 'Wes Craven', image: 'craven', sub: 'Slasher nightmares', film: 'Scream · 1996', line: 'The director behind Scream and Freddy Krueger.', photo: 'https://image.tmdb.org/t/p/w500/eqwl6owrYykeTGTpKxwcAkbEJmg.jpg', background: 'https://images.metahub.space/background/medium/tt0117571/img' },
    { name: 'Ari Aster', image: 'aster', sub: 'Uneasy families', film: 'Midsommar · 2019', line: 'Horror built around family trauma.', photo: 'https://image.tmdb.org/t/p/w500/45lOHyHwdMgyKm6u3jwLtyfwOjc.jpg', background: 'https://images.metahub.space/background/medium/tt8772262/img' },
    { name: 'Robert Eggers', image: 'eggers', sub: 'Dark folklore', film: 'The Witch · 2015', line: 'Period horror drawn from folklore.', photo: 'https://image.tmdb.org/t/p/w500/8Mbq0G8FguELKC8zNFunapPpkt5.jpg', background: 'https://images.metahub.space/background/medium/tt4263482/img' },
    { name: 'Jordan Peele', image: 'peele', sub: 'Modern nightmares', film: 'Get Out · 2017', line: 'Social horror with a sharp point of view.', photo: 'https://image.tmdb.org/t/p/w500/kFUKn5g3ebpyZ3CSZZZo2HFWRNQ.jpg', background: 'https://images.metahub.space/background/medium/tt5052448/img' },
    { name: 'James Wan', image: 'wan', sub: 'Haunted houses', film: 'The Conjuring · 2013', line: 'The director behind The Conjuring.', photo: 'https://image.tmdb.org/t/p/w500/bNJccMIKzCtYnndcOKniSKCzo5Y.jpg', background: 'https://images.metahub.space/background/medium/tt1457767/img' },
    { name: 'Guillermo del Toro', image: 'del-toro', sub: 'Monsters & fairy tales', film: 'Pan’s Labyrinth · 2006', line: 'Gothic stories with a human heart.', photo: 'https://image.tmdb.org/t/p/w500/cWvt8FdPAH0j3QtLzAN1j7ZJJrr.jpg', background: 'https://images.metahub.space/background/medium/tt0457430/img' },
    { name: 'Tim Burton', image: 'burton', portrait: 'burton-photo', sub: 'Gothic mischief', film: 'Sleepy Hollow · 1999', line: 'A stranger side of Halloween.', photo: 'https://image.tmdb.org/t/p/w500/yHEHAHQpN9PfSEQx1UxZPczhcAi.jpg', background: 'https://images.metahub.space/background/medium/tt0162661/img' },
    { name: 'Dario Argento', image: 'argento', sub: 'Italian horror', film: 'Suspiria · 1977', line: 'A defining voice in Italian horror.', photo: 'https://image.tmdb.org/t/p/w500/2WjQlcLxhvmO9NtCfNh2npMVYqp.jpg', background: 'https://images.metahub.space/background/medium/tt0076786/img' },
    { name: 'George A. Romero', image: 'romero', sub: 'The living dead', film: 'Night of the Living Dead · 1968', line: 'The filmmaker who reinvented the zombie.', photo: 'https://image.tmdb.org/t/p/w500/w2zVF92x149qK79ZxwUowcSp2c6.jpg', background: 'https://images.metahub.space/background/medium/tt0063350/img' },
].map(d => ({ ...d, portrait: d.portrait || d.image }));
const DIRECTORS = Object.fromEntries(filmmakers.map(d => [d.name, d]));
function mastersMarkup(rail) {
    return `<section id="masters-world" class="masters-world scene" aria-label="The masters of horror" aria-roledescription="carousel">
 <div class="feature masters-feature"><div class="feature-bg masters-backdrops" aria-hidden="true">${filmmakers.map((d, n) => `<img data-master-backdrop="${n}" ${n ? 'data-src' : 'src'}="${d.background}" class="${n ? '' : 'is-current'}" alt="" loading="lazy">`).join('')}</div>
 <div class="masters-content"><p class="feature-label">The masters of horror</p><div id="master-feature" class="master-panels">${filmmakers.map((d, n) => `<article data-master-panel="${n}" class="master-panel ${n ? '' : 'is-current'}" aria-hidden="${!!n}" ${n ? 'inert' : ''}><h2>${esc(d.name)}</h2><p>${esc(d.line)}</p><button class="text-button" data-director="${esc(d.name)}" aria-label="Explore films by ${esc(d.name)}">Explore films</button></article>`).join('')}</div></div>
 <span class="master-film-caption" aria-hidden="true">${filmmakers[0].film}</span></div>
 <div class="directors"><div class="director-controls"><span>11 filmmakers</span><button class="master-rotation rotation-toggle" role="switch" aria-label="Automatically change featured filmmaker" aria-checked="true"><span>Auto-advance</span><i aria-hidden="true"></i></button></div>
 ${rail(filmmakers.map((d, n) => `<button class="director-button" data-director-select="${n}" aria-label="Feature ${esc(d.name)}" aria-controls="master-feature" aria-pressed="${n === 0}"><span class="director-photo"><img class="director-portrait" src="${d.photo}" alt="" loading="lazy" width="400" height="440"></span><span class="director-name">${esc(d.name)}</span><span class="director-sub">${esc(d.sub)}</span></button>`).join(''), 'Horror directors', 'director-row')}
 </div><p class="sr-only master-status" aria-live="polite"></p></section>`;
}
function initMasters() {
    const root = document.querySelector('#masters-world');
    if (!root)
        return;
    const buttons = [...root.querySelectorAll('[data-director-select]')], panels = [...root.querySelectorAll('[data-master-panel]')], images = [...root.querySelectorAll('[data-master-backdrop]')], track = root.querySelector('.director-row'), toggle = root.querySelector('.master-rotation'), reduced = matchMedia('(prefers-reduced-motion:reduce)');
    // Storyboard: old film holds until the next image decodes; backdrop dissolves
    // for 700ms, copy enters after 130ms. Portrait selection never shifts the rail.
    const TIMING = { rotation: 11000 };
    let index = 0, timer = 0, revision = 0, visible = false, hovered = false, paused = reduced.matches;
    function preload(n) { const img = images[n]; if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
    } return img.decode().catch(() => { }); }
    function schedule() {
        clearTimeout(timer);
        const eligible = !paused && !hovered && visible && !document.hidden && !reduced.matches && !document.querySelector('#detail[open]') && !root.contains(document.activeElement);
        if (eligible)
            timer = setTimeout(() => select((index + 1) % buttons.length), TIMING.rotation);
    }
    function paint() { toggle.setAttribute('aria-checked', String(!paused)); schedule(); }
    async function select(next, manual = false) {
        const request = ++revision;
        clearTimeout(timer);
        if (manual) {
            paused = true;
            paint();
        }
        await preload(next);
        if (request !== revision)
            return;
        index = next;
        panels.forEach((el, n) => { el.classList.toggle('is-current', n === next); el.inert = n !== next; el.setAttribute('aria-hidden', String(n !== next)); });
        images.forEach((el, n) => el.classList.toggle('is-current', n === next));
        buttons.forEach((el, n) => el.setAttribute('aria-pressed', String(n === next)));
        root.querySelector('.master-film-caption').textContent = filmmakers[next].film;
        revealRailCard(buttons[next]);
        if (manual)
            root.querySelector('.master-status').textContent = 'Featuring ' + filmmakers[next].name;
        preload((next + 1) % images.length);
        schedule();
    }
    buttons.forEach((b, n) => b.addEventListener('click', () => select(n, true)));
    toggle.addEventListener('click', () => { paused = !paused; paint(); });
    root.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    root.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    root.addEventListener('focusin', schedule);
    root.addEventListener('focusout', () => queueMicrotask(schedule));
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible)
        preload((index + 1) % images.length); schedule(); }, { threshold: .2 }).observe(root);
    document.addEventListener('visibilitychange', schedule);
    new MutationObserver(schedule).observe(document.querySelector('#detail'), { attributes: true, attributeFilter: ['open'] });
    reduced.addEventListener('change', () => { if (reduced.matches)
        paused = true; paint(); });
    paint();
}

Object.assign(__exports,{filmmakers,DIRECTORS,mastersMarkup,initMasters});
},
"mixtapes.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PICKS = [
    { id: 'party', coverTitles: ['Thriller', 'Ghostbusters'], title: 'Halloween party', description: 'Halloween party favorites.', art: ['pumpkin-mischief', 'pumpkin-grin'], titles: ['Thriller', 'Ghostbusters', 'Monster Mash', 'Somebody', 'Spooky, Scary', 'Heads Will Roll', 'Disturbia', 'Everybody', 'Calling All the Monsters', 'Superstition'] },
    { id: 'dark', coverTitles: ['Lullaby', 'Red Right Hand'], title: 'After dark', description: 'A darker mix.', art: ['foreground-tree', 'grass-clump'], titles: ['Lullaby', 'Bela Lugosi', 'Spellbound', 'Red Right Hand', 'bury a friend', 'Psycho Killer', 'Dragula', 'Pet Sematary', 'Feed My Frankenstein', 'Dead Man'] },
    { id: 'scores', coverTitles: ['Halloween Theme', 'Tubular Bells'], title: 'Horror soundtracks', description: 'Music from horror films.', art: ['headstone-cross', 'grass-clump'], titles: ['Halloween', 'Tubular Bells', 'Suspiria', 'This Is Halloween', 'The Addams Family'] },
];
let curated = [];
function setMusicCollections(data) { curated = Array.isArray(data) ? data : []; }
function musicCollections(items) {
    if (curated.length) {
        const byId = new Map(items.map(i => [i.id, i]));
        return curated.map(p => ({ ...p, covers: (p.coverIds || []).map(id => byId.get(id)).filter(Boolean), songs: p.songIds.map(id => byId.get(id)).filter(Boolean) }));
    }
    return PICKS.map(p => ({ ...p, covers: p.coverTitles.map(title => items.find(i => i.type === 'Music' && i.title.startsWith(title))).filter(Boolean), songs: items.filter(i => i.type === 'Music' && p.titles.some(title => i.title.startsWith(title))) }));
}
function mixArt(p) { return `<span class="mix-art mix-art-${p.id}" aria-hidden="true">${p.art.map((name, n) => `<img class="mix-prop mix-prop-${n}" src="/spooktober/assets/art/${name}.svg" alt="" loading="lazy">`).join('')}<span class="mix-albums">${p.covers.map(i => `<img src="${i.poster}" alt="" loading="lazy" width="160" height="160">`).join('')}</span></span>`; }
function playlistMarkup(items, railMarkup) {
    return `<section class="playlist-world scene" aria-labelledby="playlist-heading"><div class="section-top"><div><h2 id="playlist-heading">Halloween playlists</h2><p>Find your Halloween soundtrack.</p></div></div>${railMarkup(musicCollections(items).map(p => `<button class="playlist-card" data-playlist="${p.id}" aria-label="Explore ${p.title}, ${p.songs.length} songs">${mixArt(p)}<span class="playlist-copy"><strong>${p.title}</strong><small>${p.songs.length} songs</small><span>${p.description}</span></span></button>`).join(''), 'Halloween playlists', 'playlist-grid')}</section>`;
}
function playlistDialog(p, saved) {
    return `<div class="playlist-detail"><div class="playlist-intro">${mixArt(p)}<div><p class="detail-meta">Spooktober playlist · ${p.songs.length} songs</p><h2 id="dialog-title">${p.title}</h2><p>${p.description}</p><button class="quiet-button" id="save-playlist">${p.songs.every(i => saved.has(i.id)) ? 'All songs saved' : 'Save all songs'}</button></div></div><div class="playlist-tracks">${p.songs.map((i, n) => `<button class="playlist-track" data-item="${i.id}"><span class="track-number">${String(n + 1).padStart(2, '0')}</span><img src="${i.poster}" alt="" loading="lazy"><span class="track-title"><strong>${esc(i.title)}</strong><small>${esc(i.creator)}</small></span><span class="track-duration">${Math.floor(i.duration / 60)}:${String(i.duration % 60).padStart(2, '0')}</span></button>`).join('')}</div></div>`;
}

Object.assign(__exports,{setMusicCollections,musicCollections,mixArt,playlistMarkup,playlistDialog});
},
"official-video.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
let apiPromise, activePlayer, loadGeneration = 0, loadTimer, restorePreview;
function youtubeApi() {
    if (window.YT?.Player)
        return Promise.resolve(window.YT);
    if (apiPromise)
        return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        const timeout = setTimeout(() => reject(Error('Player unavailable')), 8000);
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); previous?.(); resolve(window.YT); };
        script.onerror = () => { clearTimeout(timeout); reject(Error('Player unavailable')); };
        document.head.append(script);
    }).catch(error => { apiPromise = null; throw error; });
    return apiPromise;
}
function stopOfficialVideo() { loadGeneration++; clearTimeout(loadTimer); activePlayer?.destroy(); activePlayer = null; if (restorePreview) {
    const { container, button } = restorePreview;
    container.replaceChildren(button);
    restorePreview = null;
} }
async function playOfficialVideo(video, button) {
    stopOfficialVideo();
    const generation = loadGeneration, container = button.closest('.video-player');
    restorePreview = { container, button: button.cloneNode(true) };
    button.disabled = true;
    button.querySelector('strong').textContent = 'Opening video…';
    const fallback = () => {
        if (generation !== loadGeneration || !container.isConnected)
            return;
        clearTimeout(loadTimer);
        activePlayer?.destroy();
        activePlayer = null;
        container.replaceChildren();
        const link = document.createElement('a');
        link.className = 'video-fallback';
        link.href = video.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const image = document.createElement('img');
        image.src = video.image;
        image.alt = '';
        const copy = document.createElement('span');
        const heading = document.createElement('strong');
        heading.textContent = 'Watch on YouTube ↗';
        const detail = document.createElement('small');
        detail.textContent = 'This video isn’t available in the embedded player.';
        copy.append(heading, detail);
        link.append(image, copy);
        container.append(link);
        link.focus({ preventScroll: true });
    };
    try {
        const YT = await youtubeApi();
        if (generation !== loadGeneration || !container.isConnected)
            return;
        const mount = document.createElement('div');
        container.replaceChildren(mount);
        loadTimer = setTimeout(fallback, 12000);
        activePlayer = new YT.Player(mount, { host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%', videoId: video.id, playerVars: { origin: location.origin, autoplay: 1, playsinline: 1, rel: 0 }, events: { onReady: e => { clearTimeout(loadTimer); e.target.getIframe().title = video.title + ' — official artist video'; e.target.playVideo(); }, onError: fallback } });
    }
    catch {
        fallback();
    }
}

Object.assign(__exports,{stopOfficialVideo,playOfficialVideo});
},
"page-navigation.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
function createPageNavigation(onLeave, restoreRoute) {
    const main = document.querySelector('#top'), host = document.createElement('main');
    host.id = 'route-root';
    host.hidden = true;
    document.body.append(host);
    const pages = new Map();
    let current = 'event';
    pages.set('event', { node: null, scroll: 0, focus: null, title: 'Spooktober', url: location.pathname + location.search, parent: false });
    history.scrollRestoration = 'manual';
    function capture() { const page = pages.get(current); if (page) {
        page.scroll = __env.scrollY;
        page.focus = document.activeElement;
        if (current === 'event' && !/^#(?:playlist|song|video)\//.test(location.hash))
            page.url = location.pathname + location.search + location.hash;
    } }
    function activate(key, restore = false) {
        const page = pages.get(key);
        if (!page)
            return;
        onLeave();
        current = key;
        main.hidden = key !== 'event';
        host.hidden = key === 'event';
        host.replaceChildren(...(page.node ? [page.node] : []));
        document.body.classList.toggle('viewing-page', key !== 'event');
        document.title = key === 'event' ? 'Harbor · Spooktober' : `${page.title} · Spooktober`;
        if (restore && page.focus?.isConnected)
            page.focus.focus({ preventScroll: true });
        else if (page.node) {
            const title = page.node.querySelector('#page-title,h1');
            if (title) {
                title.tabIndex = -1;
                title.focus({ preventScroll: true });
            }
        }
        scrollTo({ top: restore ? page.scroll : 0, behavior: 'instant' });
        document.dispatchEvent(new Event('spook:navigate'));
    }
    function back() { const page = pages.get(current); if (page?.parent)
        history.back();
    else {
        capture();
        activate('event', true);
        history.replaceState({ spookPage: 'event' }, '', pages.get('event').url);
    } }
    addEventListener('popstate', () => {
        const key = history.state?.spookPage || 'event';
        capture();
        if (pages.has(key))
            activate(key, true);
        else
            restoreRoute?.();
    });
    return {
        show(html, { key, title, trigger, replace = false }) {
            capture();
            if (trigger)
                pages.get(current).focus = trigger;
            const previous = pages.get(current);
            if (!replace)
                history.replaceState({ ...history.state, spookPage: current }, '', location.href);
            const node = document.createElement('div');
            node.className = 'route-page';
            node.innerHTML = '<nav class="page-navigation" aria-label="Back navigation"><button id="page-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span></span></button><span>Spooktober</span></nav><div class="route-page-content">' + html.replaceAll('id="dialog-title"', 'id="page-title"') + '</div>';
            node.querySelector('#page-back span').textContent = 'Back to ' + (replace ? 'Spooktober' : previous.title);
            node.querySelector('#page-back').addEventListener('click', back);
            const url = location.pathname + location.search + '#' + key;
            pages.set(key, { node, scroll: 0, focus: null, title, url, parent: !replace });
            history[replace ? 'replaceState' : 'pushState']({ spookPage: key }, '', url);
            activate(key);
        },
        get current() { return current; }
    };
}

Object.assign(__exports,{createPageNavigation});
},
"playlist-pages.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
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
function playlistPage(p, saved, mixArt) {
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
function initPlaylistPage(root, p) {
    const page = root?.matches?.('.playlist-page') ? root : root?.querySelector?.('.playlist-page');
    if (!page)
        return () => { };
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
            if (!row.hidden)
                visible++;
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
            if (playerCover.getAttribute('src') !== song.poster)
                playerCover.src = song.poster;
            playerTitle.textContent = song.title;
            playerArtist.textContent = song.creator;
            const message = { loading: 'Loading preview…', playing: 'Playing preview', paused: 'Preview paused', finished: 'Playlist previews finished', error: 'Preview unavailable. Press Play to retry, or choose another song.' }[phase] || 'Preview';
            if (status.textContent !== message)
                status.textContent = message;
        }
    };
    const pause = () => {
        generation++;
        wantsPlay = false;
        audio.pause();
        if (current >= 0)
            phase = 'paused';
        render();
    };
    const fail = () => {
        if (disposed || !page.isConnected)
            return;
        wantsPlay = false;
        audio.pause();
        phase = 'error';
        render();
    };
    const start = async (index, reset = true) => {
        if (disposed || !page.isConnected || !songs[index]?.preview)
            return;
        const request = ++generation;
        const needsSource = current !== index || !audio.getAttribute('src') || phase === 'error';
        if (needsSource || reset)
            audio.pause();
        current = index;
        cursor = queue.indexOf(index);
        wantsPlay = true;
        phase = 'loading';
        if (needsSource)
            audio.src = songs[index].preview;
        if (reset)
            audio.currentTime = 0;
        progress();
        render();
        try {
            await audio.play();
            if (disposed || !page.isConnected) {
                audio.pause();
                return;
            }
            if (request !== generation || !wantsPlay)
                return;
            phase = 'playing';
            render();
        }
        catch (error) {
            if (request !== generation || disposed || !page.isConnected)
                return;
            fail();
        }
    };
    const playOrPause = () => {
        if (wantsPlay) {
            pause();
            return;
        }
        if (current < 0 || phase === 'finished') {
            queue = shuffled ? randomOrder(playable) : [...playable];
            start(queue[0]);
        }
        else
            start(current, phase === 'error' || audio.ended);
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
    for (const button of trackButtons)
        button.addEventListener('click', () => {
            const index = Number(button.dataset.previewIndex);
            if (index === current) {
                playOrPause();
                return;
            }
            queue = shuffled ? [index, ...randomOrder(playable.filter(value => value !== index))] : [...playable];
            start(index);
        }, options);
    previous.addEventListener('click', () => { if (cursor > 0)
        start(queue[cursor - 1]); }, options);
    next.addEventListener('click', () => { if (cursor < queue.length - 1)
        start(queue[cursor + 1]); }, options);
    seek.addEventListener('input', () => {
        if (Number.isFinite(audio.duration))
            audio.currentTime = Math.min(Number(seek.value), audio.duration);
        progress();
    }, options);
    audio.addEventListener('loadedmetadata', progress, options);
    // Route departure must also cancel an in-flight preview, while keeping cached state reusable.
    audio.addEventListener('spook:pause', pause, options);
    audio.addEventListener('durationchange', progress, options);
    audio.addEventListener('timeupdate', progress, options);
    audio.addEventListener('playing', () => { if (wantsPlay) {
        phase = 'playing';
        render();
    } }, options);
    audio.addEventListener('waiting', () => { if (wantsPlay) {
        phase = 'loading';
        render();
    } }, options);
    audio.addEventListener('pause', () => {
        // Source changes also emit pause; do not cancel the pending replacement preview.
        if (audio.paused && phase === 'playing' && !audio.ended) {
            wantsPlay = false;
            phase = 'paused';
            render();
        }
    }, options);
    audio.addEventListener('error', fail, options);
    audio.addEventListener('ended', () => {
        if (!wantsPlay || disposed || !page.isConnected)
            return;
        if (cursor < queue.length - 1)
            start(queue[cursor + 1]);
        else {
            wantsPlay = false;
            phase = 'finished';
            render();
        }
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

Object.assign(__exports,{playlistPage,initPlaylistPage});
},
"rails.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
// Mirrors Harbor's Row/NavChevron controls for this standalone review surface.
const CHEVRON = 'M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z';
const RAIL = { dragThreshold: 6, minDuration: 280, maxDuration: 620, baseDuration: 260, distanceTime: .45, friction: .004 };
const states = new WeakMap();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const cards = row => [...row.children];
const stride = row => { const c = cards(row); return c[1] ? __env.rect(c[1]).left - __env.rect(c[0]).left : row.clientWidth; };
const maxScroll = row => Math.max(0, row.scrollWidth - row.clientWidth);
const clamp = (value, row) => Math.max(0, Math.min(maxScroll(row), value));
const enabled = () => !reduced.matches && !document.body.classList.contains('motion-off');
// Fit an integer number of cards to the actual rail, including split editorial layouts.
function fitRail(row) {
    const state = states.get(row), style = getComputedStyle(row);
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const available = __env.rect(row).width - padding;
    if (available <= 0)
        return;
    const gap = parseFloat(style.columnGap) || 0, min = parseFloat(style.getPropertyValue('--rail-min')) || 156;
    const limit = parseInt(style.getPropertyValue('--rail-max')) || 6;
    const count = Math.min(limit, Math.max(1, Math.floor((available + gap) / (min + gap))));
    const width = (Math.ceil(((available - (count - 1) * gap) / count) * 64) + 1) / 64;
    if (state.width === width && state.gap === gap)
        return;
    const index = state.step ? Math.round(row.scrollLeft / state.step) : 0;
    const wasEnd = state.step && state.max > 0 && row.scrollLeft >= state.max - 2;
    cancel(row, false);
    row.style.scrollSnapType = 'none';
    row.style.scrollBehavior = 'auto';
    row.style.setProperty('--rail-card-width', width + 'px');
    row.style.scrollPaddingInline = style.paddingLeft + ' ' + style.paddingRight;
    row.dataset.fitted = '';
    state.width = width;
    state.gap = gap;
    state.count = count;
    state.step = width + gap;
    state.max = maxScroll(row);
    row.scrollLeft = wasEnd ? state.max : clamp(index * state.step, row);
    row.style.scrollSnapType = '';
    row.style.scrollBehavior = '';
    updateRail(row);
}
function railMarkup(content, title, trackClass = 'media-row', extraClass = '') {
    const label = title.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const edge = (dir, name) => `<button class="rail-edge rail-${name}" data-direction="${dir}" aria-label="Scroll ${name}: ${label}" disabled tabindex="-1"><span><svg viewBox="0 0 320 512" aria-hidden="true"><path d="${CHEVRON}" fill="currentColor"/></svg></span></button>`;
    return `<div class="harbor-rail ${extraClass}"><div class="rail-track ${trackClass}" role="group" aria-label="${label}">${content}</div>${edge(-1, 'left')}${edge(1, 'right')}</div>`;
}
function updateRail(row) {
    const rail = row.closest('.harbor-rail');
    if (!rail)
        return;
    const left = rail.querySelector('.rail-left'), right = rail.querySelector('.rail-right');
    const previous = row.scrollLeft > 3, next = row.scrollLeft < maxScroll(row) - 3;
    left.disabled = !previous;
    right.disabled = !next;
    left.tabIndex = previous ? 0 : -1;
    right.tabIndex = next ? 0 : -1;
    if (!previous && document.activeElement === left)
        cards(row)[0]?.focus({ preventScroll: true });
    if (!next && document.activeElement === right)
        cards(row).at(-1)?.focus({ preventScroll: true });
    rail.classList.toggle('can-prev', previous);
    rail.classList.toggle('can-next', next);
    const poster = row.querySelector('.poster-wrap,.director-portrait,.feature-selector');
    if (poster) {
        const art = __env.rect(poster), container = __env.rect(rail);
        rail.style.setProperty('--rail-art-height', art.height + 'px');
        rail.style.setProperty('--rail-art-top', (art.top - container.top) + 'px');
    }
}
function cancel(row, restore = true) {
    const state = states.get(row);
    if (state?.frame)
        cancelAnimationFrame(state.frame);
    if (state)
        state.frame = 0;
    if (restore) {
        row.style.scrollSnapType = '';
        row.style.scrollBehavior = '';
    }
}
/* Rail storyboard: click/drag -> cubic ease-out -> exact card boundary.
 * A second gesture cancels the current glide; reduced motion settles instantly.
 */
function glide(row, rawTarget) {
    cancel(row, false);
    const state = states.get(row);
    if (!state)
        return;
    const start = row.scrollLeft, target = clamp(rawTarget, row), distance = target - start;
    if (!enabled() || Math.abs(distance) < 1) {
        row.scrollLeft = target;
        updateRail(row);
        return;
    }
    row.style.scrollSnapType = 'none';
    row.style.scrollBehavior = 'auto';
    const time = performance.now(), duration = Math.max(RAIL.minDuration, Math.min(RAIL.maxDuration, RAIL.baseDuration + Math.abs(distance) * RAIL.distanceTime));
    const frame = now => {
        const t = Math.min(1, (now - time) / duration);
        row.scrollLeft = start + distance * (1 - Math.pow(1 - t, 3));
        if (t < 1)
            state.frame = requestAnimationFrame(frame);
        else {
            state.frame = 0;
            row.scrollLeft = target;
            row.style.scrollSnapType = '';
            row.style.scrollBehavior = '';
            updateRail(row);
        }
    };
    state.frame = requestAnimationFrame(frame);
}
function scrollRail(row, direction) {
    const step = stride(row), count = states.get(row)?.count || 1;
    glide(row, (Math.round(row.scrollLeft / step) + direction * count) * step);
}
function revealRailCard(card) {
    const row = card.closest('.rail-track');
    if (!row)
        return;
    const left = card.offsetLeft - row.children[0].offsetLeft;
    const padding = (parseFloat(getComputedStyle(row).paddingLeft) || 0) * 2;
    if (left < row.scrollLeft - 1 || left + card.offsetWidth > row.scrollLeft + row.clientWidth - padding + 1)
        glide(row, left);
}
function initRails(root = document) {
    root.querySelectorAll('.rail-track').forEach(row => {
        if (states.has(row)) {
            fitRail(row);
            updateRail(row);
            return;
        }
        const state = { frame: 0, drag: null, suppressClick: false };
        states.set(row, state);
        row.addEventListener('scroll', () => updateRail(row), { passive: true });
        row.addEventListener('wheel', () => cancel(row), { passive: true });
        row.addEventListener('dragstart', e => e.preventDefault());
        row.addEventListener('pointerdown', e => {
            cancel(row);
            state.suppressClick = false;
            if (e.button !== 0 || e.pointerType === 'touch')
                return;
            state.drag = { id: e.pointerId, startX: e.clientX, startScroll: row.scrollLeft, lastX: e.clientX, lastTime: performance.now(), velocity: 0, moved: false };
        });
        row.addEventListener('pointermove', e => {
            const drag = state.drag;
            if (!drag)
                return;
            const dx = e.clientX - drag.startX;
            if (!drag.moved && Math.abs(dx) < RAIL.dragThreshold)
                return;
            if (!drag.moved) {
                drag.moved = true;
                row.setPointerCapture(e.pointerId);
                row.style.scrollSnapType = 'none';
                row.classList.add('dragging');
            }
            e.preventDefault();
            const now = performance.now(), dt = now - drag.lastTime;
            if (dt > 0)
                drag.velocity = drag.velocity * .55 + (e.clientX - drag.lastX) / dt * .45;
            drag.lastX = e.clientX;
            drag.lastTime = now;
            row.scrollLeft = drag.startScroll - dx;
        });
        const end = e => {
            const drag = state.drag;
            if (!drag)
                return;
            state.drag = null;
            if (row.hasPointerCapture(drag.id))
                row.releasePointerCapture(drag.id);
            row.classList.remove('dragging');
            if (!drag.moved)
                return;
            state.suppressClick = true;
            setTimeout(() => state.suppressClick = false, 0);
            const velocity = e.type === 'pointercancel' || performance.now() - drag.lastTime > 100 ? 0 : drag.velocity;
            const projection = Math.max(-row.clientWidth, Math.min(row.clientWidth, -velocity * Math.abs(velocity) / (2 * RAIL.friction)));
            glide(row, Math.round((row.scrollLeft + projection) / stride(row)) * stride(row));
        };
        row.addEventListener('pointerup', end);
        row.addEventListener('pointercancel', end);
        row.addEventListener('lostpointercapture', end);
        row.addEventListener('click', e => { if (state.suppressClick) {
            e.preventDefault();
            e.stopImmediatePropagation();
        } }, true);
        row.addEventListener('keydown', e => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                return;
            const children = cards(row), current = children.indexOf(e.target.closest('.media-card,.director-button,.feature-selector,.playlist-card'));
            if (current < 0)
                return;
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? children.length - 1 : current + (e.key === 'ArrowRight' ? 1 : -1);
            if (!children[next])
                return;
            e.preventDefault();
            e.stopPropagation();
            children[next].focus({ preventScroll: true });
            const padding = parseFloat(getComputedStyle(row).paddingLeft) || 0;
            const left = children[next].offsetLeft - children[0].offsetLeft;
            if (e.key === 'Home' || e.key === 'End' || left < row.scrollLeft || left + children[next].offsetWidth > row.scrollLeft + row.clientWidth - padding)
                glide(row, left);
        });
        new ResizeObserver(() => { fitRail(row); updateRail(row); }).observe(row);
        fitRail(row);
        updateRail(row);
    });
}

Object.assign(__exports,{railMarkup,updateRail,scrollRail,revealRailCard,initRails});
},
"scene-life.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
/* ANIMATION STORYBOARD
 *    0ms   pointer passes over: controls respond, scenery stays quiet
 *  170ms   deliberate hover: nested artwork / secondary facts respond
 * 1600ms   bats settle; no idle flight loop
 * Scroll   existing scenery follows position, up to 12px either way
 * Exit / hidden / reduced motion: cancel pending gestures immediately.
 */
const TIMING = { hoverIntent: 170, batSettle: 1600, batRest: 2200 };
const SCENERY = [
    ['.shelf-garden', 10],
    ['.reading-stone', 7],
    ['.feature-bg', 12],
    ['.video-pumpkins', 8],
];
const ATTENTION = '.editorial-entry,.playlist-card,.screening-ticket,.feature-selector,.format-link,.media-card,.video-feature,.video-tile,.bat-roost,.section-cta,.text-button';
function initSceneLife() {
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    const roost = document.querySelector('.bat-roost');
    const scenery = SCENERY.flatMap(([selector, travel]) => [...document.querySelectorAll(selector)].map(el => ({ el, travel, scene: el.closest('.scene'), visible: false })));
    let attention = null, intentTimer = 0, batTimer = 0, lastBat = -Infinity, frame = 0;
    const enabled = () => !reduced.matches && !document.hidden && !document.body.classList.contains('motion-off');
    const stopBats = () => { clearTimeout(batTimer); roost?.classList.remove('bats-awake'); };
    const clearAttention = () => { clearTimeout(intentTimer); attention?.classList.remove('intent-active'); attention = null; };
    const wakeBats = () => {
        if (!roost || !enabled() || performance.now() - lastBat < TIMING.batRest)
            return;
        lastBat = performance.now();
        stopBats();
        roost.classList.add('bats-awake');
        batTimer = setTimeout(stopBats, TIMING.batSettle);
    };
    const activate = el => {
        if (!el?.isConnected || document.hidden || document.querySelector('#detail[open]'))
            return;
        el.classList.add('intent-active');
        if (el === roost)
            wakeBats();
    };
    document.addEventListener('pointerover', event => {
        if (event.pointerType === 'touch')
            return;
        const el = event.target.closest(ATTENTION);
        if (!el || el.contains(event.relatedTarget))
            return;
        clearAttention();
        attention = el;
        intentTimer = setTimeout(() => activate(el), TIMING.hoverIntent);
    });
    document.addEventListener('pointerout', event => {
        if (attention?.contains(event.target) && !attention.contains(event.relatedTarget))
            clearAttention();
    });
    document.addEventListener('pointerdown', clearAttention);
    document.addEventListener('focusin', event => { if (event.target === roost && roost.matches(':focus-visible'))
        wakeBats(); });
    roost?.addEventListener('click', wakeBats);
    function updateScenery() {
        frame = 0;
        const active = enabled();
        for (const state of scenery) {
            if (!active) {
                state.el.style.setProperty('--scenery-y', '0px');
                state.el.style.setProperty('--ghost-x', '0px');
                state.el.style.setProperty('--ghost-y', '0px');
                state.el.style.setProperty('--ghost-tilt', '0deg');
                continue;
            }
            if (!state.visible)
                continue;
            const rect = __env.rect(state.scene);
            const progress = Math.max(-1, Math.min(1, (__env.innerHeight * .5 - rect.top - rect.height * .5) / (__env.innerHeight * .5 + rect.height * .5)));
            state.el.style.setProperty('--scenery-y', `${(progress * state.travel).toFixed(2)}px`);
            if (state.el.classList.contains('shelf-garden')) {
                const flight = Math.max(0, Math.min(1, (__env.innerHeight * .8 - rect.top) / (__env.innerHeight * .65)));
                // A short quadratic arc: rise first, then drift left above the grave.
                state.el.style.setProperty('--ghost-x', `${(-30 * flight * flight).toFixed(2)}px`);
                state.el.style.setProperty('--ghost-y', `${(-44 * (2 * flight - flight * flight)).toFixed(2)}px`);
                state.el.style.setProperty('--ghost-tilt', `${(-6 * Math.sin(Math.PI * flight)).toFixed(2)}deg`);
            }
        }
    }
    const requestScenery = () => { if (!frame)
        frame = requestAnimationFrame(updateScenery); };
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            scenery.filter(s => s.scene === entry.target).forEach(s => s.visible = entry.isIntersecting);
            if (entry.target === roost && !entry.isIntersecting)
                stopBats();
        }
        requestScenery();
    });
    new Set(scenery.map(s => s.scene)).forEach(el => observer.observe(el));
    if (roost)
        observer.observe(roost);
    addEventListener('scroll', () => { clearAttention(); requestScenery(); }, { passive: true });
    addEventListener('resize', requestScenery, { passive: true });
    const reset = () => { clearAttention(); stopBats(); requestScenery(); };
    document.addEventListener('visibilitychange', reset);
    reduced.addEventListener('change', reset);
    new MutationObserver(reset).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const dialog = document.querySelector('dialog');
    if (dialog)
        new MutationObserver(() => { if (dialog.open)
            reset(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    requestScenery();
}

Object.assign(__exports,{initSceneLife});
},
"shudder-art.js":(__env,__require,__exports)=>{
const {document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver}=__env;
/* Scroll storyboard: a gently bent arm sweeps down from the shoulder.
 * The downward knife follows the hand outside the shoulder and torso.
 * Scrolling upward retraces the same pose.
 * No timed slash, looping animation, or continuous work when offscreen. */
const POSE = { bodyTravel: 12, upperRaised: 205, upperLowered: 125, forearmRaised: 235, forearmLowered: 160, bladeRaised: 10, bladeLowered: 10, strokeStart: .18, strokeEnd: .87, still: .72 };
// The marks spread from behind the cards during the final part of the stroke.
// Their shape and timing are deterministic: scrolling back erases the same marks.
const SPLATTER = `<svg viewBox="0 0 260 260" aria-hidden="true" focusable="false">
 <g fill="currentColor">
  <path d="M107 111C94 101 105 96 92 82C85 72 76 68 73 59C69 52 64 57 69 66C77 82 91 95 90 105C88 119 75 111 67 113C59 116 63 126 79 130C96 134 93 147 81 153C72 159 67 169 73 172C81 176 90 161 103 163C116 165 108 183 115 188C125 191 122 172 132 169C149 164 150 185 160 186C169 186 166 174 158 165C150 154 157 149 170 150C190 152 196 144 188 138C181 133 164 140 159 129C155 117 167 108 166 100C164 92 154 99 148 110C141 120 133 112 132 101C130 92 124 90 120 99C118 111 116 119 107 111Z"/>
  <path d="M84 117C71 108 54 105 44 104C38 105 42 111 50 112C62 111 73 123 84 124Z M153 122C169 112 179 89 188 85C197 81 193 91 186 96C177 103 168 124 157 130Z M89 146C68 147 58 161 43 166C35 169 38 175 45 172C61 165 74 156 93 154Z"/>
  <ellipse cx="61" cy="44" rx="3" ry="6" transform="rotate(-36 61 44)"/>
  <ellipse cx="39" cy="98" rx="5" ry="2.5" transform="rotate(23 39 98)"/>
  <ellipse cx="32" cy="184" rx="5" ry="2.5" transform="rotate(-35 32 184)"/>
  <ellipse cx="116" cy="231" rx="2.5" ry="5"/>
  <ellipse cx="196" cy="69" rx="2.8" ry="5" transform="rotate(38 196 69)"/>
  <ellipse cx="219" cy="147" rx="4.5" ry="2" transform="rotate(15 219 147)"/>
  <circle cx="49" cy="149" r="2"/><circle cx="172" cy="61" r="2.6"/>
  <circle cx="91" cy="199" r="2.2"/><circle cx="199" cy="181" r="3.6"/>
  <circle cx="215" cy="194" r="1.8"/><circle cx="80" cy="34" r="1.7"/>
 </g>
</svg>`;
const ARM = `<svg class="shudder-knife-art" viewBox="0 0 280 520" aria-hidden="true">
 <g transform="translate(86 142)">
  <path d="M-17-8-8-17 11-17 24-5 20 16 9 28-10 22-19 8Z" fill="#47534c"/>
 <g class="slasher-upper-arm">
  <path d="M-18 4Q-21-10-11-17Q2-22 16-11L20 5 18 30 16 62 13 81Q4 92-10 84L-16 66-19 35Z" fill="#47534c"/>
  <path d="M-18 4Q-21-10-11-17L-6-8-6 23-9 53-5 77 3 88-10 84-16 66-19 35Z" fill="#5c685a"/>
  <path d="M6-18 16-11 20 5 18 30 16 62 13 81 3 88-5 77 1 61 4 29Z" fill="#34443c"/>
  <path d="M-11 69 4 74 15 69" fill="none" stroke="#86917e" stroke-width="1.3" opacity=".35"/>
  <!-- Matches the hanging arm's shoulder (191,150), elbow (211,226), wrist (207,302). -->
  <g transform="translate(0 79)"><g class="slasher-forearm">
   <path d="M-13-7Q0-15 13-6L15 14 14 37 12 65 11 77-12 77-14 63-17 34-16 11Z" fill="#4c5857"/>
   <path d="M-13-7-16 11-17 34-14 63-12 77-4 75-6 48-5 18-4-10Z" fill="#71806e"/>
   <path d="M8-10 13-6 15 14 14 37 12 65 11 77 3 75 6 37 3 17Z" fill="#384c41"/>
   <path d="M-13 66 12 66 11 79-12 79Z" fill="#202d31"/>
   <g transform="translate(0 76)"><g class="slasher-grip">
    <!-- Only the knife is mirrored, keeping the grip and downward orientation stable. -->
    <g class="slasher-kitchen-knife" transform="translate(2 0) scale(-1 1)">
     <path d="M-6-22-3-25 6-24 9-20 8 28-6 28Z" fill="#182427"/>
     <path d="M-6-22-3-25-2-20-2 26-6 28Z" fill="#65766d"/>
     <circle cx="2" cy="-16" r="1.8" fill="#a9b6a7"/>
     <path d="M-6 28H18L17 70 12 97-6 132Z" fill="#afc1bb"/>
     <path d="M-6 28H12L10 67 5 96-6 132Z" fill="#819b94"/>
     <path d="M12 28H18L17 70 12 97-6 132 7 95 12 68Z" fill="#d4ddd0"/>
     <path d="M-7 24H11L12 30H-7Z" fill="#a1b1a5"/>
    </g>
    <path d="M-7-13Q-14-12-18-5L-20 7Q-19 18-12 23L-2 27 12 21Q16 17 16 8L14-6Q11-14 4-15Z" fill="#9ca593"/>
    <path d="M-18-3Q-13-7-2-8L9-12Q15-10 16-2L-4 5-19 8Z" fill="#b0b5a1"/>
    <path d="M-19 8-4 5 16-2 16 8-3 15-16 18Z" fill="#83917e"/>
    <path d="M-16 18-3 15 16 8Q17 18 12 21L-2 27Z" fill="#566957"/>
    <path d="M-8-12Q-5-21 2-20L9-16 14-4Q13 3 7 5L-2-1-3-8-12 1Q-19 3-20-2Z" fill="#aab19d"/>
   </g></g>
  </g></g>
 </g></g>
</svg>`;
let dispose = () => { };
function initShudderArt() {
    dispose();
    const shelf = document.querySelector('#section-shudder');
    if (!shelf)
        return;
    shelf.querySelector('.shudder-knife-scene')?.remove();
    shelf.querySelector('.shudder-splatter-scene')?.remove();
    shelf.insertAdjacentHTML('afterbegin', '<div class="shudder-knife-scene" aria-hidden="true"><div class="shudder-figure"><div class="slasher-body-lean"><img class="shudder-figure-body" src="/spooktober/assets/art/shudder-figure-body.svg?v=1" alt="" loading="lazy" width="280" height="520"><div class="slasher-head"><img src="/spooktober/assets/art/shudder-figure-head.svg?v=1" alt="" loading="lazy" width="280" height="520"></div>' + ARM + '</div></div></div>');
    shelf.insertAdjacentHTML('afterbegin', '<div class="shudder-splatter-scene" aria-hidden="true"><div class="shudder-blood-hit blood-near">' + SPLATTER + '</div><div class="shudder-blood-hit blood-far">' + SPLATTER + '</div><div class="shudder-blood-hit blood-crown">' + SPLATTER + '</div></div>');
    const rail = shelf.querySelector('.harbor-rail'), poster = shelf.querySelector('.poster-wrap');
    function measureBlood() {
        if (!rail || !poster)
            return;
        const bounds = __env.rect(shelf), card = __env.rect(poster);
        shelf.style.setProperty('--blood-top', (card.top - bounds.top) + 'px');
        shelf.style.setProperty('--blood-left', (card.left - bounds.left) + 'px');
        shelf.style.setProperty('--blood-height', card.height + 'px');
        shelf.style.setProperty('--blood-seam', (card.width + 37) + 'px');
        shelf.style.setProperty('--blood-crown-x', (card.width * .72 + 26) + 'px');
    }
    const bloodSize = new ResizeObserver(measureBlood);
    bloodSize.observe(shelf);
    if (poster)
        bloodSize.observe(poster);
    measureBlood();
    const reduced = matchMedia('(prefers-reduced-motion:reduce)');
    let frame = 0, visible = false;
    function paint() {
        frame = 0;
        if (!visible || !shelf.isConnected)
            return;
        const rect = __env.rect(shelf), still = reduced.matches || document.body.classList.contains('motion-off');
        const passage = (__env.innerHeight - rect.top) / (__env.innerHeight + rect.height * .3);
        const progress = still ? POSE.still : Math.max(0, Math.min(1, (passage - POSE.strokeStart) / (POSE.strokeEnd - POSE.strokeStart)));
        const upper = POSE.upperRaised + (POSE.upperLowered - POSE.upperRaised) * progress;
        const forearm = POSE.forearmRaised + (POSE.forearmLowered - POSE.forearmRaised) * progress;
        const drive = still ? 0 : Math.max(0, Math.min(1, (progress - .2) / .8));
        const follow = drive * drive * (3 - 2 * drive), lean = -5.5 * follow;
        shelf.style.setProperty('--slasher-lean', lean.toFixed(3) + 'deg');
        shelf.style.setProperty('--slasher-head-tilt', (-7 * follow).toFixed(3) + 'deg');
        shelf.style.setProperty('--slasher-head-dip', (3 * follow).toFixed(3) + 'px');
        shelf.style.setProperty('--slasher-head-pitch', (1 - .055 * follow).toFixed(4));
        shelf.style.setProperty('--slasher-y', ((progress - .5) * POSE.bodyTravel).toFixed(2) + 'px');
        shelf.style.setProperty('--upper-angle', (upper - 90).toFixed(2) + 'deg');
        shelf.style.setProperty('--forearm-angle', (forearm - upper).toFixed(2) + 'deg');
        const blade = POSE.bladeRaised + (POSE.bladeLowered - POSE.bladeRaised) * progress;
        shelf.style.setProperty('--grip-angle', (90 - forearm + blade - lean).toFixed(2) + 'deg');
        for (const [name, start, end] of [['near', .76, .96], ['far', .84, 1]]) {
            const amount = still ? 0 : Math.max(0, Math.min(1, (progress - start) / (end - start)));
            const spread = 1 - (1 - amount) ** 3;
            shelf.style.setProperty('--blood-' + name + '-opacity', (Math.min(1, amount * 3) * .76).toFixed(3));
            shelf.style.setProperty('--blood-' + name + '-scale', (.18 + spread * .82).toFixed(4));
        }
    }
    const schedule = () => { if (visible && !frame)
        frame = requestAnimationFrame(paint); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { rootMargin: '80px' });
    observer.observe(shelf);
    const motionObserver = new MutationObserver(schedule);
    motionObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    reduced.addEventListener('change', schedule);
    dispose = () => { observer.disconnect(); motionObserver.disconnect(); bloodSize.disconnect(); cancelAnimationFrame(frame); removeEventListener('scroll', schedule); removeEventListener('resize', schedule); reduced.removeEventListener('change', schedule); };
}

Object.assign(__exports,{initShudderArt});
}
};
export function startSpooktoberRuntime(env){const cache=new Map();const require=name=>{if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);if(!factories[name])throw Error('Unknown Spooktober module: '+name);factories[name](env,require,exports);return exports};return require('app.js')}
