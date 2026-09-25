package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

/** An embed player that keeps its sources in the page.
 *
 * Adding a host that behaves this way is one line: give the class a name and a main url and put an
 * instance in builtinExtractors. Override [prepare] when the host needs a different page fetched
 * first, and override getUrl outright when it needs an api call. */
open class EmbedPlayerExtractor(
    override val name: String,
    override val mainUrl: String,
    override val requiresReferer: Boolean = true,
    private val playbackOrigin: Boolean = true,
) : ExtractorApi() {

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val pageReferer = referer ?: mainUrl.ifBlank { url }
        val headers = if (playbackOrigin && mainUrl.isNotBlank()) {
            mapOf("Origin" to mainUrl.trimEnd('/'), "User-Agent" to USER_AGENT)
        } else {
            mapOf("User-Agent" to USER_AGENT)
        }

        var current = prepare(url)
        var hops = 0
        while (hops < MAX_HOPS) {
            val page = playerPage(current, pageReferer) ?: return
            if (emitPlayerPage(name, name, current, page, pageReferer, headers, subtitleCallback, callback)) return
            val next = iframeIn(page)?.let { absolute(current, clean(it)) }
            if (next == null || next == current) break
            current = next
            hops++
        }
        extractorLog("$name found no sources on $url")
    }

    /** The url actually worth fetching, for hosts whose share links are not their embed links. */
    protected open fun prepare(url: String): String = url

    private fun iframeIn(page: String): String? = IFRAME.find(page)?.groupValues?.get(1)

    private companion object {
        const val MAX_HOPS = 2
        val IFRAME = Regex("""<iframe[^>]+src\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    }
}

/** Last resort for a host nobody wrote a class for. The registry always tries this after the
 * specific extractors, so an unknown embed still gets one honest attempt. */
object GenericEmbedExtractor : EmbedPlayerExtractor("Embed", "", requiresReferer = true, playbackOrigin = false)

internal val GENERIC_EXTRACTORS: List<ExtractorApi> = listOf(GenericEmbedExtractor)
