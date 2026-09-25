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

/** The vidstack player family: megaplay and its mirrors, and the uns.bio players.
 *
 * Extensions subclass this and override nothing but the name and the domain, so the two api
 * shapes below have to be picked apart from the page rather than from which subclass is running.
 * Which one a host speaks is decided by whether its player page carries a numeric player id.
 *
 * The megaplay shape: the page carries data-id, /stream/getSources answers with plaintext
 * subtitle tracks beside an encrypted stream url.
 * The uns.bio shape: /api/v1/video answers with one hex blob that is the whole player config. */
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

        val page = playerPage(url, pageReferer)

        val playerId = page?.let { PLAYER_ID.find(it)?.groupValues?.get(1) }
        if (playerId != null &&
            emitFromSources(base, playerId, url, headers, playback, subtitleCallback, callback)
        ) {
            return
        }

        if (emitFromConfig(base, videoId(url), url, headers, playback, subtitleCallback, callback)) return

        if (page != null &&
            emitPlayerPage(name, name, url, page, pageReferer, playback, subtitleCallback, callback)
        ) {
            return
        }
        extractorLog("$name found no sources on $url")
    }

    /** The megaplay endpoint. Subtitles arrive in the clear, the stream url does not. */
    private suspend fun emitFromSources(
        base: String,
        playerId: String,
        pageUrl: String,
        headers: Map<String, String>,
        playback: Map<String, String>,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ): Boolean {
        val body = fetch("$base/stream/getSources?id=$playerId", pageUrl, headers) ?: return false
        val tree = jsonTree(body) ?: return false

        emitTracks(tree.path("tracks"), pageUrl, subtitleCallback)

        val encrypted = tree.path("enc").asText("")
        val stream = when {
            encrypted.isNotBlank() -> streamInSources(decryptSources(encrypted))
            else -> tree.firstString("file", "source", "url")
        } ?: return false

        return emitStream(name, name, absolute(pageUrl, clean(stream)), pageUrl, null, playback, callback)
    }

    /** The uns.bio endpoint. One hex blob holds the whole player config, stream url included. */
    private suspend fun emitFromConfig(
        base: String,
        id: String,
        pageUrl: String,
        headers: Map<String, String>,
        playback: Map<String, String>,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ): Boolean {
        if (id.isBlank()) return false
        val body = fetch("$base/api/v1/video?id=$id", pageUrl, headers) ?: return false

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
            ?: return false

        return emitStream(name, name, stream, pageUrl, null, playback, callback)
    }

    private suspend fun fetch(url: String, referer: String, headers: Map<String, String>): String? = try {
        app.get(url, referer = referer, headers = headers).text.takeIf { it.isNotBlank() }
    } catch (t: Throwable) {
        extractorLog("$name request failed for $url: ${t.message}")
        null
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

    /** The megaplay payload decrypts to either one object or a list of them. */
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

    /** The config names its stream after the cdn that will serve it, so the field to read is
     * whichever one holds a playlist, not a field with a fixed name. Poster and thumbnail fields
     * are dropped by name, because a thumbnail track is a real vtt and would otherwise win.
     *
     * Every match is kept rather than the first, because the same episode is listed on several
     * cdns and which of them a viewer can reach is not something field order decides. */
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

    /** A candidate as an absolute url, or null when it is not one.
     *
     * The null cases are the point. A config whose first block failed to decrypt leaves readable
     * text further in, the loose regex then matches inside the corrupt bytes, and gluing that to
     * the host produced urls like `https://<host>z!rhtqbj` that fail dns and read to a user as a
     * broken player. A relative candidate has to start at the root and a host has to be a host. */
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

    /** A config on these players lists the same stream on the embed's own host, on named cdns and
     * on bare addresses. The embed host is a proxy that answers wherever the page loaded; the bare
     * addresses are origins that a home connection often cannot open at all, so they go last. */
    private fun rankOf(url: String, base: String): Int {
        val host = hostOf(url)
        return when {
            host == hostOf(base) -> 0
            host.all { it.isDigit() || it == '.' } -> 2
            else -> 1
        }
    }

    /** The player id on the megaplay pages, and the embed id everywhere else. The embed id is in
     * the fragment on the uns.bio links and in the last path segment on the rest. */
    private fun videoId(url: String): String {
        val fragment = url.substringAfterLast('#', "")
        if (fragment.isNotBlank()) return fragment.substringAfterLast('/')
        return url.substringBefore('?').trimEnd('/').substringAfterLast('/')
    }

    private companion object {
        val PLAYER_ID = Regex("""data-id\s*=\s*["'](\d+)["']""")
        val LOOSE_STREAM = Regex("""(?:https?://)?[^"'\s]*\.m3u8[^"'\s]*""")
        val HOSTNAME = Regex("""[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+""")

        val SOURCES_KEY = paddedKey("i?LMTAx0Q6,:}50U", 32)
        val SOURCES_IV = "W0;27ToaUpl_P%'c".toByteArray(Charsets.UTF_8)

        val CONFIG_KEY = "kiemtienmua911ca".toByteArray(Charsets.UTF_8)

        /** Recovered on 2026-09-24 by solving for it rather than guessing: CBC leaves every block
         * but the first correct under a wrong IV, so D(C0) came out of the known bad decrypt and
         * the real IV is that xored with the plaintext the second block proves, `{"source":"https`. */
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

/** Served by the same engine as megaplay, not by the wish players its name suggests. */
class Vidwish : VidStack() {
    override val name = "Vidwish"
    override val mainUrl = "https://vidwish.live"
}

class VidTube : VidStack() {
    override val name = "Vidtube"
    override val mainUrl = "https://vidtube.site"
}

class VidStackIo : VidStack() {
    override val name = "Vidstack"
    override val mainUrl = "https://vidstack.io"
}

/** The uns.bio players, which speak the config shape above.
 *
 * Registered on the parent domain rather than one class per site, because the registry matches a
 * parent host and this operator adds a subdomain for every site it serves: animeav1, allanime and
 * watchanime today. Two extensions ship their own copy of this and win while they are loaded, so
 * what this entry buys is a fallback for the day one of them drops it. */
class UnsBio : VidStack() {
    override val name = "UnsBio"
    override val mainUrl = "https://uns.bio"
}
