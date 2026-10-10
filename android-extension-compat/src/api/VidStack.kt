package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.hostOf
import com.lagradost.cloudstream3.utils.httpsify
import kotlinx.coroutines.delay

open class VidStack : ExtractorApi() {

    override val name: String = "VidStack"

    override val mainUrl: String = "https://megaplay.buzz"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val base = hostRoot(url, mainUrl)
        val pageReferer = referer ?: base
        val headers = mapOf("User-Agent" to USER_AGENT, "X-Requested-With" to "XMLHttpRequest")
        val playback = mapOf("User-Agent" to USER_AGENT, "Origin" to base, "Referer" to "$base/")

        val asks = VidStackAsks()
        val page = playerPage(url, pageReferer)

        val playerId = page?.let { PLAYER_ID.find(it)?.groupValues?.get(1) }
        if (playerId != null &&
            emitFromSources(base, playerId, url, headers, playback, asks, subtitleCallback, callback)
        ) {
            return
        }

        if (emitFromConfig(base, videoId(url), url, headers, playback, asks, subtitleCallback, callback)) return

        if (page != null &&
            emitPlayerPage(name, name, url, page, pageReferer, playback, subtitleCallback, callback)
        ) {
            return
        }
        if (page == null) extractorLog("$name read no page from $url")
        else extractorLog("$name found no sources on $url")
    }

    private suspend fun emitFromSources(
        base: String,
        playerId: String,
        pageUrl: String,
        headers: Map<String, String>,
        playback: Map<String, String>,
        asks: VidStackAsks,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ): Boolean {
        val body = fetch("$base/stream/getSources?id=$playerId", pageUrl, headers, asks) ?: return false
        val tree = jsonTree(body) ?: return false

        emitTracks(tree.path("tracks"), pageUrl, subtitleCallback)

        val encrypted = tree.path("enc").asText("")
        val stream = when {
            encrypted.isNotBlank() -> streamInSources(decryptSources(encrypted))
            else -> tree.firstString("file", "source", "url")
        } ?: return false

        return emitStream(name, name, absolute(pageUrl, clean(stream)), pageUrl, null, playback, callback)
    }

    private suspend fun emitFromConfig(
        base: String,
        id: String,
        pageUrl: String,
        headers: Map<String, String>,
        playback: Map<String, String>,
        asks: VidStackAsks,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
        tries: Int = 2,
    ): Boolean {
        if (id.isBlank()) return false
        val body = fetch("$base/api/v1/video?id=$id", pageUrl, headers, asks) ?: return false

        val text = decodeHex(body)?.let { aesCbcDecrypt(it, CONFIG_KEY, CONFIG_IV) } ?: body
        val tree = jsonTreeMaybeBase64(text)

        if (tree != null) {
            emitTracks(tree.path("tracks"), pageUrl, subtitleCallback)
            emitTracks(tree.path("subtitles"), pageUrl, subtitleCallback)
        }

        val candidates = tree?.let { streamsInConfig(it) }.orEmpty()
            .ifEmpty { listOfNotNull(LOOSE_STREAM.find(unescapeSlashes(text))?.value) }

        val stream = candidates.mapNotNull { absoluteStream(it, base) }
            .minByOrNull { rankOf(it, base) }
        if (stream != null) return emitStream(name, name, stream, pageUrl, null, playback, callback)

        val pause = capacityPause(tree)
        if (pause == null || tries <= 1) return false
        delay(pause)
        return emitFromConfig(base, id, pageUrl, headers, playback, asks, subtitleCallback, callback, tries - 1)
    }

    private suspend fun fetch(
        url: String,
        referer: String,
        headers: Map<String, String>,
        asks: VidStackAsks,
    ): String? {
        var asked = 0
        while (asks.take()) {
            asked++
            val answer = try {
                if (asked == 1) app.get(url, referer = referer, headers = headers)
                else app.get(url, referer = referer, headers = headers, timeout = RETRY_TIMEOUT_S)
            } catch (t: Throwable) {
                extractorLog("$name request failed for $url: ${t.message}, $asked asked")
                return null
            }
            if (answer.isSuccessful) {
                if (asked > 1) extractorLog("$name read $url on ask $asked")
                return answer.text.takeIf { it.isNotBlank() }
            }
            if (asks.pause(answer.code)) continue
            extractorLog("$name ${refusalNote(answer.code)} ${answer.code} on $url, $asked asked")
            return null
        }
        extractorLog("$name had no asks left for $url")
        return null
    }

    private fun emitTracks(tracks: JsonNode, pageUrl: String, subtitleCallback: (SubtitleFile) -> Unit) {
        if (!tracks.isArray) return
        for (track in tracks) {
            val file = track.path("file").asText("").ifBlank { track.path("url").asText("") }
            if (file.isBlank()) continue
            val kind = track.path("kind").asText("")
            if (kind.contains("thumb", ignoreCase = true)) continue
            if (kind.isNotBlank() && !kind.contains("caption") && !kind.contains("subtitle")) continue
            val label = track.path("label").asText("").ifBlank { track.path("lang").asText("") }
            val lang = SubtitleHelper.fromTagToEnglishLanguageName(label) ?: label.ifBlank { "Unknown" }
            try {
                subtitleCallback(SubtitleFile(lang, absolute(pageUrl, httpsify(unescapeSlashes(file)))))
            } catch (t: Throwable) {
                extractorLog("$name subtitle emit failed: ${t.message}")
            }
        }
    }

    private fun decryptSources(encrypted: String): String? {
        val raw = decodeBase64Url(encrypted) ?: return null
        return aesCbcDecrypt(raw, SOURCES_KEY, SOURCES_IV)
    }

    private fun streamInSources(text: String?): String? {
        val tree = jsonTree(text ?: return null) ?: return null
        if (tree.isArray) {
            for (entry in tree) {
                val file = entry.path("file").asText("")
                if (file.isNotBlank()) return file
            }
            return null
        }
        return tree.firstString("file", "source", "url")
    }

    private fun streamsInConfig(tree: JsonNode): List<String> {
        val playlists = ArrayList<String>()
        val files = ArrayList<String>()
        val fields = tree.fields()
        while (fields.hasNext()) {
            val (key, node) = fields.next()
            if (!node.isTextual) continue
            if (key.contains("poster", ignoreCase = true) || key.contains("thumb", ignoreCase = true)) continue
            val value = unescapeSlashes(node.asText(""))
            when {
                value.contains(".m3u8") -> playlists.add(value)
                value.contains(".mp4") || value.contains(".mpd") -> files.add(value)
            }
        }
        if (playlists.isEmpty() && files.isEmpty()) {
            tree.firstString("source", "file", "url", "link")?.let { files.add(it) }
        }
        return playlists + files
    }

    private fun absoluteStream(candidate: String, base: String): String? {
        val raw = unescapeSlashes(candidate.trim())
        if (raw.isEmpty()) return null
        val full = when {
            raw.startsWith("http") || raw.startsWith("//") -> clean(raw)
            raw.startsWith("/") -> "$base$raw"
            else -> return null
        }
        val host = hostOf(full)
        return if (host.isNotEmpty() && HOSTNAME.matches(host)) full else null
    }

    private fun rankOf(url: String, base: String): Int {
        val host = hostOf(url)
        return when {
            host == hostOf(base) -> 0
            host.all { it.isDigit() || it == '.' } -> 2
            else -> 1
        }
    }

    private fun videoId(url: String): String {
        val fragment = url.substringAfterLast('#', "")
        if (fragment.isNotBlank()) return fragment.substringAfterLast('/')
        return url.substringBefore('?').trimEnd('/').substringAfterLast('/')
    }

    private companion object {
        const val RETRY_TIMEOUT_S = 4L

        val PLAYER_ID = Regex("""data-id\s*=\s*["'](\d+)["']""")
        val LOOSE_STREAM = Regex("""(?:https?://)?[^"'\s]*\.m3u8[^"'\s]*""")
        val HOSTNAME = Regex("""[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+""")

        val SOURCES_KEY = paddedKey("i?LMTAx0Q6,:}50U", 32)
        val SOURCES_IV = "W0;27ToaUpl_P%'c".toByteArray(Charsets.UTF_8)

        val CONFIG_KEY = "kiemtienmua911ca".toByteArray(Charsets.UTF_8)

        val CONFIG_IV = "1234567890oiuytr".toByteArray(Charsets.UTF_8)
    }
}

class MegaPlay : VidStack() {
    override val name = "Megaplay"
    override val mainUrl = "https://megaplay.buzz"
}

class MegaPlayOne : VidStack() {
    override val name = "Megaplay"
    override val mainUrl = "https://megaplay-1.buzz"
}

class VidStackIo : VidStack() {
    override val name = "Vidstack"
    override val mainUrl = "https://vidstack.io"
}

class UnsBio : VidStack() {
    override val name = "UnsBio"
    override val mainUrl = "https://animeav1.uns.bio"
}

class UpnsLive : VidStack() {
    override val name = "Upns"
    override val mainUrl = "https://upns.live"
}

class UpnsOne : VidStack() {
    override val name = "Upns"
    override val mainUrl = "https://upns.one"
}

class UpnsInk : VidStack() {
    override val name = "Upns"
    override val mainUrl = "https://upns.ink"
}
