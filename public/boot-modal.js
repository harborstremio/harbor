// Modal-overlay windows open with `?harbor-modal=1` and must not flash the boot
// splash. This runs before the app bundle, so it lives outside index.html: an
// inline script is blocked by the Content-Security-Policy the desktop webview
// and the browser build both apply (`script-src 'self'`, no 'unsafe-inline').
(function () {
  try {
    var p = new URLSearchParams(window.location.search);
    if (p.get("harbor-modal") === "1") {
      var s = document.createElement("style");
      s.textContent = "#harbor-boot{display:none !important}";
      document.head.appendChild(s);
    }
  } catch (e) {}
})();
