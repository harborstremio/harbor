package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

/** Supervideo.
 *
 * The page holds its player config inside one packed script block and nothing else, which is the
 * shape the shared engine already reads, so this only has to find the page. */
open class Supervideo : ExtractorApi() {

    override val name: String = "Supervideo"

    override val mainUrl: String = "https://supervideo.cc"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val page = playerPage(url, referer) ?: return
        if (emitPlayerPage(name, name, url, page, referer ?: mainUrl, emptyMap(), subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }
}
