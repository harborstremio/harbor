/* Pinned EmulatorJS 4.2.3 adapter. Runs on an isolated, token-scoped loopback origin. */
(async () => {
  const config = await (await fetch('config.json')).json();
  const send = (type, extra = {}) => parent.postMessage({ channel: 'harbor-retro', id: config.id, type, ...extra }, '*');
  const read = async name => { const r = await fetch(name); if (r.status === 404) return null; if (!r.ok) throw Error('save-read'); return new Uint8Array(await r.arrayBuffer()); };
  const write = async (name, bytes) => { if (!bytes?.byteLength) return; const r = await fetch(name, { method: 'POST', body: bytes }); if (!r.ok) throw Error('save-write'); };
  let started = false, saving = Promise.resolve(), exiting = false;
  const [save, resume] = await Promise.all([read('save'), read('resume')]);
  const persist = (withState = false) => {
    if (!started) return Promise.resolve();
    // Serialize snapshots: an older autosave must never overwrite a newer exit save.
    saving = saving.catch(() => {}).then(async () => {
      const manager = EJS_emulator.gameManager;
      await write('save', manager.getSaveFile());
      if (withState && manager.supportsStates()) await write('resume', manager.getState());
    });
    return saving;
  };
  const release = () => { if (!started) return; for (let port = 0; port < 4; port++) for (let button = 0; button < 24; button++) EJS_emulator.gameManager.simulateInput(port, button, 0); };
  const pause = () => { if (!started) return; release(); EJS_emulator.pause(); send('paused'); };
  const controls = () => {
    const bindings = {};
    for (let port = 0; port < 4; port++) { bindings[port] = {}; for (let button = 0; button < 24; button++) if (EJS_emulator.controls[port]?.[button]) bindings[port][button] = EJS_emulator.controls[port][button]; }
    send('controls-info', { bindings, selection: EJS_emulator.gamepadSelection.slice(0, 4) });
  };
  const failure = () => { pause(); send('save-error'); };
  window.EJS_player = '#game'; window.EJS_core = config.core;
  window.EJS_gameUrl = config.rom; window.EJS_gameName = 'game';
  window.EJS_pathtodata = 'data/'; window.EJS_color = '#eda657';
  window.EJS_startOnLoaded = true; window.EJS_disableAutoLang = false; window.EJS_language = 'en-US';
  window.EJS_forceLegacyCores = true; window.EJS_threads = false;
  window.EJS_backgroundColor = '#080a0b'; window.EJS_volume = 0.65;
  window.EJS_defaultOptions = { 'shader': 'disabled', 'save-state-location': 'download' };
  window.EJS_Buttons = { playPause: false, fullscreen: false, exitEmulation: false, netplay: false, saveState: false, loadState: false, saveSavFiles: false, loadSavFiles: false, screenRecord: false, screenshot: false };
  window.EJS_onGameStart = async () => {
    try {
      const manager = EJS_emulator.gameManager;
      if (save?.length) {
        const path = manager.getSaveFilePath();
        let directory = '';
        for (const part of path.split('/').slice(0, -1).filter(Boolean)) { directory += '/' + part; if (!manager.FS.analyzePath(directory).exists) manager.FS.mkdir(directory); }
        manager.FS.writeFile(path, save); manager.loadSaveFiles();
      }
      if (resume?.length && manager.supportsStates()) manager.loadState(resume);
      started = true; send('started'); controls(); EJS_emulator.elements.parent.focus();
    } catch { send('load-error'); EJS_emulator.pause(); }
  };
  window.addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== parent || message?.channel !== 'harbor-retro' || message.id !== config.id) return;
    try {
      if (message.type === 'pause') { pause(); await persist(); }
      else if (message.type === 'input' && started && Number.isInteger(message.button) && message.button >= 0 && message.button <= 15) EJS_emulator.gameManager.simulateInput(0, message.button, message.pressed === true ? 1 : 0);
      else if (message.type === 'play' && started) { release(); EJS_emulator.controlMenu.style.display = 'none'; EJS_emulator.play(); send('playing'); EJS_emulator.elements.parent.focus(); }
      else if (message.type === 'controls' && started) controls();
      else if (message.type === 'viewer' && started) {
        if (Number.isFinite(message.volume)) { EJS_emulator.volume = Math.max(0, Math.min(100, message.volume)) / 100; EJS_emulator.setVolume(EJS_emulator.volume); }
        EJS_emulator.canvas.style.imageRendering = message.sharp === true ? 'pixelated' : 'auto';
      }
      else if (message.type === 'controls-set' && started && message.bindings && typeof message.bindings === 'object') {
        release();
        for (let port = 0; port < 4; port++) for (let button = 0; button < 24; button++) {
          const binding = message.bindings[port]?.[button];
          if (!binding || typeof binding !== 'object') continue;
          const clean = {};
          if (Number.isInteger(binding.value) && binding.value >= 0 && binding.value <= 255) clean.value = binding.value;
          if (typeof binding.value2 === 'string' && binding.value2.length < 64 || Number.isInteger(binding.value2) && binding.value2 >= 0 && binding.value2 < 64) clean.value2 = binding.value2;
          EJS_emulator.controls[port] ??= {}; EJS_emulator.controls[port][button] = clean;
        }
        EJS_emulator.setupKeys(); controls();
      }
      else if (message.type === 'controls-reset' && started) { EJS_emulator.controls = structuredClone(EJS_emulator.defaultControllers); EJS_emulator.setupKeys(); controls(); }
      else if (message.type === 'controller-port' && started && Number.isInteger(message.port) && message.port >= 0 && message.port < 4 && typeof message.device === 'string') {
        const device = EJS_emulator.gamepad.gamepads.find(p => `${p.id}_${p.index}` === message.device);
        if (message.device !== '' && !device) return;
        release();
        EJS_emulator.gamepadSelection = EJS_emulator.gamepadSelection.map((id, port) => port === message.port ? message.device : id === message.device ? '' : id);
        EJS_emulator.updateGamepadLabels(); controls();
      }
      else if (message.type === 'save' && started) { await write('state', EJS_emulator.gameManager.getState()); send('saved'); }
      else if (message.type === 'load' && started) { const state = await read('state'); if (state?.length) { EJS_emulator.gameManager.loadState(state); send('loaded'); } else send('no-save'); }
      else if (message.type === 'exit' && !exiting) { exiting = true; pause(); await persist(true); send('closed'); }
    } catch { exiting = false; failure(); }
  });
  document.addEventListener('keydown', event => {
    if (['Escape', 'F1', 'F2', 'F4'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) { if (event.key === 'Escape' || event.key === 'F1') pause(); else send('shortcut', { action: event.key === 'F2' ? 'save' : 'load' }); }
    } else if (started && EJS_emulator.paused) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('blur', () => { release(); });
  let lastActivity = 0;
  document.addEventListener('pointermove', () => { const now = performance.now(); if (now - lastActivity > 250) { lastActivity = now; send('activity'); } }, { passive: true });
  for (const type of ['gamepadconnected', 'gamepaddisconnected']) window.addEventListener(type, () => setTimeout(() => { if (started) controls(); }, 250));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); void persist().catch(failure); } });
  setInterval(() => { if (!exiting) void persist().catch(failure); }, 15000);
  // Harbor installs a verified, pinned build. Suppress the runtime's localhost-only
  // update probe; the isolated player deliberately has no outbound network access.
  await Promise.all([
    new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'data/emulator.min.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); }),
    new Promise((resolve, reject) => { const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = 'data/emulator.min.css'; style.onload = resolve; style.onerror = reject; document.head.append(style); }),
  ]);
  EmulatorJS.prototype.checkForUpdates = function() {};
  const gamepadEvent = EmulatorJS.prototype.gamepadEvent;
  EmulatorJS.prototype.gamepadEvent = function(event) { if (!this.paused) gamepadEvent.call(this, event); };
  window.EJS_emulator = new EmulatorJS('#game', { system: EJS_core, gameUrl: EJS_gameUrl, gameName: EJS_gameName, dataPath: EJS_pathtodata, color: EJS_color, startOnLoad: true, forceLegacyCores: true, threads: false, backgroundColor: EJS_backgroundColor, volume: EJS_volume, defaultOptions: EJS_defaultOptions, buttonOpts: EJS_Buttons });
  EJS_emulator.on('start', EJS_onGameStart);
  setTimeout(() => { if (!started) send('load-error'); }, 60000);
})().catch(() => parent.postMessage({ channel: 'harbor-retro', type: 'load-error' }, '*'));
