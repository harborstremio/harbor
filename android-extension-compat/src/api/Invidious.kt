package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName

/** Invidious instances.
 *
 * Instances come and go, so the api call is aimed at the host of the url that arrived rather than
 * at the registered main url, and a new instance only has to be added to the registry to be
 * reachable by host match. */
open class Invidious : ExtractorApi() {

    override val name: String = "Invidious"

    override val mainUrl: String = "https://inv.nadeko.net"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val id = videoId(url) ?: return
        val body = try {
            app.get("$root/api/v1/videos/$id", headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name api failed for $id: ${t.message}")
            return
        }

        val tree = jsonTree(body) ?: return

        val hls = tree.path("hlsUrl").asText("")
        if (hls.isNotBlank()) {
            emitStream(name, name, absolute(root, hls), root, null, emptyMap(), callback)
        }

        for (format in tree.path("formatStreams")) {
            val stream = format.path("url").asText("")
            if (stream.isBlank()) continue
            val label = format.path("qualityLabel").asText("").ifBlank { format.path("quality").asText("") }
            callback(
                ExtractorLink(
                    source = name,
                    name = "$name $label".trim(),
                    url = stream,
                    referer = root,
                    quality = if (label.isBlank()) Qualities.Unknown.value else getQualityFromName(label),
                    type = ExtractorLinkType.VIDEO,
                ),
            )
        }

        for (caption in tree.path("captions")) {
            val captionUrl = caption.path("url").asText("")
            if (captionUrl.isBlank()) continue
            val label = caption.path("label").asText("").ifBlank { caption.path("language_code").asText("") }
            val english = SubtitleHelper.fromTagToEnglishLanguageName(label) ?: label.ifBlank { "Unknown" }
            subtitleCallback(SubtitleFile(english, absolute(root, captionUrl)))
        }
    }

    private fun videoId(url: String): String? =
        Regex("""[?&]v=([A-Za-z0-9_-]{6,})""").find(url)?.groupValues?.get(1)
            ?: Regex("""/(?:watch|embed|v)/([A-Za-z0-9_-]{6,})""").find(url)?.groupValues?.get(1)
}
