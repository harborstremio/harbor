package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

class AnimeAppsPlayer : ExtractorApi() {

    override val name: String = "AnimeApps"

    override val mainUrl: String = "https://playeng.animeapps.top"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val own = "$root/"
        val target = url.replace("/b2/", "/r2/")
        val headers = mapOf("User-Agent" to USER_AGENT, "Origin" to root, "Referer" to own)

        val page = playerPage(target, own) ?: return
        val video = CONFIG.find(page)?.groupValues?.get(1)
        if (video.isNullOrBlank()) {
            extractorLog("$name found no config on $target")
            return
        }

        val stream = absolute(target, clean(video))
        if (!emitStream(name, name, stream, own, null, headers, callback)) {
            extractorLog("$name could not expand $stream")
        }
    }

    private companion object {
        val CONFIG = Regex("""videoUrl\s*:\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    }
}
