package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.M3u8Helper
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName

class Blakite : ExtractorApi() {

    override val name: String = "Blakite"

    override val mainUrl: String = "https://blakiteapi.xyz"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val root = hostRoot(url, mainUrl)
        val embed = url.substringAfter("/embed/", "").substringBefore('?').trim('/')

        var tmdbId = embed.substringBefore('/').takeIf { it.isNotEmpty() }
        var base = root
        var unique = embed.substringAfter('/', "")

        if (tmdbId == null) {
            val page = playerPage(url, referer ?: "$root/") ?: return
            tmdbId = constant(page, "tmdbId") ?: return
            base = constant(page, "baseUrl") ?: root
            unique = constant(page, "uniqueId").orEmpty()
        }

        val query = if (unique.isEmpty()) "?tmdbId=$tmdbId" else "?id=$unique&tmdbId=$tmdbId"
        val answer = try {
            app.get("$base/api/get.php$query", referer = url, headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name api failed for $tmdbId: ${t.message}")
            return
        }

        val data = jsonTree(answer)?.path("data")
        val dataId = data?.path("dataId")?.asText("").orEmpty()
        if (data == null || dataId.isBlank()) {
            extractorLog("$name record carried no path for $url")
            return
        }
        val code = QUALITY_CODE[data.path("quality").asText("").lowercase()]
        if (code == null) {
            extractorLog("$name has no code for quality ${data.path("quality").asText("")}")
            return
        }

        val quality = data.path("quality").asText("")
        val file = "$CDN$dataId.$code"
        val playback = mapOf("User-Agent" to USER_AGENT, "Referer" to "$root/")

        if (data.path("format").asText("").equals("M3U8", ignoreCase = true)) {
            val range = rangeFor(data.path("ranges").asText(""), quality)
            if (range == null) {
                extractorLog("$name listed no byte range for $quality on $url")
                return
            }
            val playlist = "$file.tar?r_file=chunklist.m3u8" +
                "&r_type=application%2Fvnd.apple.mpegurl&r_range=$range"
            M3u8Helper.generateM3u8(name, playlist, "$root/", getQualityFromName(quality), playback, name)
                .forEach(callback)
            return
        }

        emitStream(name, name, "$file.mp4", "$root/", quality, playback, callback)
    }

    private fun rangeFor(ranges: String, quality: String): String? {
        for (line in ranges.lines()) {
            val match = RANGE.find(line.trim()) ?: continue
            if (match.groupValues[2].trim().equals(quality, ignoreCase = true)) return match.groupValues[1]
        }
        return null
    }

    private fun constant(page: String, field: String): String? =
        Regex("""$field\s*=\s*["']([^"']+)["']""").find(page)?.groupValues?.get(1)

    private companion object {
        const val CDN = "https://hugh.cdn.rumble.cloud/video/"
        val RANGE = Regex("""^(\d+-\d+)\s*\(([^)]+)\)""")
        val QUALITY_CODE = mapOf(
            "240p" to "oaa",
            "360p" to "baa",
            "480p" to "caa",
            "720p" to "gaa",
            "1080p" to "haa",
        )
    }
}
