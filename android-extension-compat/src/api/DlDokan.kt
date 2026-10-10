package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

class DlDokan : ExtractorApi() {

    override val name: String = "DlDokan"

    override val mainUrl: String = "https://dldokan.online"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val token = tokenIn(url) ?: return
        val root = hostRoot(url, mainUrl)
        val headers = mapOf("User-Agent" to USER_AGENT)

        for (endpoint in ENDPOINTS) {
            val page = try {
                app.get("$root/download/$endpoint?token=$token", referer = url, headers = headers).text
            } catch (t: Throwable) {
                extractorLog("$name $endpoint failed for $token: ${t.message}")
                continue
            }
            val file = MEDIA.find(page)?.value ?: continue
            if (emitStream(name, name, clean(file), url, null, headers, callback)) return
        }
        extractorLog("$name found no file for $token")
    }

    private fun tokenIn(url: String): String? {
        Regex("""[?&]token=([^&#]+)""").find(url)?.groupValues?.get(1)?.let { return it }
        return url.substringBefore('?').trimEnd('/').substringAfterLast('/').takeIf { it.isNotBlank() }
    }

    private companion object {
        val ENDPOINTS = listOf("instant.php", "player.php")

        val MEDIA = Regex("""https://[^"'\s<>]+\.(?:mkv|mp4|m3u8)(?:\?[^"'\s<>]*)?""")
    }
}
