package harbor.capstan.probe

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.loadExtractor
import com.lagradost.cloudstream3.utils.namedExtractorsFor
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

private val client = OkHttpClient.Builder()
    .callTimeout(25, TimeUnit.SECONDS)
    .followRedirects(true)
    .build()

fun main(args: Array<String>) {
    for (url in args) {
        println("== $url")
        val named = namedExtractorsFor(url).map { it.name }
        println("   registry ${if (named.isEmpty()) "NONE" else named.joinToString(", ")}")
        val links = ArrayList<ExtractorLink>()
        val subs = ArrayList<SubtitleFile>()
        val failure = try {
            runBlocking {
                withTimeout(90_000L) {
                    loadExtractor(url, null, { s: SubtitleFile -> subs.add(s) }, { l: ExtractorLink -> links.add(l) })
                }
            }
            null
        } catch (t: Throwable) {
            "${t::class.java.simpleName}: ${t.message?.take(120)}"
        }
        if (failure != null) println("   threw $failure")
        println("   ${links.size} links, ${subs.size} subtitles")
        for (link in links.take(4)) {
            println("   [${link.source}/${link.name}] q=${link.quality} type=${link.type} ${link.url.take(150)}")
            println("      " + serve(link))
        }
        println()
    }
}

private fun serve(link: ExtractorLink): String {
    val builder = Request.Builder().url(link.url).header("Range", "bytes=0-1023")
    link.playbackHeaders().forEach { (n, v) -> runCatching { builder.header(n, v) } }
    if (link.referer.isNotEmpty() && link.playbackHeaders().keys.none { it.equals("referer", true) }) {
        builder.header("Referer", link.referer)
    }
    return try {
        client.newCall(builder.build()).execute().use { r ->
            val bytes = r.body?.bytes()?.size ?: 0
            val type = r.header("content-type").orEmpty().substringBefore(';').trim()
            "${r.code} ${type.ifEmpty { "?" }} ${bytes}B" + if (r.code in 200..299 && bytes > 0) "  SERVED" else ""
        }
    } catch (t: Throwable) {
        "fetch failed ${t::class.java.simpleName}: ${t.message?.take(90)}"
    }
}
