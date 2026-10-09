package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class EmturbovidExtractor : ExtractorApi() {

    override val name: String = "Emturbovid"

    override val mainUrl: String = "https://emturbovid.com"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val page = playerPage(url, referer ?: root, mapOf("User-Agent" to USER_AGENT)) ?: return
        val headers = mapOf("Origin" to root, "User-Agent" to USER_AGENT)

        val manifest = URL_PLAY.find(page)?.groupValues?.get(1)?.let { clean(it) }
        if (manifest != null && manifest.startsWith("http")) {
            emitStream(name, name, manifest, root, null, headers, callback)
            return
        }

        if (emitPlayerPage(name, name, url, page, root, headers, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    private companion object {
        val URL_PLAY = Regex("""urlPlay\s*=\s*["']([^"']+)["']""")
    }
}
