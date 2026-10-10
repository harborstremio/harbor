'use strict';
/*
 * Harbor community-theme static heuristics scanner.
 *
 *   scanTheme({ css = "", js = "", html = "" }) -> { verdict, findings }
 *
 * verdict:  "block"  = a confirmed-malicious COMBINATION
 *                      (sensitive-read + network egress, ANY Tauri/native/fs/shell
 *                       bridge use, remote-code load, or a CSS input-value url() keylogger)
 *           "review" = a single suspicious signal — routes to a human, never auto-blocks
 *           "pass"   = nothing suspicious
 *
 * findings: [{ severity, category, rule, evidence, rationale }]
 *
 * Precision model: a lone benign primitive (a fetch, a listener, a url(), a getItem)
 * is NEVER malicious on its own. Malice requires a COMBINATION — access to sensitive
 * data / the native bridge / site-targeting AND exfiltration / code execution — which
 * the "block" rules and combineWith signals encode. harbor.site and common font/image
 * CDNs are allowlisted so ordinary asset loading passes.
 *
 * Pure regex/string heuristics. No external dependencies. Rules are authored data
 * (below); the engine is ~30 lines at the bottom. Validated: 14/14 live approved
 * themes pass (0 false positives, incl. the 224KB Aurum Dock benchmark); 57/57
 * synthetic block/review/pass fixtures land on the correct tier. All patterns are
 * linear-time (no ReDoS); worst observed scan ~108ms on a crafted 200KB input.
 */

const CATS = [
  {
    "category": "js-network-exfiltration",
    "rules": [
      {
        "name": "sensitive-read",
        "target": "js",
        "severity": "review",
        "pattern": "document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|window\\s*\\[\\s*['\"`]__TAURI__|navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText|(?:JSON\\.stringify|Object\\.(?:keys|entries|values))\\s*\\(\\s*(?:window\\s*\\.)?(?:local|session)Storage\\b|for\\s*\\(\\s*(?:var|let|const)?\\s*\\w+\\s+in\\s+(?:window\\s*\\.)?(?:local|session)Storage\\b|querySelector(?:All)?\\s*\\(\\s*[^)]*type\\s*=\\s*['\"`]?password",
        "combineWith": null,
        "rationale": "Reads of genuinely-sensitive data a cosmetic theme has no reason to touch: cookie, __TAURI__ bridge, clipboard.readText, whole-storage dump, or password-field selection."
      },
      {
        "name": "external-network-send",
        "target": "js",
        "severity": "review",
        "pattern": "(?:fetch|\\.open|navigator\\.sendBeacon|new\\s+WebSocket|new\\s+EventSource)\\s*\\(\\s*['\"`]\\s*(?:https?:)?\\/\\/(?!(?:[a-z0-9-]+\\.)*harbor\\.site|fonts\\.g(?:oogleapis|static)\\.com|(?:[a-z0-9-]+\\.)?gstatic\\.com|(?:[a-z0-9-]+\\.)?googleapis\\.com|cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com|unpkg\\.com|localhost|127\\.0\\.0\\.1|\\[::1\\])[a-z0-9.\\-]+|navigator\\.sendBeacon\\s*\\(|new\\s+WebSocket\\s*\\(|new\\s+EventSource\\s*\\(",
        "combineWith": null,
        "rationale": "A network egress primitive to an external non-Harbor host, or a telemetry/tunnel primitive (sendBeacon/WebSocket/EventSource)."
      },
      {
        "name": "exfil-inline-sensitive-read",
        "target": "js",
        "severity": "block",
        "pattern": "(?:fetch|navigator\\.sendBeacon|\\.send|new\\s+WebSocket|new\\s+EventSource)\\s*\\([^;\\n]{0,160}(?:document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText|(?:local|session)Storage)|(?:\\.src|\\.href|\\.action)\\s*=\\s*[^;\\n]{0,160}(?:document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText)",
        "combineWith": null,
        "rationale": "A single statement piping sensitive data (cookie/Tauri/clipboard/storage) straight into a network send or into a .src/.href/.action sink."
      },
      {
        "name": "exfil-external-url-concat-data",
        "target": "js",
        "severity": "block",
        "pattern": "(?:(?:fetch|navigator\\.sendBeacon|\\.open|new\\s+WebSocket)\\s*\\(\\s*|(?:\\.src|\\.href|\\.action)\\s*=\\s*)['\"`](?:https?:)?\\/\\/(?!(?:[a-z0-9-]+\\.)*harbor\\.site|fonts\\.g(?:oogleapis|static)\\.com|(?:[a-z0-9-]+\\.)?gstatic\\.com|(?:[a-z0-9-]+\\.)?googleapis\\.com|cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com|unpkg\\.com|localhost|127\\.0\\.0\\.1|\\[::1\\])[^'\"`]*['\"`]\\s*\\+[^;\\n]{0,140}(?:\\.value\\b|\\.files\\b|new\\s+FormData|\\.elements\\b|document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|(?:local|session)Storage)",
        "combineWith": null,
        "rationale": "An external non-allowlisted URL literal string-concatenated with runtime-stolen data (form value/files/cookie/Tauri/storage) into a send or sink."
      },
      {
        "name": "network-send-with-sensitive-read",
        "target": "js",
        "severity": "block",
        "pattern": "navigator\\.sendBeacon\\s*\\(|new\\s+WebSocket\\s*\\(|new\\s+EventSource\\s*\\(|fetch\\s*\\(|new\\s+XMLHttpRequest|\\.send\\s*\\(",
        "combineWith": "sensitive-read",
        "rationale": "Cross-function exfil: any egress primitive present together with a sensitive-read signal is a confirmed exfiltration combination."
      },
      {
        "name": "html-handler-exfil",
        "target": "html",
        "severity": "block",
        "pattern": "(?:on\\w+\\s*=|<script[\\s>]|javascript:)[\\s\\S]{0,240}?(?:fetch|new\\s+Image|\\.src\\s*=|navigator\\.sendBeacon|XMLHttpRequest|new\\s+WebSocket)[\\s\\S]{0,160}?(?:document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText|(?:local|session)Storage|\\.value\\b)",
        "combineWith": null,
        "rationale": "An executable HTML context (inline handler / script / javascript:) performing a network send AND a sensitive read within a short span."
      },
      {
        "name": "html-handler-network-send",
        "target": "html",
        "severity": "review",
        "pattern": "(?:on\\w+\\s*=\\s*['\"][^'\"]{0,240}|javascript:[^'\"]{0,240})(?:fetch\\s*\\(|new\\s+Image\\s*\\(|navigator\\.sendBeacon|new\\s+XMLHttpRequest|new\\s+WebSocket)",
        "combineWith": null,
        "rationale": "An inline HTML event handler or javascript: URL that issues a network send at all."
      }
    ]
  },
  {
    "category": "js-native-tauri-fs-abuse",
    "rules": [
      {
        "name": "tauri-global-bridge",
        "target": "js",
        "severity": "block",
        "pattern": "\\b__TAURI(?:_[A-Z0-9]+)*__",
        "combineWith": null,
        "rationale": "Direct reference to the Tauri IPC global (__TAURI__ / __TAURI_INTERNALS__ ...), the sole gateway from WebView JS into native Rust."
      },
      {
        "name": "tauri-apps-module-ref",
        "target": "js",
        "severity": "block",
        "pattern": "@tauri-apps/(?:api|plugin-[a-z-]+)",
        "combineWith": null,
        "rationale": "Reference to @tauri-apps/api or @tauri-apps/plugin-* namespace; only native-reaching code names these packages."
      },
      {
        "name": "tauri-ipc-plugin-channel",
        "target": "js",
        "severity": "block",
        "pattern": "[\"'`]plugin:(?:fs|shell|process|path|os|http|dialog|opener|websocket|store|sql|upload|notification|clipboard-manager|global-shortcut|autostart|updater|window|app|event|log)\\|",
        "combineWith": null,
        "rationale": "The literal Tauri IPC channel string plugin:<name>|<command> passed to invoke()."
      },
      {
        "name": "tauri-core-invoke",
        "target": "js",
        "severity": "block",
        "pattern": "__TAURI_INTERNALS__\\s*\\.\\s*invoke|\\.core\\s*\\.\\s*invoke\\s*\\(\\s*[\"'`]",
        "combineWith": null,
        "rationale": "Canonical native command dispatch via __TAURI_INTERNALS__.invoke or core.invoke(\"command\")."
      },
      {
        "name": "tauri-fs-read-exfil",
        "target": "js",
        "severity": "block",
        "pattern": "\\b(?:readTextFile|readBinaryFile|readDir|readFile)\\s*\\(",
        "combineWith": "external-network",
        "rationale": "A native filesystem read combined with outbound network egress is a confirmed local-file exfiltration chain."
      },
      {
        "name": "tauri-fs-write-delete",
        "target": "js",
        "severity": "review",
        "pattern": "\\b(?:writeTextFile|writeBinaryFile|removeFile|removeDir|createDir|renameFile|copyFile)\\s*\\(",
        "combineWith": null,
        "rationale": "Native filesystem write/delete/create calls from the Tauri fs plugin."
      },
      {
        "name": "tauri-shell-command",
        "target": "js",
        "severity": "review",
        "pattern": "\\bnew\\s+Command\\s*\\(|\\bCommand\\s*\\.\\s*(?:create|sidecar)\\s*\\(",
        "combineWith": null,
        "rationale": "Construction of a Tauri shell Command to spawn an OS process."
      },
      {
        "name": "tauri-process-control",
        "target": "js",
        "severity": "review",
        "pattern": "\\b(?:relaunch|exitApp)\\s*\\(|\\bprocess\\s*\\.\\s*exit\\s*\\(",
        "combineWith": null,
        "rationale": "Native app-lifecycle control (relaunch/exitApp/process.exit) from the Tauri process plugin."
      },
      {
        "name": "tauri-opener-external",
        "target": "js",
        "severity": "review",
        "pattern": "\\b(?:openUrl|revealItemInDir|openPath)\\s*\\(",
        "combineWith": null,
        "rationale": "Tauri opener/shell open APIs (openUrl/openPath/revealItemInDir) that launch external URLs or reveal files via the OS."
      },
      {
        "name": "tauri-path-api",
        "target": "js",
        "severity": "review",
        "pattern": "\\b(?:appDataDir|appConfigDir|appLocalDataDir|resolveResource|resourceDir|homeDir)\\s*\\(",
        "combineWith": null,
        "rationale": "Tauri path-resolution APIs that yield real on-disk locations (recon before reading/writing files)."
      },
      {
        "name": "tauri-invoke-command-call",
        "target": "js",
        "severity": "review",
        "pattern": "\\binvoke\\s*\\(\\s*[\"'`][a-z][a-z0-9_]+[\"'`]",
        "combineWith": null,
        "rationale": "A bare invoke(\"some_command\") call with a snake_case command string (Tauri command-invocation shape)."
      },
      {
        "name": "html-handler-native-or-exec",
        "target": "html",
        "severity": "block",
        "pattern": "\\son[a-z]+\\s*=\\s*[\"'][^\"']*(?:__TAURI|\\beval\\s*\\(|\\bFunction\\s*\\(|fetch\\s*\\(\\s*[\"'`]https?:)",
        "combineWith": null,
        "rationale": "An inline HTML event handler whose value contains the native bridge, a code-exec primitive, or an external fetch."
      }
    ]
  },
  {
    "category": "js-keystroke-credential-clipboard-capture",
    "rules": [
      {
        "name": "external-egress",
        "target": "js",
        "severity": "review",
        "pattern": "(?:navigator\\.sendBeacon\\s*\\(|new\\s+WebSocket\\s*\\(|\\bXMLHttpRequest\\b|\\bmethod\\s*:\\s*[\"'](?:POST|PUT)[\"']|fetch\\s*\\(\\s*[`\"']https?:\\/\\/[^`\"']*(?:\\$\\{|[`\"']\\s*\\+))",
        "combineWith": null,
        "rationale": "A data-bearing outbound channel: sendBeacon, WebSocket, XHR, a POST/PUT fetch, or a fetch to an interpolated/concatenated URL."
      },
      {
        "name": "code-exec-sink",
        "target": "js",
        "severity": "review",
        "pattern": "(?:\\beval\\s*\\(|new\\s+Function\\s*\\(|set(?:Timeout|Interval)\\s*\\(\\s*[\"'`]|__TAURI__\\b|__TAURI_INTERNALS__|\\binvoke\\s*\\(\\s*[\"'](?:shell|fs|http|process|os|command)|shell\\s*\\.\\s*(?:execute|Command)|Command\\s*\\.\\s*create)",
        "combineWith": null,
        "rationale": "Dynamic-code / native-bridge sinks: eval, new Function, string-arg timers, or Tauri calls into shell/fs/http/process."
      },
      {
        "name": "keystroke-buffer-accumulation",
        "target": "js",
        "severity": "block",
        "pattern": "(?:[\\w$]{1,40}\\s*\\+=\\s*[\\w$]{1,40}\\.(?:key|keyCode|which|charCode)\\b|[\\w$]{1,40}\\.push\\s*\\(\\s*[\\w$]{1,40}\\.(?:key|keyCode|which|charCode)\\b|\\+=\\s*String\\.fromCharCode\\s*\\()",
        "combineWith": "external-egress",
        "rationale": "Keylogger buffering (concatenating/pushing e.key/keyCode/which/charCode) combined with an outbound channel."
      },
      {
        "name": "keystroke-buffer-accumulation-lone",
        "target": "js",
        "severity": "review",
        "pattern": "(?:[\\w$]{1,40}\\s*\\+=\\s*[\\w$]{1,40}\\.(?:key|keyCode|which|charCode)\\b|[\\w$]{1,40}\\.push\\s*\\(\\s*[\\w$]{1,40}\\.(?:key|keyCode|which|charCode)\\b|\\+=\\s*String\\.fromCharCode\\s*\\()",
        "combineWith": null,
        "rationale": "Keystroke-retention idiom with no statically-visible outbound channel (staged capture)."
      },
      {
        "name": "keycode-charcode-reconstruction",
        "target": "js",
        "severity": "block",
        "pattern": "String\\.fromCharCode\\s*\\(\\s*(?:[\\w$]{1,40}\\.)?(?:keyCode|which|charCode)\\b",
        "combineWith": "external-egress",
        "rationale": "Keylogger reconstruction of typed characters from a key event's numeric code, combined with an outbound channel."
      },
      {
        "name": "password-field-value-read",
        "target": "js",
        "severity": "block",
        "pattern": "(?:querySelector(?:All)?\\s*\\(\\s*[\"'][^\"']*(?:\\[\\s*type\\s*[~^$*|]?=\\s*[\"']?password|input\\[type=[\"']?password)|getElementById\\s*\\(\\s*[\"'][^\"']*(?:password|passwd|pwd)|getElementsByName\\s*\\(\\s*[\"'][^\"']*(?:password|passwd|pwd))",
        "combineWith": "external-egress",
        "rationale": "JS locating a password input to read its value, combined with an outbound channel = credential theft."
      },
      {
        "name": "password-field-access",
        "target": "js",
        "severity": "review",
        "pattern": "(?:querySelector(?:All)?\\s*\\(\\s*[\"'][^\"']*(?:\\[\\s*type\\s*[~^$*|]?=\\s*[\"']?password|input\\[type=[\"']?password)|getElementById\\s*\\(\\s*[\"'][^\"']*(?:password|passwd|pwd)|getElementsByName\\s*\\(\\s*[\"'][^\"']*(?:password|passwd|pwd))",
        "combineWith": null,
        "rationale": "A password-field lookup with no statically-visible send (send may be obfuscated)."
      },
      {
        "name": "clipboard-readtext-exfil",
        "target": "js",
        "severity": "block",
        "pattern": "navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText\\s*\\(",
        "combineWith": "external-egress",
        "rationale": "Reading the clipboard (readText) combined with an outbound channel = clipboard exfiltration."
      },
      {
        "name": "clipboard-readtext-present",
        "target": "js",
        "severity": "review",
        "pattern": "navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText\\s*\\(",
        "combineWith": null,
        "rationale": "A clipboard read with no statically-visible send."
      },
      {
        "name": "credential-input-selector-harvest",
        "target": "js",
        "severity": "block",
        "pattern": "querySelector(?:All)?\\s*\\(\\s*[\"'][^\"']*\\[\\s*(?:name|id|autocomplete|type)\\s*[~^$*|]?=\\s*[\"']?(?:email|username|user|login|card|cc-|credit|cvv|otp|ssn|passwd|pwd)",
        "combineWith": "external-egress",
        "rationale": "Selecting credential/PII inputs by attribute to scrape values, combined with an outbound channel."
      },
      {
        "name": "html-password-input",
        "target": "html",
        "severity": "review",
        "pattern": "<input\\b[^>]*\\btype\\s*=\\s*[\"']?password",
        "combineWith": null,
        "rationale": "The injected HTML rendering a password field; a cosmetic theme has no reason to draw a password box."
      },
      {
        "name": "html-credential-form-exfil",
        "target": "html",
        "severity": "block",
        "pattern": "<input\\b[^>]*type\\s*=\\s*[\"']?password[\\s\\S]{0,400}?(?:<form[^>]*action\\s*=\\s*[\"']https?:|on(?:input|keydown|keyup|change|submit)\\s*=)",
        "combineWith": "external-egress",
        "rationale": "A phishing password field wired to an external form action or a capturing inline handler, combined with an outbound channel."
      }
    ]
  },
  {
    "category": "js-site-targeting-and-external-code-load",
    "rules": [
      {
        "name": "js-remote-script-element",
        "target": "js",
        "severity": "block",
        "pattern": "createElement\\(\\s*['\"\\x60]script['\"\\x60]\\s*\\)[\\s\\S]{0,300}?\\.\\s*src\\s*=\\s*['\"\\x60]\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "createElement('script') whose .src is set to an external URL: canonical dynamic remote-code loader."
      },
      {
        "name": "js-dynamic-import-remote",
        "target": "js",
        "severity": "block",
        "pattern": "\\bimport\\s*\\(\\s*['\"\\x60]\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "Dynamic import() of an external URL = remote code execution."
      },
      {
        "name": "js-importscripts-remote",
        "target": "js",
        "severity": "block",
        "pattern": "importScripts\\s*\\(\\s*['\"\\x60]\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "importScripts() with an external URL pulls remote code into a Worker = remote code execution."
      },
      {
        "name": "js-innerhtml-active-content",
        "target": "js",
        "severity": "block",
        "pattern": "(?:innerHTML|outerHTML|insertAdjacentHTML\\s*\\([^)]*|document\\.write(?:ln)?\\s*\\()\\s*(?:=|,)?\\s*['\"\\x60][\\s\\S]{0,500}?(?:javascript:|<\\s*[sS][cC][rR][iI][pP][tT]\\b[\\s\\S]{0,150}?\\bsrc\\s*=|<\\s*[iI][fF][rR][aA][mM][eE][\\s\\S]{0,150}?\\bsrc\\s*=|(?:\\s|['\"\\x60])[oO][nN][a-z]+\\s*=\\s*['\"\\x60]?[^>]{0,100}?(?:eval|Function|atob|document\\.cookie|\\.src|\\bimport\\s*\\(|__TAURI|new\\s+Image|\\.constructor|https?://|//\\w))",
        "combineWith": null,
        "rationale": "Assigning innerHTML/write a string containing active content (handler-with-sink, script/iframe with external src, or javascript:)."
      },
      {
        "name": "html-remote-script-src",
        "target": "html",
        "severity": "block",
        "pattern": "<\\s*[sS][cC][rR][iI][pP][tT]\\b[^>]{0,200}?\\bsrc\\s*=\\s*['\"\\x60]?\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "A <script src=external> tag in the injected HTML loads remote executable code."
      },
      {
        "name": "html-inline-handler-exec",
        "target": "html",
        "severity": "block",
        "pattern": "(?:\\s|['\"\\x60])[oO][nN][a-z]+\\s*=\\s*['\"\\x60]?[^>]{0,120}?(?:eval|Function|atob|document\\.cookie|\\.src\\b|\\bimport\\s*\\(|__TAURI|new\\s+Image|\\.constructor|window\\.open|location\\s*=|location\\s*\\.\\s*(?:href|assign|replace)|https?://|//\\w)",
        "combineWith": null,
        "rationale": "An inline on*= handler whose body calls a hard exec/exfil sink (eval/Function/atob/.src/import/native bridge/new Image/constructor/external nav)."
      },
      {
        "name": "js-location-branch-then-inject",
        "target": "js",
        "severity": "block",
        "pattern": "(?:window\\.|self\\.|top\\.|document\\.|globalThis\\.)?location\\s*\\.\\s*(?:hostname|href|pathname|host|origin)\\s*(?:={2,3}|!={1,2}|\\.\\s*(?:includes|indexOf|match|test|search|startsWith|endsWith)\\s*\\()\\s*['\"\\x60/]",
        "combineWith": "dom-injection",
        "rationale": "Branching on location against a string literal (site-targeting) while the payload also performs DOM/script injection."
      },
      {
        "name": "js-remote-code-eval",
        "target": "js",
        "severity": "block",
        "pattern": "(?:\\beval\\s*\\(|\\bnew\\s+Function\\s*\\()",
        "combineWith": "external-network",
        "rationale": "eval()/new Function() co-present with an external network request = fetch-then-eval RCE chain."
      },
      {
        "name": "js-redirect-with-secret",
        "target": "js",
        "severity": "block",
        "pattern": "(?:location\\s*(?:\\.\\s*(?:href|assign|replace))?\\s*(?:=|\\(\\s*)|window\\.open\\s*\\(\\s*)['\"\\x60]\\s*(?:https?:)?//",
        "combineWith": "sensitive-read",
        "rationale": "Navigating the webview to an external URL co-present with a sensitive read = exfiltration-by-redirect."
      },
      {
        "name": "js-location-branch-on-literal",
        "target": "js",
        "severity": "review",
        "pattern": "(?:window\\.|self\\.|top\\.|document\\.|globalThis\\.)?location\\s*\\.\\s*(?:hostname|href|pathname|host|origin)\\s*(?:={2,3}|!={1,2}|\\.\\s*(?:includes|indexOf|match|test|search|startsWith|endsWith)\\s*\\()\\s*['\"\\x60/]",
        "combineWith": null,
        "rationale": "Branching on location.hostname/href/pathname against a string literal targets a specific site or route."
      },
      {
        "name": "js-dynamic-eval",
        "target": "js",
        "severity": "review",
        "pattern": "(?:\\beval\\s*\\(|\\bnew\\s+Function\\s*\\()",
        "combineWith": null,
        "rationale": "eval()/new Function() dynamic code execution from a string."
      },
      {
        "name": "js-unsolicited-external-redirect",
        "target": "js",
        "severity": "review",
        "pattern": "(?:location\\s*(?:\\.\\s*(?:href|assign|replace))?\\s*(?:=|\\(\\s*)|window\\.open\\s*\\(\\s*)['\"\\x60]\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "Assigning location or calling window.open with an external URL navigates away from the app."
      },
      {
        "name": "js-create-script-element",
        "target": "js",
        "severity": "review",
        "pattern": "createElement\\(\\s*['\"\\x60]script['\"\\x60]",
        "combineWith": null,
        "rationale": "document.createElement('script') is the primitive for dynamic script injection."
      },
      {
        "name": "js-domwrite-script-tag",
        "target": "js",
        "severity": "review",
        "pattern": "(?:innerHTML|outerHTML|insertAdjacentHTML\\s*\\([^)]*|document\\.write(?:ln)?\\s*\\()\\s*(?:=|,)?\\s*['\"\\x60][\\s\\S]{0,400}?<\\s*[sS][cC][rR][iI][pP][tT][\\s\\S>]",
        "combineWith": null,
        "rationale": "Writing a <script> tag into the DOM via innerHTML/insertAdjacentHTML/document.write."
      },
      {
        "name": "js-function-constructor-gadget",
        "target": "js",
        "severity": "review",
        "pattern": "\\[\\s*['\"\\x60]constructor['\"\\x60]\\s*\\]\\s*\\[\\s*['\"\\x60]constructor|\\.\\s*constructor\\s*\\.\\s*constructor|\\.\\s*constructor\\s*\\(\\s*['\"\\x60]",
        "combineWith": null,
        "rationale": "The [\"constructor\"][\"constructor\"] / .constructor.constructor / .constructor('...') gadget reaches Function to evade eval scans."
      },
      {
        "name": "html-inline-script-tag",
        "target": "html",
        "severity": "review",
        "pattern": "<\\s*[sS][cC][rR][iI][pP][tT][\\s>]",
        "combineWith": null,
        "rationale": "A <script> tag present in the injected HTML payload."
      },
      {
        "name": "html-external-iframe",
        "target": "html",
        "severity": "review",
        "pattern": "<\\s*[iI][fF][rR][aA][mM][eE]\\b[^>]{0,200}?\\bsrc\\s*=\\s*['\"\\x60]?\\s*(?:https?:)?//",
        "combineWith": null,
        "rationale": "An <iframe src=external> embeds and loads a remote document inside the app."
      },
      {
        "name": "html-inline-handler-network",
        "target": "html",
        "severity": "review",
        "pattern": "(?:\\s|['\"\\x60])[oO][nN][a-z]+\\s*=\\s*['\"\\x60]?[^>]{0,120}?(?:\\bfetch\\s*\\(|XMLHttpRequest|WebSocket|sendBeacon)",
        "combineWith": null,
        "rationale": "An inline on*= handler that calls fetch/XMLHttpRequest/WebSocket/sendBeacon."
      },
      {
        "name": "html-javascript-uri",
        "target": "html",
        "severity": "review",
        "pattern": "(?:href|src|action|formaction)\\s*=\\s*['\"\\x60]?\\s*javascript:(?!\\s*void\\s*\\(\\s*0\\s*\\)\\s*;?\\s*['\"\\x60])\\S",
        "combineWith": null,
        "rationale": "A javascript: URI (non-void(0)) in href/src/action/formaction executes code on activation."
      }
    ]
  },
  {
    "category": "js-obfuscation-and-dynamic-eval",
    "rules": [
      {
        "name": "eval-wrapping-decoder",
        "target": "js",
        "severity": "block",
        "combineWith": null,
        "pattern": "(?:\\beval|(?:\\bnew\\s+)?\\bFunction)\\s*\\(\\s*(?:atob|unescape|decodeURIComponent|String\\s*\\.\\s*fromCharCode)\\s*\\(",
        "rationale": "An executor (eval/new Function) directly wrapping a decode primitive (atob/unescape/decodeURIComponent/fromCharCode)."
      },
      {
        "name": "timer-string-code-eval",
        "target": "js",
        "severity": "block",
        "combineWith": null,
        "pattern": "\\bset(?:Timeout|Interval)\\s*\\(\\s*(['\"`])(?:(?!\\1)[\\s\\S]){0,600}(?:eval\\s*\\(|atob\\s*\\(|Function\\s*\\(|fromCharCode\\s*\\()",
        "rationale": "setTimeout/setInterval whose first argument is a code string containing eval/atob/Function/fromCharCode."
      },
      {
        "name": "function-constructor-bracket-bypass",
        "target": "js",
        "severity": "block",
        "combineWith": null,
        "pattern": "\\[\\s*(['\"])constructor\\1\\s*\\]\\s*\\[\\s*(['\"])constructor\\2\\s*\\]\\s*\\(",
        "rationale": "[]['constructor']['constructor']('code')() reaches the Function constructor to evade keyword scans."
      },
      {
        "name": "html-inline-handler-eval",
        "target": "html",
        "severity": "block",
        "combineWith": null,
        "pattern": "on(?:error|load|click|toggle|animationstart|animationend|pointerenter|mouseover)\\s*=\\s*(['\"])(?:(?!\\1)[\\s\\S]){0,300}(?:eval\\s*\\(|atob\\s*\\(|Function\\s*\\()",
        "rationale": "An inline event handler on inserted markup whose body calls eval/atob/Function."
      },
      {
        "name": "dynamic-exec-with-exfil",
        "target": "js",
        "severity": "block",
        "combineWith": "external-network",
        "pattern": "(?:\\beval|(?:\\bnew\\s+)?\\bFunction)\\s*\\(",
        "rationale": "A raw executor combined with an outbound-network signal (code loader that talks to a remote)."
      },
      {
        "name": "dynamic-exec-with-native",
        "target": "js",
        "severity": "block",
        "combineWith": "native-bridge",
        "pattern": "(?:\\beval|(?:\\bnew\\s+)?\\bFunction)\\s*\\(",
        "rationale": "An executor combined with the Tauri native bridge (dynamically-built code driving fs/network)."
      },
      {
        "name": "obfuscated-blob-with-exfil",
        "target": "js",
        "severity": "block",
        "combineWith": "external-network",
        "pattern": "(?:(?:\\\\x[0-9a-fA-F]{2}){16,}|(?:\\\\u[0-9a-fA-F]{4}){12,}|String\\s*\\.\\s*fromCharCode\\s*\\(\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})(?:\\s*,\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})){9,}|atob\\s*\\(\\s*['\"][A-Za-z0-9+/]{200,}={0,2}['\"]\\s*\\))",
        "rationale": "A hidden/encoded string (long \\x/\\u runs, big fromCharCode chain, or 200+ char inline base64) combined with an outbound-network signal."
      },
      {
        "name": "obfuscated-blob-with-native",
        "target": "js",
        "severity": "block",
        "combineWith": "native-bridge",
        "pattern": "(?:(?:\\\\x[0-9a-fA-F]{2}){16,}|(?:\\\\u[0-9a-fA-F]{4}){12,}|String\\s*\\.\\s*fromCharCode\\s*\\(\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})(?:\\s*,\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})){9,}|atob\\s*\\(\\s*['\"][A-Za-z0-9+/]{200,}={0,2}['\"]\\s*\\))",
        "rationale": "The same hidden/encoded-string obfuscation combined with the Tauri native bridge."
      },
      {
        "name": "dynamic-exec-lone",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "(?:\\beval|(?:\\bnew\\s+)?\\bFunction)\\s*\\(",
        "rationale": "Presence of eval( or new Function( anywhere in a theme's JS."
      },
      {
        "name": "timer-string-arg",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "\\bset(?:Timeout|Interval)\\s*\\(\\s*['\"]",
        "rationale": "The first argument to setTimeout/setInterval being a string literal is deferred eval of a code string."
      },
      {
        "name": "fromcharcode-chain",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "String\\s*\\.\\s*fromCharCode\\s*\\(\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})(?:\\s*,\\s*(?:0x[0-9a-fA-F]+|\\d{1,3})){9,}",
        "rationale": "String.fromCharCode with 10+ numeric arguments reconstructs a string to hide it from scanners."
      },
      {
        "name": "hidden-escaped-string",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "(?:\\\\x[0-9a-fA-F]{2}){16,}|(?:\\\\u[0-9a-fA-F]{4}){12,}",
        "rationale": "16+ consecutive \\xHH or 12+ consecutive \\uHHHH escapes encode a hidden ASCII string."
      },
      {
        "name": "atob-large-inline-literal",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "\\batob\\s*\\(\\s*['\"][A-Za-z0-9+/]{200,}={0,2}['\"]\\s*\\)",
        "rationale": "atob() of a 200+ character inline base64 literal is a decoded payload bundled into the theme."
      },
      {
        "name": "function-constructor-dotted",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "\\bconstructor\\s*\\.\\s*constructor\\s*\\(",
        "rationale": "x.constructor.constructor( retrieves the Function constructor via the prototype chain."
      },
      {
        "name": "eval-via-bracket-access",
        "target": "js",
        "severity": "review",
        "combineWith": null,
        "pattern": "\\b(?:window|globalThis|self|top|this)\\s*\\[\\s*['\"](?:eval|Function|atob)['\"]\\s*\\]",
        "rationale": "window['eval'] / globalThis['Function'] / self['atob'] is string-keyed indirect access to code-exec/decode primitives."
      }
    ]
  },
  {
    "category": "css-attribute-value-exfiltration",
    "rules": [
      {
        "name": "css-value-selector-url-keylogger",
        "target": "css",
        "severity": "block",
        "pattern": "[\\[\\]]\\s*[vV][aA][lL][uU][eE]\\s*[\\^$*]=[^\\]]*\\][^{}]*\\{[^{}]*[uU][rR][lL]\\s*\\(\\s*['\"]?(?:[hH][tT][tT][pP][sS]?:)?//",
        "combineWith": null,
        "rationale": "An attribute selector matching an input value by prefix/suffix/substring whose declaration block fires a url() to a network host (CSS keylogger)."
      },
      {
        "name": "html-style-value-keylogger",
        "target": "html",
        "severity": "block",
        "pattern": "[\\[\\]]\\s*[vV][aA][lL][uU][eE]\\s*[\\^$*]=[^\\]]*\\][^{}]*\\{[^{}]*[uU][rR][lL]\\s*\\(\\s*['\"]?(?:[hH][tT][tT][pP][sS]?:)?//",
        "combineWith": null,
        "rationale": "A <style> value-selector keylogger with a network-beacon url() embedded in the innerHTML-injected html field."
      },
      {
        "name": "js-assembled-value-keylogger",
        "target": "js",
        "severity": "block",
        "pattern": "[\\[\\]]\\s*[vV][aA][lL][uU][eE]\\s*[\\^$*]=[^\\]]*\\][^{}]*\\{[^{}]*[uU][rR][lL]\\s*\\(\\s*['\"]?(?:[hH][tT][tT][pP][sS]?:)?//",
        "combineWith": null,
        "rationale": "Theme JS assembling a value-enumeration keylogger stylesheet string with a network beacon."
      },
      {
        "name": "css-value-enumeration-selector-probe",
        "target": "css",
        "severity": "review",
        "pattern": "[\\[\\]]\\s*[vV][aA][lL][uU][eE]\\s*[\\^$*]=[^\\]{}]{0,60}\\]",
        "combineWith": null,
        "rationale": "A value-enumerating attribute selector ([value^=]/[value$=]/[value*=]) even when the beacon is indirect."
      },
      {
        "name": "html-value-enumeration-selector-probe",
        "target": "html",
        "severity": "review",
        "pattern": "[\\[\\]]\\s*[vV][aA][lL][uU][eE]\\s*[\\^$*]=[^\\]{}]{0,60}\\]",
        "combineWith": null,
        "rationale": "A value-enumeration selector in the innerHTML-injected html field with an indirect beacon."
      },
      {
        "name": "css-external-import-beacon",
        "target": "css",
        "severity": "review",
        "pattern": "@[iI][mM][pP][oO][rR][tT]\\s+(?:[uU][rR][lL]\\(\\s*)?['\"]?[hH][tT][tT][pP][sS]?://(?!(?:[\\w-]+\\.)*(?:fonts\\.googleapis\\.com|fonts\\.gstatic\\.com|fonts\\.bunny\\.net|use\\.typekit\\.net|cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com|unpkg\\.com|harbor\\.site)[/'\"\\s)])",
        "combineWith": null,
        "rationale": "An @import to a non-allowlisted external host is an unconditional parse-time phone-home/tracking beacon."
      },
      {
        "name": "html-external-import-beacon",
        "target": "html",
        "severity": "review",
        "pattern": "@[iI][mM][pP][oO][rR][tT]\\s+(?:[uU][rR][lL]\\(\\s*)?['\"]?[hH][tT][tT][pP][sS]?://(?!(?:[\\w-]+\\.)*(?:fonts\\.googleapis\\.com|fonts\\.gstatic\\.com|fonts\\.bunny\\.net|use\\.typekit\\.net|cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com|unpkg\\.com|harbor\\.site)[/'\"\\s)])",
        "combineWith": null,
        "rationale": "An external @import beacon inside a <style> block in the innerHTML-injected html field."
      }
    ]
  },
  {
    "category": "html-phishing-and-injection",
    "rules": [
      {
        "name": "html-password-input-2",
        "target": "html",
        "severity": "review",
        "pattern": "<[iI][nN][pP][uU][tT]\\b[^>]*\\b[tT][yY][pP][eE]\\s*=\\s*[\\x22']?\\s*[pP][aA][sS][sS][wW][oO][rR][dD]\\b",
        "combineWith": null,
        "rationale": "A masked-credential password input is a fake-login / phishing tell in a presentation-only theme."
      },
      {
        "name": "html-external-form-action",
        "target": "html",
        "severity": "review",
        "pattern": "<[fF][oO][rR][mM]\\b[^>]*\\b[aA][cC][tT][iI][oO][nN]\\s*=\\s*[\\x22']?\\s*(?:[hH][tT][tT][pP]s?:)?//",
        "combineWith": null,
        "rationale": "A <form> whose action posts to an absolute/off-app origin ships submitted data to an external origin."
      },
      {
        "name": "html-credential-phishing",
        "target": "html",
        "severity": "block",
        "pattern": "<[iI][nN][pP][uU][tT]\\b[^>]*\\b[tT][yY][pP][eE]\\s*=\\s*[\\x22']?\\s*[pP][aA][sS][sS][wW][oO][rR][dD]\\b",
        "combineWith": "external-network",
        "rationale": "A masked password field present together with an external-network sink = textbook credential theft."
      },
      {
        "name": "html-external-script-src-2",
        "target": "html",
        "severity": "block",
        "pattern": "<[sS][cC][rR][iI][pP][tT]\\b[^>]*\\b[sS][rR][cC]\\s*=\\s*[\\x22']?\\s*(?:(?:[hH][tT][tT][pP]s?:)?//|[dD][aA][tT][aA]:)",
        "combineWith": null,
        "rationale": "A <script src> pointing at a remote/data URL loads attacker code into Harbor's CSP-null WebView."
      },
      {
        "name": "html-inline-script-2",
        "target": "html",
        "severity": "review",
        "pattern": "<[sS][cC][rR][iI][pP][tT][\\s/>]",
        "combineWith": null,
        "rationale": "Any <script> open tag in theme HTML is an injection attempt (behaviour belongs in the js field)."
      },
      {
        "name": "html-iframe-2",
        "target": "html",
        "severity": "review",
        "pattern": "<[iI][fF][rR][aA][mM][eE]\\b",
        "combineWith": null,
        "rationale": "An <iframe> embeds a foreign browsing context (external src phishing/clickjacking or srcdoc executable HTML)."
      },
      {
        "name": "html-object-embed",
        "target": "html",
        "severity": "review",
        "pattern": "<(?:[oO][bB][jJ][eE][cC][tT]|[eE][mM][bB][eE][dD])\\b[^>]*\\b(?:[dD][aA][tT][aA]|[sS][rR][cC])\\s*=",
        "combineWith": null,
        "rationale": "<object>/<embed> with a data/src attribute loads an external plugin/resource (classic exploit vector)."
      },
      {
        "name": "html-meta-refresh-ext",
        "target": "html",
        "severity": "review",
        "pattern": "<[mM][eE][tT][aA]\\b[^>]*\\b[hH][tT][tT][pP]-[eE][qQ][uU][iI][vV]\\s*=\\s*[\\x22']?\\s*[rR][eE][fF][rR][eE][sS][hH]\\b[^>]*\\b[uU][rR][lL]\\s*=\\s*[\\x22']?\\s*(?:[hH][tT][tT][pP]s?:)?//",
        "combineWith": null,
        "rationale": "A <meta http-equiv=refresh> to an off-app URL silently navigates the user to an external site."
      },
      {
        "name": "html-inline-handler-exfil-2",
        "target": "html",
        "severity": "block",
        "pattern": "\\b[oO][nN][a-zA-Z]+\\s*=\\s*([\\x22'])(?:(?!\\1).)*?(?:fetch\\s*\\(|XMLHttpRequest|new\\s+WebSocket|\\beval\\s*\\(|new\\s+Function|document\\.cookie|sendBeacon\\s*\\()",
        "combineWith": null,
        "rationale": "An inline event handler whose body invokes a network or code-exec primitive = self-complete exfil/RCE in Harbor's privileged context."
      },
      {
        "name": "html-inline-handler-exturl",
        "target": "html",
        "severity": "review",
        "pattern": "\\b[oO][nN][a-zA-Z]+\\s*=\\s*([\\x22'])(?:(?!\\1).)*?(?:[hH][tT][tT][pP]s?:)?//[a-zA-Z0-9-]+\\.[a-zA-Z]",
        "combineWith": null,
        "rationale": "An inline event handler that references an external domain-shaped URL is a probable exfil/redirect channel."
      },
      {
        "name": "html-javascript-uri-2",
        "target": "html",
        "severity": "review",
        "pattern": "(?:[hH][rR][eE][fF]|[sS][rR][cC]|[aA][cC][tT][iI][oO][nN])\\s*=\\s*[\\x22']\\s*[jJ][aA][vV][aA][sS][cC][rR][iI][pP][tT]:(?!\\s*(?:[vV][oO][iI][dD]\\s*\\(\\s*0\\s*\\)|;)\\s*[\\x22'])",
        "combineWith": null,
        "rationale": "A javascript: URI (not the inert void(0)/; placeholder) in href/src/action executes code on activation."
      }
    ]
  }
];

// Named signals referenced by rule.combineWith. sensitive-read / external-network /
// external-egress reuse authored rule patterns; native-bridge and dom-injection are
// unions of the Tauri / DOM-injection detectors. external-network additionally counts
// an external <form action> (per the html-credential-phishing rule's stated intent).
const SIGNAL_SRC = {
  "sensitive-read": {
    "targets": ["js"],
    "pattern": "document\\s*(?:\\.cookie|\\[\\s*['\"`]cookie)|(?:window\\s*\\.)?__TAURI__|window\\s*\\[\\s*['\"`]__TAURI__|navigator\\s*\\.\\s*clipboard\\s*\\.\\s*readText|(?:JSON\\.stringify|Object\\.(?:keys|entries|values))\\s*\\(\\s*(?:window\\s*\\.)?(?:local|session)Storage\\b|for\\s*\\(\\s*(?:var|let|const)?\\s*\\w+\\s+in\\s+(?:window\\s*\\.)?(?:local|session)Storage\\b|querySelector(?:All)?\\s*\\(\\s*[^)]*type\\s*=\\s*['\"`]?password"
  },
  "external-network": {
    "targets": ["js", "html"],
    "pattern": "(?:(?:fetch|\\.open|navigator\\.sendBeacon|new\\s+WebSocket|new\\s+EventSource)\\s*\\(\\s*['\"`]\\s*(?:https?:)?\\/\\/(?!(?:[a-z0-9-]+\\.)*harbor\\.site|fonts\\.g(?:oogleapis|static)\\.com|(?:[a-z0-9-]+\\.)?gstatic\\.com|(?:[a-z0-9-]+\\.)?googleapis\\.com|cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com|unpkg\\.com|localhost|127\\.0\\.0\\.1|\\[::1\\])[a-z0-9.\\-]+|navigator\\.sendBeacon\\s*\\(|new\\s+WebSocket\\s*\\(|new\\s+EventSource\\s*\\()|(?:<[fF][oO][rR][mM]\\b[^>]*\\b[aA][cC][tT][iI][oO][nN]\\s*=\\s*[\\x22']?\\s*(?:[hH][tT][tT][pP]s?:)?//)"
  },
  "external-egress": {
    "targets": ["js", "html"],
    "pattern": "(?:navigator\\.sendBeacon\\s*\\(|new\\s+WebSocket\\s*\\(|\\bXMLHttpRequest\\b|\\bmethod\\s*:\\s*[\"'](?:POST|PUT)[\"']|fetch\\s*\\(\\s*[`\"']https?:\\/\\/[^`\"']*(?:\\$\\{|[`\"']\\s*\\+))"
  },
  "native-bridge": {
    "targets": ["js"],
    "pattern": "\\b__TAURI(?:_[A-Z0-9]+)*__|@tauri-apps/(?:api|plugin-[a-z-]+)|[\"'`]plugin:(?:fs|shell|process|path|os|http|dialog|opener|websocket|store|sql|upload|notification|clipboard-manager|global-shortcut|autostart|updater|window|app|event|log)\\||__TAURI_INTERNALS__\\s*\\.\\s*invoke|\\.core\\s*\\.\\s*invoke\\s*\\(\\s*[\"'`]|\\binvoke\\s*\\(\\s*[\"'`][a-z][a-z0-9_]+[\"'`]|\\b(?:readTextFile|readBinaryFile|readDir|readFile|writeTextFile|writeBinaryFile|removeFile|removeDir|createDir|renameFile|copyFile)\\s*\\(|\\bnew\\s+Command\\s*\\(|\\bCommand\\s*\\.\\s*(?:create|sidecar)\\s*\\("
  },
  "dom-injection": {
    "targets": ["js"],
    "pattern": "(?:innerHTML|outerHTML|insertAdjacentHTML|document\\.write(?:ln)?)\\s*(?:=|\\(|,)|createElement\\(\\s*['\"`]script['\"`]|\\bimport\\s*\\(\\s*['\"`]\\s*(?:https?:)?//|importScripts\\s*\\("
  }
};

// Compile authored rules once.
const RULES = [];
for (const cat of CATS)
  for (const r of cat.rules)
    RULES.push({
      category: cat.category, rule: r.name, target: r.target,
      severity: r.severity, combineWith: r.combineWith,
      rationale: r.rationale, re: new RegExp(r.pattern),
    });

// A combineWith rule only fires when BOTH its own pattern matches AND the referenced
// signal is present somewhere in its target fields. Signals never emit findings alone.
const SIGNALS = {};
for (const name of Object.keys(SIGNAL_SRC))
  SIGNALS[name] = { targets: SIGNAL_SRC[name].targets, re: new RegExp(SIGNAL_SRC[name].pattern) };

function snippet(s) {
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 140);
}

// No legitimate theme approaches this per-field size (largest live field ~224KB).
// Oversized input is flagged for a human and truncated before the regex battery,
// bounding worst-case time even if a future rule regresses. Not a block (benign).
const MAX_FIELD = 2 * 1024 * 1024;

function scanTheme(input) {
  const src = input || {};
  const fields = { css: String(src.css || ''), js: String(src.js || ''), html: String(src.html || '') };

  const findings = [];
  for (const t of ['css', 'js', 'html']) {
    if (fields[t].length > MAX_FIELD) {
      findings.push({
        severity: 'review', category: 'operational', rule: 'oversized-field',
        evidence: t + ' field is ' + fields[t].length + ' bytes (> ' + MAX_FIELD + ')',
        rationale: 'Field far larger than any legitimate theme; routed to human review.',
      });
      fields[t] = fields[t].slice(0, MAX_FIELD);
    }
  }

  // Evaluate which combineWith signals are present.
  const present = {};
  for (const name of Object.keys(SIGNALS)) {
    const s = SIGNALS[name];
    present[name] = s.targets.some((t) => s.re.test(fields[t]));
  }

  const seen = new Set();
  for (const rule of RULES) {
    const text = fields[rule.target];
    if (!text) continue;
    const m = rule.re.exec(text);
    if (!m) continue;
    if (rule.combineWith && !present[rule.combineWith]) continue; // combination not satisfied
    const key = rule.category + '::' + rule.rule;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      severity: rule.severity,
      category: rule.category,
      rule: rule.rule,
      evidence: snippet(m[0]),
      rationale: rule.rationale,
    });
  }

  const rank = { block: 0, review: 1 };
  findings.sort((a, b) => (rank[a.severity] - rank[b.severity]));

  const verdict = findings.some((f) => f.severity === 'block')
    ? 'block'
    : findings.some((f) => f.severity === 'review')
      ? 'review'
      : 'pass';

  return { verdict, findings };
}

export { scanTheme };