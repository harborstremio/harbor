package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class DirectFileReader(
    override val name: String,
    override val mainUrl: String,
    private val everyPathIsAFile: Boolean = false,
) : ExtractorApi() {

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        if (!everyPathIsAFile && !looksPlayable(url)) return
        val headers = mapOf("User-Agent" to USER_AGENT)
        val type = try {
            app.head(url, referer = referer, headers = headers)
                .takeIf { it.isSuccessful }
                ?.headers?.get("content-type").orEmpty().substringBefore(';').trim().lowercase()
        } catch (t: Throwable) {
            extractorLog("$name head failed for $url: ${t.message}")
            return
        }
        if (MEDIA.none { type.startsWith(it) }) return
        emitStream(name, name, url, referer ?: url, null, headers, callback)
    }

    private companion object {
        val MEDIA = listOf(
            "video/",
            "audio/",
            "application/octet-stream",
            "application/vnd.apple",
            "application/x-mpeg",
            "application/dash",
        )
    }
}

object DirectFile : DirectFileReader("Direct", "")

class GoogleVideoDownload : DirectFileReader(
    "GoogleVideo",
    "https://video-downloads.googleusercontent.com",
    everyPathIsAFile = true,
)
