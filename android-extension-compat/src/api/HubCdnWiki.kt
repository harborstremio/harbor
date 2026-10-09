package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.base64DecodeArray
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class HubCdnWiki : ExtractorApi() {

    override val name: String = "HubCDN"

    override val mainUrl: String = "https://hubcdn.wiki"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val headers = mapOf("User-Agent" to USER_AGENT)
        val page = playerPage(url, referer ?: hostRoot(url, mainUrl), headers) ?: return

        val payload = GATE.find(page)?.groupValues?.get(1)
        if (payload == null) {
            extractorLog("$name found no gate payload on $url")
            return
        }

        val decoded = String(base64DecodeArray(payload), Charsets.UTF_8)
        val file = clean(decoded.substringAfter("link=", ""))
        if (!file.startsWith("http")) {
            extractorLog("$name gate payload on $url named no address")
            return
        }

        if (!emitStream(name, name, file, url, null, headers, callback)) {
            extractorLog("$name could not emit $file")
        }
    }

    private companion object {
        val GATE = Regex("""[?&]r=([A-Za-z0-9+/=]{24,})""")
    }
}

class HubCdnClub : HubCdnWiki() {
    override val mainUrl: String = "https://hubcdn.club"
}
