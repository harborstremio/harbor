package harbor.capstan.test

import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.bridge.BridgeCatalog
import com.harbor.capstan.bridge.BridgeHostRequests
import com.harbor.capstan.bridge.BridgeOutput
import com.harbor.capstan.bridge.BridgeServer
import com.lagradost.cloudstream3.app
import harbor.compat.host.HostLink
import java.io.File
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking

/** Proves the reverse request: the layer asks the host to clear a challenge, and replays what
 * comes back. Two halves, because they can fail independently.
 *
 * The wire half runs the real bridge over two pipes and asserts the frames. The layer half runs a
 * real challenged site and asserts that both request paths get through it, and that with no host
 * attached they do not, which is the fallback the standalone gates depend on.
 */

private val failures = ArrayList<String>()

private fun check(label: String, ok: Boolean, detail: Any? = null) {
    if (ok) {
        println("  ok   $label")
    } else {
        println("  FAIL $label ${detail ?: ""}")
        failures.add(label)
    }
}

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    try {
        wire(root)
        layer()
        unclearable()
    } finally {
        HostLink.channel = null
        HostLink.forget()
    }
    println("HOST GATE ${if (failures.isEmpty()) "ok" else "FAILED"}, ${failures.size} checks failed")
    if (failures.isNotEmpty()) kotlin.system.exitProcess(1)
}

private fun wire(root: File) {
    println("the reverse request on the wire")
    val toBridge = PipedOutputStream()
    val bridgeIn = PipedInputStream(toBridge, 1 shl 16)
    val fromBridge = PipedInputStream(1 shl 16)
    val bridgeOut = PipedOutputStream(fromBridge)

    val data = File(root, "out/hostgate-data")
    data.deleteRecursively()
    val loader = ExtensionLoader(LoaderConfig(cacheDir = File(data, "cache"), callTimeoutMs = 30_000L))
    val catalog = BridgeCatalog(File(data, "extensions"), loader)
    val output = BridgeOutput(bridgeOut)
    val requests = BridgeHostRequests(output)
    val server = BridgeServer(output, catalog, requests)
    val serving = Thread({ server.serve(bridgeIn) }, "bridge-under-test")
    serving.isDaemon = true
    serving.start()

    val host = PipedHost(fromBridge, toBridge).start()

    HostLink.channel = null
    HostLink.forget()
    check("no host attached asks nobody", HostLink.solveChallenge("https://nowhere.invalid/a", 2_000L) == null)
    check("nothing was written for it", host.takeReverse(300L) == null)

    HostLink.channel = requests

    val answered = arrayOfNulls<Any>(1)
    val done = CountDownLatch(1)
    Thread({
        answered[0] = HostLink.solveChallenge("https://challenged.invalid/one", 20_000L)
        done.countDown()
    }, "solve-one").start()

    val frame = host.takeReverse(10_000L)
    check("a reverse request arrived", frame != null)
    if (frame != null) {
        check("it names the method under host", frame.get("host")?.asString == "challenge", frame)
        check("it carries an id", frame.get("id")?.asString?.isNotEmpty() == true, frame)
        check("it carries no method, so it cannot read as a request", !frame.has("method"), frame)
        check(
            "it passes the url",
            frame.getAsJsonObject("params")?.get("url")?.asString == "https://challenged.invalid/one",
            frame,
        )

        println("a forward request while the reverse one is still open")
        val pong = host.call("p1", "ping")
        check("ping answered mid solve", pong?.get("ok")?.asBoolean == true, pong)

        println("an answer for an id nobody is waiting on")
        host.answer("h-nobody", mapOf("cookie" to "x=1", "userAgent" to "u"))

        host.answer(frame.get("id").asString, mapOf("cookie" to "cf_clearance=abc", "userAgent" to "agent/1"))
    }

    check("the solve returned", done.await(20, TimeUnit.SECONDS))
    val solution = answered[0] as? harbor.compat.host.ChallengeSolution
    check("it carries the cookie the host sent", solution?.cookie == "cf_clearance=abc", solution?.cookie)
    check("it carries the agent the host sent", solution?.userAgent == "agent/1", solution?.userAgent)

    println("a host that refuses, and a host that never answers")
    HostLink.forget()
    Thread({ host.takeReverse(10_000L)?.let { host.refuse(it.get("id").asString, "denied", "no") } }, "refuse").start()
    check("a refusal reads as no clearance", HostLink.solveChallenge("https://refused.invalid/a", 20_000L) == null)
    HostLink.forget()
    val started = System.currentTimeMillis()
    check("silence times out", HostLink.solveChallenge("https://silent.invalid/a", 2_000L) == null)
    check("and it waited rather than returning at once", System.currentTimeMillis() - started >= 1_500L)

    val alive = host.call("p2", "ping")
    check("the bridge is still serving after all of that", alive?.get("ok")?.asBoolean == true, alive)

    HostLink.channel = null
    HostLink.forget()
}

private fun layer() {
    val site = ChallengeSite().start()
    try {
        println("the webkit stub with no host attached")
        HostLink.channel = null
        HostLink.forget()
        val challenged = loadPage(site.url)
        check("it is handed the challenge page, as it always was", challenged == ChallengeSite.CHALLENGE_TITLE, challenged)

        println("the webkit stub with the stub host attached")
        HostLink.forget()
        val host = GateHost()
        HostLink.channel = host
        val cleared = loadPage(site.url)
        check("it gets the page behind the challenge", cleared == ChallengeSite.REAL_TITLE, cleared)
        check("it asked the host once", host.asks.map { it.method } == listOf("challenge"), host.asks.size)
        check("and the host recorded that it cleared it", host.asks.all { it.cleared }, host.asks.map { it.line() })
        check("the site saw a cleared request", site.cleared.get() >= 1, site.cleared.get())
        check(
            "the clearance is in the jar for later loads",
            CookieManager.getInstance().getCookie(site.url)?.contains(ChallengeSite.CLEARANCE_VALUE) == true,
            CookieManager.getInstance().getCookie(site.url),
        )

        println("the request path the extensions use")
        HostLink.forget()
        val fresh = site.cleared.get()
        val response = runBlocking { app.get(site.url) }
        check("it answers 200", response.code == 200, response.code)
        check("with the body behind the challenge", response.text.contains(ChallengeSite.REAL_BODY), response.code)
        check("and the site saw another cleared request", site.cleared.get() > fresh)

        println("a second request reuses the solve instead of asking again")
        val before = host.asks.size
        val again = runBlocking { app.get(site.url) }
        check("still 200", again.code == 200, again.code)
        check("the host was not asked a second time", host.asks.size == before, host.asks.size)

        println("no host attached, on the request path")
        HostLink.channel = null
        HostLink.forget()
        val refused = runBlocking { app.get(site.url) }
        check("the challenge is returned untouched", refused.code == 503, refused.code)
    } finally {
        HostLink.channel = null
        HostLink.forget()
        site.stop()
    }
}

/** The case that decides whether the gate can be believed: a site that hands out cookies and
 * challenges anyway. A solver that answered from the cookies alone would report this as a solve, the
 * gate would read green, and the extension behind it would still see a challenge. */
private fun unclearable() {
    val site = ChallengeSite(clears = false).start()
    try {
        println("a challenge cookies cannot clear")
        HostLink.forget()
        val host = GateHost()
        HostLink.channel = host
        val response = runBlocking { app.get(site.url) }
        check("the extension still sees the challenge", response.code == 503, response.code)
        check("the host was asked", host.asks.size == 1, host.asks.size)
        check("and it said plainly that it did not clear it", host.asks.none { it.cleared }, host.asks.map { it.line() })
        check(
            "the detail names the retry rather than the first status",
            host.asks.firstOrNull()?.detail?.contains("did not clear it, still 503") == true,
            host.asks.firstOrNull()?.detail,
        )
        val before = host.asks.size
        runBlocking { app.get(site.url) }
        check("a host that could not clear is left alone", host.asks.size == before, host.asks.size)
    } finally {
        HostLink.channel = null
        HostLink.forget()
        site.stop()
    }
}

/** Loads one page through the webkit stub and returns the title it ended on. */
private fun loadPage(url: String): String? {
    val view = WebView(null)
    val finished = CountDownLatch(1)
    view.setWebViewClient(object : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
            finished.countDown()
        }
    })
    view.loadUrl(url)
    finished.await(30, TimeUnit.SECONDS)
    val title = view.getTitle()
    view.destroy()
    return title
}
