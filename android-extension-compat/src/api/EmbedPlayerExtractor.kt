package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

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

    protected open fun prepare(url: String): String = url

    private fun iframeIn(page: String): String? = IFRAME.find(page)?.groupValues?.get(1)

    private companion object {
        const val MAX_HOPS = 2
        val IFRAME = Regex("""<iframe[^>]+src\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    }
}

object GenericEmbedExtractor : EmbedPlayerExtractor("Embed", "", requiresReferer = true, playbackOrigin = false)

internal val GENERIC_EXTRACTORS: List<ExtractorApi> = listOf(DirectFile, GenericEmbedExtractor)
