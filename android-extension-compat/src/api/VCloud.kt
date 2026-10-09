package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.base64DecodeArray
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName

open class VCloud : ExtractorApi() {

    override val name: String = "VCloud"

    override val mainUrl: String = "https://vcloud.fit"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val page = playerPage(url, referer) ?: return

        val encoded = DOUBLE_ATOB.find(page)?.groupValues?.get(1)
        val next = encoded?.let(::decodeTwice)
        if (next.isNullOrBlank()) {
            extractorLog("$name found no token on $url")
            return
        }

        val servers = playerPage(next, url) ?: return

        var produced = 0
        for (match in URL_IN_TEXT.findAll(servers)) {
            val link = clean(match.value).substringBefore('"')
            if (!isDirectFile(link)) continue
            produced++
            callback(
                ExtractorLink(
                    source = name,
                    name = name,
                    url = link,
                    referer = next,
                    quality = qualityOf(link),
                    type = ExtractorLinkType.VIDEO,
                    headers = mapOf("User-Agent" to USER_AGENT),
                ),
            )
        }
        if (produced == 0) extractorLog("$name found no servers on $url")
    }

    private fun isDirectFile(link: String): Boolean {
        val path = pathOf(link) ?: return false
        return FILE_SUFFIXES.any { path.endsWith(it) }
    }

    private fun qualityOf(link: String): Int =
        getQualityFromName(RESOLUTION.find(link.substringBefore('?'))?.groupValues?.get(1))

    private fun decodeTwice(value: String): String? = try {
        String(base64DecodeArray(String(base64DecodeArray(value))))
    } catch (t: Throwable) {
        null
    }

    private companion object {
        val DOUBLE_ATOB = Regex("""atob\(atob\(['"]([^'"]+)['"]\)\)""")

        val URL_IN_TEXT = Regex("""https?://[^\s"'<>\\]+""")

        val RESOLUTION = Regex("""(\d{3,4})[pP]""")

        val FILE_SUFFIXES = listOf(".m3u8", ".mpd", ".mp4", ".mkv", ".webm", ".m4v", ".avi", ".mov")
    }
}
