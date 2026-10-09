package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.httpsify

open class Krakenfiles : ExtractorApi() {

    override val name: String = "Krakenfiles"

    override val mainUrl: String = "https://krakenfiles.com"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val pageReferer = referer ?: root
        val headers = mapOf("Origin" to root, "User-Agent" to USER_AGENT)
        val page = playerPage(url, pageReferer) ?: return

        if (emitPlayerPage(name, name, url, page, pageReferer, headers, subtitleCallback, callback)) return

        val source = SOURCE.find(page)?.groupValues?.get(1)?.let { httpsify(clean(it)) }
        if (source.isNullOrEmpty()) {
            extractorLog("$name found no source on $url")
            return
        }
        emitStream(name, name, source, pageReferer, null, headers, callback)
    }

    private companion object {
        val SOURCE = Regex("""<source[^>]+src\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    }
}
