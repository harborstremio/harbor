package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.extractorLog

/** ok.ru, which anime extensions lean on as a mirror.
 *
 * The player state is an html escaped json blob in a data-options attribute, holding both a
 * progressive url per named quality and, on newer videos, an hls manifest. */
open class OkRu : ExtractorApi() {

    override val name: String = "Okru"

    override val mainUrl: String = "https://ok.ru"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val embed = url.replace("/video/", "/videoembed/")
        val page = try {
            app.get(embed, referer = referer ?: mainUrl, headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name page failed for $embed: ${t.message}")
            return
        }

        val options = OPTIONS.find(page)?.groupValues?.get(1) ?: page
        val decoded = options
            .replace("&quot;", "\"")
            .replace("&amp;", "&")
            .replace("\\u0026", "&")
            .replace("\u0026", "&")

        var produced = false
        for (match in VIDEO_ENTRY.findAll(decoded)) {
            val quality = QUALITY_NAMES[match.groupValues[1].lowercase()] ?: Qualities.Unknown.value
            val stream = clean(match.groupValues[2])
            if (!stream.startsWith("http")) continue
            callback(
                ExtractorLink(
                    source = name,
                    name = "$name ${match.groupValues[1]}",
                    url = stream,
                    referer = mainUrl,
                    quality = quality,
                    type = ExtractorLinkType.VIDEO,
                    headers = mapOf("User-Agent" to USER_AGENT),
                ),
            )
            produced = true
        }

        val hls = HLS.find(decoded)?.groupValues?.get(1)?.let { clean(it) }
        if (hls != null && hls.startsWith("http")) {
            produced = emitStream(name, name, hls, mainUrl, null, mapOf("User-Agent" to USER_AGENT), callback) || produced
        }

        if (!produced) extractorLog("$name found no sources on $url")
    }

    private companion object {
        val OPTIONS = Regex("data-options\\s*=\\s*\"([^\"]+)\"")
        val VIDEO_ENTRY = Regex("\"name\"\\s*:\\s*\"(\\w+)\"\\s*,\\s*\"url\"\\s*:\\s*\"([^\"]+)\"")
        val HLS = Regex("\"hlsManifestUrl\"\\s*:\\s*\"([^\"]+)\"")
        val QUALITY_NAMES = mapOf(
            "mobile" to Qualities.P144.value,
            "lowest" to Qualities.P240.value,
            "low" to Qualities.P360.value,
            "sd" to Qualities.P480.value,
            "hd" to Qualities.P720.value,
            "full" to Qualities.P1080.value,
            "quad" to Qualities.P1440.value,
            "ultra" to Qualities.P2160.value,
        )
    }
}
