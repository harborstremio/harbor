package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.newExtractorLink

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

class PixelDrainNet : PixelDrain() {
    override val mainUrl = "https://pixeldrain.net"
}
