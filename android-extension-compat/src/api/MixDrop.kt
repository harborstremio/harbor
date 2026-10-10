package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog

open class MixDrop : ExtractorApi() {

    override val name: String = "MixDrop"

    override val mainUrl: String = "https://mixdrop.co"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val embed = url.replace("/f/", "/e/")
        val root = hostRoot(embed, mainUrl)
        val page = playerPage(embed, referer ?: "$root/") ?: return

        val headers = mapOf("User-Agent" to USER_AGENT, "Referer" to "$root/", "Origin" to root)

        for (field in listOf("wurl", "hlsUrl", "vsrc")) {
            val raw = core(page, field) ?: continue
            val stream = absolute(embed, clean(raw))
            if (emitStream(name, name, stream, "$root/", null, headers, callback)) return
        }

        if (emitPlayerPage(name, name, embed, page, "$root/", headers, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    private fun core(page: String, field: String): String? =
        Regex("""MDCore\.$field\s*=\s*["']([^"']+)["']""").find(page)?.groupValues?.get(1)
            ?.takeIf { it.isNotBlank() }
}

class MixDropTop : MixDrop() {
    override val name = "MixDrop"
    override val mainUrl = "https://mixdrop.top"
}
