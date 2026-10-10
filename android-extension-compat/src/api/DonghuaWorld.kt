package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

class DonghuaWorld : ExtractorApi() {

    override val name: String = "DonghuaWorld"

    override val mainUrl: String = "https://playing.donghuaworld.in"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val site = "https://donghuaworld.com/"
        val page = playerPage(url, site)
        if (page.isNullOrBlank()) {
            extractorLog("$name could not read $url")
            return
        }
        val playback = mapOf("User-Agent" to USER_AGENT, "Referer" to "$mainUrl/")
        emitPlayerPage(name, name, url, page, site, playback, subtitleCallback, callback)
    }
}
