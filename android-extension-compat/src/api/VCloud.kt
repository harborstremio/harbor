package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.base64DecodeArray
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName

/** V-Cloud, which is where nearly every Hindi/English provider hands its sources to.
 *
 * The file page does not carry the file and does not need a browser either: it carries its own
 * next url, base64 encoded twice, as a literal. Asking that url for the token it holds answers
 * with a page listing the servers, and the ones that are direct files are the links. The encoding
 * is data rather than script, which is why this works where a javascript gate would not. */
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

    /** The page also links its own manifest, which ends in webmanifest and would otherwise read as
     * a stream because .webm is a prefix of it. A server link names a file, so the path it ends
     * with has to be the file's own extension. */
    private fun isDirectFile(link: String): Boolean {
        val path = pathOf(link) ?: return false
        return FILE_SUFFIXES.any { path.endsWith(it) }
    }

    /** The resolution is the `NNNp` token in the file name, never the year next to it. */
    private fun qualityOf(link: String): Int =
        getQualityFromName(RESOLUTION.find(link.substringBefore('?'))?.groupValues?.get(1))

    /** The payload is the url base64'd twice, and the site's own decoder pads nothing. */
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
