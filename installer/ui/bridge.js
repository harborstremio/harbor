const T = typeof window !== "undefined" ? window.__TAURI__ : null;

export function isNative() {
  return !!(T && T.core && typeof T.core.invoke === "function");
}

function taskbarProgress(pct) {
  if (!isNative()) return;
  try {
    const w = T.window.getCurrentWindow();
    if (pct == null) {
      w.setProgressBar({ status: "none" });
      return;
    }
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    w.setProgressBar({ status: "normal", progress: v });
  } catch {}
}

function taskbarError() {
  if (!isNative()) return;
  try {
    T.window.getCurrentWindow().setProgressBar({ status: "error" });
  } catch {}
}

export async function defaultInstallDir() {
  if (!isNative()) return "C:\\Program Files\\Harbor";
  try {
    return await T.core.invoke("default_install_dir");
  } catch {
    return "C:\\Harbor";
  }
}

export async function install(options) {
  const dest = options.dest;
  const desktopShortcut = !!options.desktopShortcut;
  const onProgress = options.onProgress || function () {};
  if (!isNative()) return Promise.reject(new Error("not native"));
  const unlisten = await T.event.listen("install://progress", function (e) {
    const p = e.payload || {};
    const pct = typeof p.pct === "number" ? p.pct : 0;
    taskbarProgress(pct);
    onProgress(pct, p.step || "");
  });
  taskbarProgress(0);
  try {
    await T.core.invoke("run_install", { dest: dest, desktopShortcut: desktopShortcut });
    taskbarProgress(null);
  } catch (e) {
    taskbarError();
    throw e;
  } finally {
    unlisten();
  }
}

export async function repair(options) {
  const dest = options.dest;
  const onProgress = options.onProgress || function () {};
  if (!isNative()) return Promise.reject(new Error("not native"));
  const unlisten = await T.event.listen("install://progress", function (e) {
    const p = e.payload || {};
    const pct = typeof p.pct === "number" ? p.pct : 0;
    taskbarProgress(pct);
    onProgress(pct, p.step || "");
  });
  taskbarProgress(0);
  try {
    const report = await T.core.invoke("run_repair", { dest: dest });
    taskbarProgress(null);
    return report;
  } catch (e) {
    taskbarError();
    throw e;
  } finally {
    unlisten();
  }
}

export async function launch(dest) {
  if (!isNative()) return;
  try {
    await T.core.invoke("launch_harbor", { dest: dest });
  } catch {}
}

export async function openExternal(url) {
  if (!isNative()) {
    try {
      window.open(url, "_blank", "noopener");
    } catch {}
    return;
  }
  try {
    await T.core.invoke("open_external", { url: url });
  } catch {}
}

export async function fetchChangelog() {
  if (!isNative()) {
    const res = await fetch("https://harbor.site/updates/versions-beta.json", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("changelog " + res.status);
    return await res.json();
  }
  const raw = await T.core.invoke("fetch_changelog");
  return JSON.parse(raw);
}

export async function pickFolder(current) {
  if (!isNative()) return null;
  try {
    const picked = await T.core.invoke("plugin:dialog|open", {
      options: {
        title: "Choose where Harbor is installed",
        directory: true,
        multiple: false,
        recursive: false,
        defaultPath: current || undefined,
      },
    });
    if (!picked) return null;
    return Array.isArray(picked) ? picked[0] || null : picked;
  } catch {
    return null;
  }
}

export async function freeSpaceAt(path) {
  if (!isNative()) return 0;
  try {
    return await T.core.invoke("free_space_at", { path: path });
  } catch {
    return 0;
  }
}

export async function existingInstall() {
  if (!isNative()) return null;
  try {
    return await T.core.invoke("existing_install");
  } catch {
    return null;
  }
}

export async function printTerms(doc) {
  if (!isNative()) return null;
  try {
    return await T.core.invoke("print_terms", { doc: doc });
  } catch {
    return null;
  }
}

export async function saveLicense() {
  if (!isNative()) return null;
  try {
    return await T.core.invoke("save_license");
  } catch {
    return null;
  }
}

export async function harborVersion() {
  if (!isNative()) return null;
  try {
    return await T.core.invoke("harbor_version");
  } catch {
    return null;
  }
}

export async function isUninstallMode() {
  if (!isNative()) return /[?&]uninstall\b/.test(location.search);
  try {
    return await T.core.invoke("is_uninstall_mode");
  } catch {
    return false;
  }
}

export async function uninstallFacts() {
  if (!isNative()) {
    return {
      dest: String.raw`C:\Users\you\AppData\Local\Harbor`,
      version: "0.9.121",
      program_bytes: 873725952,
      data_bytes: 506855424,
      data_dirs: [],
    };
  }
  try {
    return await T.core.invoke("uninstall_facts");
  } catch {
    return null;
  }
}

export async function runUninstall(options) {
  const dest = options.dest;
  const removeData = !!options.removeData;
  const onProgress = options.onProgress || function () {};

  if (!isNative()) {
    const fake = [
      [4, "Closing Harbor"],
      [22, "Removing shortcuts"],
      [34, "Removing the registry entry"],
      [58, "Removing harbor.exe"],
      [72, "Removing libmpv-2.dll"],
      [88, "Removing mpv.exe"],
      [100, "Done"],
    ];
    for (const [pct, label] of fake) {
      onProgress(pct, label);
      await new Promise((r) => window.setTimeout(r, 380));
    }
    return;
  }

  const unlisten = await T.event.listen("uninstall://progress", function (e) {
    const p = e.payload || {};
    const pct = typeof p.pct === "number" ? p.pct : 0;
    taskbarProgress(pct);
    onProgress(pct, p.step || "");
  });
  taskbarProgress(0);
  try {
    await T.core.invoke("run_uninstall", { dest: dest, removeData: removeData });
    taskbarProgress(null);
  } catch (e) {
    taskbarError();
    throw e;
  } finally {
    unlisten();
  }
}

export async function closeWindow() {
  if (!isNative()) return;
  try {
    await T.window.getCurrentWindow().close();
  } catch {}
}

export async function minimizeWindow() {
  if (!isNative()) return;
  try {
    await T.window.getCurrentWindow().minimize();
  } catch {}
}

export async function toggleMaximizeWindow() {
  if (!isNative()) return false;
  try {
    const w = T.window.getCurrentWindow();
    await w.toggleMaximize();
    return await w.isMaximized();
  } catch {
    return false;
  }
}

export async function installFacts() {
  if (!isNative()) {
    return {
      components: [
        { key: "harbor", bytes: 113868800 },
        { key: "mpv", bytes: 239075328 },
        { key: "ffmpeg", bytes: 202776576 },
        { key: "ytdlp", bytes: 18454528 },
        { key: "support", bytes: 9961472 },
      ],
      installed_bytes: 584596958,
      installer_bytes: 287309824,
      webview2_present: true,
      webview2_bytes: 136000000,
      free_bytes: 334963998720,
      dest: String.raw`C:\Users\you\AppData\Local\Harbor`,
      version: "0.9.121",
    };
  }
  return await T.core.invoke("install_facts");
}

export async function isMaximized() {
  if (!isNative()) return false;
  try {
    return await T.window.getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}

export async function onWindowResized(handler) {
  if (!isNative()) return () => {};
  try {
    return await T.window.getCurrentWindow().onResized(handler);
  } catch {
    return () => {};
  }
}
