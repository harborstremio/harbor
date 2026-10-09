(function () {
  if (window.__harborSourceRead) return;
  window.__harborSourceRead = true;
  var target = __HARBOR_SOURCE_URL__;
  var maxBytes = __HARBOR_SOURCE_MAX_BYTES__;
  var pending = false;
  function challenged() {
    var title = (document.title || "").toLowerCase();
    return (
      title.indexOf("just a moment") >= 0 ||
      title.indexOf("attention required") >= 0 ||
      !!document.querySelector(
        "#challenge-form, #challenge-running, #cf-please-wait, .cf-turnstile",
      )
    );
  }
  async function read() {
    if (pending || window.__harborSourceResult || challenged()) return;
    pending = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 20000);
    var reader;
    try {
      var response = await fetch(target, {
        credentials: "include",
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json, text/plain, */*" },
      });
      if (!response.ok) {
        if (response.body) await response.body.cancel();
        return;
      }
      if (Number(response.headers.get("content-length")) > maxBytes) {
        window.__harborSourceResult = { status: "error", error: "source_limit" };
        if (response.body) await response.body.cancel();
        return;
      }
      if (!response.body) return;
      reader = response.body.getReader();
      var bytes = 0,
        body = "",
        decoder = new TextDecoder();
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          window.__harborSourceResult = { status: "error", error: "source_limit" };
          return;
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      if (
        /<title[^>]*>\s*(?:just a moment|attention required)|id=["'](?:challenge-form|challenge-running|cf-please-wait)["']/i.test(
          body,
        )
      )
        return;
      window.__harborSourceResult = { status: "ready", body: body };
    } catch {
    } finally {
      clearTimeout(timeout);
      if (reader) {
        await reader.cancel().catch(function () {});
        reader.releaseLock();
      }
      pending = false;
    }
  }
  var tries = 0;
  var timer = setInterval(function () {
    if (window.__harborSourceResult || ++tries > 450) {
      clearInterval(timer);
      return;
    }
    void read();
  }, 400);
  document.addEventListener("DOMContentLoaded", read);
  window.addEventListener("load", read);
})();
