package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.newExtractorLink

/** PixelDrain.
 *
 * Nothing has to be scraped. The file page and the download api answer the same id, so the api url
 * is the link and the page it came from is the referer it has to be asked for under. */
open class PixelDrain : ExtractorApi() {

    override val name: String = "PixelDrain"

    override val mainUrl: String = "https://pixeldrain.com"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val id = FILE_ID.find(url)?.groupValues?.get(1)
        val target = if (id.isNullOrEmpty()) url else "$mainUrl/api/file/$id?download"
        callback(newExtractorLink(name, name, target) { this.referer = url })
    }

    private companion object {
        val FILE_ID = Regex("""/u/([^/?#]+)""")
    }
}

class PixelDrainDev : PixelDrain() {
    override val mainUrl = "https://pixeldrain.dev"
}
