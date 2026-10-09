package harbor.capstan.test

import com.harbor.capstan.StreamLink
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.util.concurrent.TimeUnit

class LinkProbe(
    val url: String,
    val status: Int,
    val contentType: String,
    val bytes: Int,
    val error: String?,
) {
    val served: Boolean get() = status in 200..299 && bytes > 0

    fun line(): String {
        val outcome = error ?: "$status ${contentType.ifEmpty { "?" }} ${bytes}B"
        return "$outcome  ${url.take(120)}"
    }
}

object LinkProbes {

    private const val WINDOW = 1024L

    private val client = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun probe(links: List<StreamLink>, limit: Int): List<LinkProbe> = links.take(limit).map(::one)

    private fun window(response: Response): Int {
        val stream = response.body?.byteStream() ?: return 0
        val buffer = ByteArray(WINDOW.toInt())
        var read = 0
        while (read < buffer.size) {
            val n = stream.read(buffer, read, buffer.size - read)
            if (n < 0) break
            read += n
        }
        return read
    }

    private fun one(link: StreamLink): LinkProbe {
        val scheme = link.url.substringBefore(':', "").lowercase()
        if (scheme != "http" && scheme != "https") {
            return LinkProbe(link.url, 0, "", 0, "not an http url, scheme ${scheme.ifEmpty { "none" }}")
        }
        return try {
            val builder = Request.Builder().url(link.url).header("Range", "bytes=0-${WINDOW - 1}")
            link.headers.forEach { (name, value) -> runCatching { builder.header(name, value) } }
            if (link.referer.isNotEmpty() && !link.headers.keys.any { it.equals("referer", true) }) {
                builder.header("Referer", link.referer)
            }
            client.newCall(builder.build()).execute().use { response ->
                LinkProbe(
                    url = link.url,
                    status = response.code,
                    contentType = response.header("content-type").orEmpty().substringBefore(';').trim(),
                    bytes = window(response),
                    error = null,
                )
            }
        } catch (t: Throwable) {
            LinkProbe(link.url, 0, "", 0, line(t))
        }
    }
}
