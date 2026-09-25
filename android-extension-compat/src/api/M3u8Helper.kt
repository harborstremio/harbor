package com.lagradost.cloudstream3.utils

import com.lagradost.cloudstream3.app
import java.net.URI

/** Expands an m3u8 master playlist into one link per variant.
 *
 * Extensions hand the layer a single master url and expect the quality list a user sees to come
 * back, so this fetches the playlist and reads the variant stream declarations. When the fetch or
 * the parse fails the master url is still returned as one link, because a player that can read
 * playlists will do the selection itself and a stream is better than an empty list. */
class M3u8Helper {

    companion object {

        suspend fun generateM3u8(
            source: String,
            streamUrl: String,
            referer: String,
            quality: Int? = null,
            headers: Map<String, String> = emptyMap(),
            name: String = source,
        ): List<ExtractorLink> {
            val master = httpsify(streamUrl.trim())
            if (master.isEmpty()) return emptyList()

            val playlist = fetch(master, referer, headers)
                ?: return listOf(link(source, name, master, referer, quality, headers))

            val variants = parseVariants(master, playlist)
            if (variants.isEmpty()) {
                return listOf(link(source, name, master, referer, quality, headers))
            }

            return variants
                .sortedByDescending { it.quality }
                .map { variant ->
                    val label = if (variant.quality > 0) "$name ${variant.quality}p" else name
                    link(source, label, variant.url, referer, quality ?: variant.quality, headers)
                }
        }

        /** Same expansion, for callers that already hold the playlist text. */
        fun fromPlaylist(
            source: String,
            name: String,
            masterUrl: String,
            playlist: String,
            referer: String,
            headers: Map<String, String> = emptyMap(),
        ): List<ExtractorLink> {
            val variants = parseVariants(masterUrl, playlist)
            if (variants.isEmpty()) return listOf(link(source, name, masterUrl, referer, null, headers))
            return variants.sortedByDescending { it.quality }.map {
                link(source, if (it.quality > 0) "$name ${it.quality}p" else name, it.url, referer, it.quality, headers)
            }
        }

        private class Variant(val url: String, val quality: Int)

        private fun parseVariants(masterUrl: String, playlist: String): List<Variant> {
            if (!playlist.contains("#EXT-X-STREAM-INF")) return emptyList()
            val out = ArrayList<Variant>()
            val lines = playlist.lines()
            var i = 0
            while (i < lines.size) {
                val line = lines[i].trim()
                if (line.startsWith("#EXT-X-STREAM-INF")) {
                    val target = lines.drop(i + 1).firstOrNull { it.isNotBlank() && !it.startsWith("#") }
                    if (target != null) {
                        out.add(Variant(absolute(masterUrl, target.trim()), qualityOf(line)))
                    }
                }
                i++
            }
            return out.distinctBy { it.url }
        }

        private fun qualityOf(attributes: String): Int {
            RESOLUTION.find(attributes)?.groupValues?.get(2)?.toIntOrNull()?.let {
                return Qualities.fromHeight(it).value
            }
            val bandwidth = BANDWIDTH.find(attributes)?.groupValues?.get(1)?.toIntOrNull() ?: return 0
            return when {
                bandwidth >= 12_000_000 -> Qualities.P2160.value
                bandwidth >= 7_000_000 -> Qualities.P1440.value
                bandwidth >= 4_000_000 -> Qualities.P1080.value
                bandwidth >= 2_000_000 -> Qualities.P720.value
                bandwidth >= 900_000 -> Qualities.P480.value
                bandwidth >= 500_000 -> Qualities.P360.value
                else -> Qualities.P240.value
            }
        }

        private fun link(
            source: String,
            name: String,
            url: String,
            referer: String,
            quality: Int?,
            headers: Map<String, String>,
        ) = ExtractorLink(
            source = source,
            name = name,
            url = url,
            referer = referer,
            quality = quality ?: Qualities.Unknown.value,
            type = ExtractorLinkType.M3U8,
            headers = headers,
        )

        private suspend fun fetch(url: String, referer: String, headers: Map<String, String>): String? = try {
            val response = app.get(url, headers = headers, referer = referer)
            val text = response.text
            if (text.contains("#EXTM3U")) text else null
        } catch (t: Throwable) {
            extractorLog("m3u8 fetch failed for $url: ${t.message}")
            null
        }

        private val RESOLUTION = Regex("""RESOLUTION=(\d+)x(\d+)""")
        private val BANDWIDTH = Regex("""BANDWIDTH=(\d+)""")
    }
}

/** Resolves a playlist entry against the playlist it came from. */
internal fun absolute(base: String, target: String): String {
    val fixed = httpsify(target)
    if (fixed.startsWith("http://") || fixed.startsWith("https://")) return fixed
    return try {
        URI(base).resolve(fixed).toString()
    } catch (t: Throwable) {
        fixed
    }
}
