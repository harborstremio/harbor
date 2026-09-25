package harbor.capstan.test

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicInteger

/** A site that answers with a Cloudflare shaped challenge until the clearance comes back.
 *
 * The point of running a real server rather than asserting on a mock is that the replay has to
 * survive the whole path: the clearance has to reach a socket as a `Cookie` header on a request
 * whose agent matches, which is the property a real clearance is checked against.
 *
 * [clears] false is the other real case: a site that hands out cookies and challenges anyway, which
 * is what a Cloudflare interactive challenge does. A solver is only honest if that reads as a
 * failure rather than as a solve.
 */
class ChallengeSite(private val clears: Boolean = true) {

    private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)

    val challenged = AtomicInteger()

    val cleared = AtomicInteger()

    val url: String get() = "http://127.0.0.1:${server.address.port}/gate"

    init {
        server.createContext("/gate") { exchange -> answer(exchange) }
        server.executor = null
    }

    fun start(): ChallengeSite {
        server.start()
        return this
    }

    fun stop() {
        server.stop(0)
    }

    private fun answer(exchange: HttpExchange) {
        val cookie = exchange.requestHeaders.getFirst("Cookie").orEmpty()
        val agent = exchange.requestHeaders.getFirst("User-Agent").orEmpty()
        if (clears && cookie.contains("$CLEARANCE_NAME=$CLEARANCE_VALUE") && agent == SOLVED_AGENT) {
            cleared.incrementAndGet()
            send(exchange, 200, "<html><head><title>$REAL_TITLE</title></head><body>$REAL_BODY</body></html>")
            return
        }
        challenged.incrementAndGet()
        exchange.responseHeaders.add("cf-mitigated", "challenge")
        exchange.responseHeaders.add("Set-Cookie", "$CLEARANCE_NAME=$CLEARANCE_VALUE; Path=/")
        exchange.responseHeaders.add("Set-Cookie", "__cf_bm=$BM_VALUE; Path=/")
        send(
            exchange, 503,
            "<html><head><title>$CHALLENGE_TITLE</title></head>" +
                "<body><div id=\"cf-please-wait\"></div>Just a moment...</body></html>",
        )
    }

    private fun send(exchange: HttpExchange, status: Int, body: String) {
        val bytes = body.toByteArray()
        exchange.responseHeaders.add("Content-Type", "text/html; charset=utf-8")
        exchange.sendResponseHeaders(status, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }

    companion object {
        const val CLEARANCE_NAME = "cf_clearance"
        const val CLEARANCE_VALUE = "cleared-by-the-host"
        const val BM_VALUE = "second-cookie"
        const val CHALLENGE_TITLE = "Just a moment..."
        const val REAL_TITLE = "The page behind the challenge"
        const val REAL_BODY = "THE-REAL-BODY"
        const val SOLVED_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/128.0.0.0 Safari/537.36"
    }
}
