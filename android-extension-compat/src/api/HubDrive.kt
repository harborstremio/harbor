package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName
import com.lagradost.cloudstream3.utils.hostOf

open class HubDrive : ExtractorApi() {

    override val name: String = "HubDrive"

    override val mainUrl: String = "https://hubdrive.pics"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val drive = if (url.contains("/drive/")) url else driveUrl(url, referer)
        if (drive == null) {
            extractorLog("$name found no drive page on $url")
            return
        }

        val page = playerPage(drive, referer ?: hostRoot(drive, mainUrl))
        val servers = page?.let { SERVER_LIST.find(it)?.value }
        if (servers == null) {
            extractorLog("$name found no server list on $drive")
            return
        }

        val list = playerPage(servers, drive)
        if (list == null) {
            extractorLog("$name server list did not answer for $drive")
            return
        }

        var produced = 0
        for (candidate in HREF.findAll(list).map { clean(it.groupValues[1]) }.distinct()) {
            val link = resolve(candidate, servers) ?: continue
            produced++
            callback(
                ExtractorLink(
                    source = name,
                    name = name,
                    url = link,
                    referer = servers,
                    quality = getQualityFromName(fileNameOf(link)),
                    type = ExtractorLinkType.VIDEO,
                    headers = mapOf("User-Agent" to USER_AGENT),
                ),
            )
        }
        if (produced == 0) extractorLog("$name found no addresses on $servers")
    }

    private suspend fun driveUrl(url: String, referer: String?): String? {
        val page = playerPage(url, referer ?: mainUrl) ?: return null
        return DRIVE.find(page)?.value
    }

    private suspend fun resolve(href: String, referer: String): String? {
        if (!href.startsWith("http")) return null
        val host = hostOf(href)
        return when {
            host.startsWith("gpdl.") -> redirectTarget(href, referer)
            host.endsWith(".r2.cloudflarestorage.com") -> href
            isDirectFile(href) -> href
            else -> null
        }
    }

    private suspend fun redirectTarget(href: String, referer: String): String? {
        val landed = try {
            app.get(href, referer = referer, headers = mapOf("User-Agent" to USER_AGENT)).url
        } catch (t: Throwable) {
            extractorLog("$name redirect read failed for $href: ${t.message}")
            return null
        }
        val target = landed.substringAfter("link=", "")
        if (target.isEmpty()) return null
        return clean(java.net.URLDecoder.decode(target, "UTF-8")).takeIf { it.startsWith("http") }
    }

    private fun isDirectFile(href: String): Boolean {
        val path = pathOf(href) ?: return false
        return FILE_SUFFIXES.any { path.endsWith(it) }
    }

    private fun fileNameOf(url: String): String {
        val decoded = try {
            java.net.URLDecoder.decode(url, "UTF-8")
        } catch (t: Throwable) {
            url
        }
        FILENAME.find(decoded)?.groupValues?.get(1)?.let { return it }
        return decoded.substringBefore('?').substringBefore('#').substringAfterLast('/')
    }

    private companion object {
        val FILENAME = Regex("""filename\s*=\s*"?([^";]+)""")

        val DRIVE = Regex("""https://hubcloud\.[a-z]{2,6}/drive/[A-Za-z0-9]+""")

        val SERVER_LIST = Regex("""https://[a-z0-9.\-]+/hubcloud\.php\?[^"'\s<>]+""")

        val HREF = Regex("""href="(https://[^"]+)"""")

        val FILE_SUFFIXES = listOf(".mkv", ".mp4", ".m4v", ".avi", ".webm", ".mov")
    }
}
