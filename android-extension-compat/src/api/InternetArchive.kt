package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.extractorLog
import java.net.URLEncoder

/** archive.org items, read from the metadata api. An item is a directory of files, so the work is
 * picking the playable ones and rebuilding their download urls. */
class InternetArchive : ExtractorApi() {

    override val name: String = "InternetArchive"

    override val mainUrl: String = "https://archive.org"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val identifier = identifier(url) ?: return
        val metadata = try {
            app.get("$mainUrl/metadata/$identifier", headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name metadata failed for $identifier: ${t.message}")
            return
        }

        val tree = jsonTree(metadata) ?: return
        if (tree.path("metadata").path("access-restricted-item").asBoolean(false)) {
            extractorLog("$name $identifier is access restricted, archive.org will not serve it")
            return
        }
        val server = tree.path("server").asText("").ifBlank { "archive.org" }
        val dir = tree.path("dir").asText("").ifBlank { "/$identifier" }

        var produced = false
        for (file in tree.path("files")) {
            val fileName = file.path("name").asText("")
            if (fileName.isBlank()) continue
            val lower = fileName.lowercase()
            if (PLAYABLE_SUFFIX.none { lower.endsWith(it) }) continue

            val audio = AUDIO_SUFFIX.any { lower.endsWith(it) }
            val height = file.path("height").asText("").toIntOrNull()?.takeIf { it > 0 }
            val encoded = fileName.split("/").joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }
            callback(
                ExtractorLink(
                    source = name,
                    name = "$name ${fileName.substringAfterLast('/')}${if (audio) " (audio)" else ""}",
                    url = "https://$server$dir/$encoded",
                    referer = mainUrl,
                    // Any positive quality is shown as a vertical resolution, so an audio file has
                    // to carry none rather than the unknown rung, which renders as 400p on an mp3.
                    quality = when {
                        audio -> 0
                        height != null -> Qualities.fromHeight(height).value
                        else -> Qualities.Unknown.value
                    },
                    type = ExtractorLinkType.VIDEO,
                ),
            )
            produced = true
        }

        if (!produced) extractorLog("$name found no playable file in $identifier")
    }

    private fun identifier(url: String): String? {
        PATTERNS.forEach { pattern ->
            pattern.find(url)?.groupValues?.getOrNull(1)?.takeIf { it.isNotBlank() }?.let { return it }
        }
        return null
    }

    private companion object {
        val PATTERNS = listOf(
            Regex("""/details/([^/?#]+)"""),
            Regex("""/download/([^/?#]+)"""),
            Regex("""/embed/([^/?#]+)"""),
            Regex("""/metadata/([^/?#]+)"""),
        )
        val VIDEO_SUFFIX = listOf(".mp4", ".mkv", ".webm", ".ogv", ".m4v", ".avi")

        /** The provider's own search asks archive.org for mediatype:(movies OR audio) and most of
         * what comes back is audio, whose only playable derivative is an mp3 or an ogg. A video
         * only list drops those items and reports them as having no playable file. */
        val AUDIO_SUFFIX = listOf(".mp3", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac", ".wav")

        val PLAYABLE_SUFFIX = VIDEO_SUFFIX + AUDIO_SUFFIX
    }
}
