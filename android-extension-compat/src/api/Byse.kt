package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

/** The frontend nine of these domains share, which serves its playback blob to anyone who asks.
 *
 * The page is a script application with no stream url in it, so reading the page finds nothing on
 * any of these hosts. The application asks its own api for the video record, and that record
 * carries the playlist url encrypted beside every part of the key needed to read it, with no
 * token, no signature and no challenge in front of it. Measured against a live embed on
 * 2026-09-24: the api answers 200 to a plain request carrying the embed page as referer, the
 * playlist that comes out answers 200 as an hls master, and its first segment starts with the
 * mpeg transport sync byte, so this resolves to media rather than to something merely shaped
 * like a url.
 *
 * The record names its own algorithm and version. The version picks which two of the key parts
 * are the key, and the pairing is the version and thirty one minus it, one based. Proved on three
 * videos carrying versions 4, 11 and 18, on three of the nine domains. A version outside the pairs
 * falls back to every part in order, which is what the application does, and a key that then comes
 * out the wrong length for the cipher is refused rather than guessed at. */
open class Byse(
    override val name: String,
    override val mainUrl: String,
) : ExtractorApi() {

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val base = apiBase(url)
        val code = videoCode(url)
        if (code.isEmpty()) return

        val body = try {
            app.get("$base/api/videos/$code", referer = url, headers = mapOf("User-Agent" to USER_AGENT)).text
        } catch (t: Throwable) {
            extractorLog("$name record fetch failed for $code: ${t.message}")
            return
        }

        val playback = jsonTree(body)?.path("playback")
        if (playback == null || playback.isMissingNode) {
            extractorLog("$name record for $code carries no playback block")
            return
        }

        val parts = playback.path("key_parts").mapNotNull { it.asText("").takeIf(String::isNotEmpty) }
        val key = chosen(parts, playback.path("version").asInt(0))
            .mapNotNull(::decodeBase64Url)
            .fold(ByteArray(0)) { acc, part -> acc + part }
        val iv = decodeBase64Url(playback.path("iv").asText(""))
        val blob = decodeBase64Url(playback.path("payload").asText(""))
        if (key.size !in KEY_SIZES || iv == null || blob == null || blob.size <= TAG_BYTES) {
            extractorLog("$name playback block for $code is not the shape this reads")
            return
        }

        emit(aesGcmDecrypt(blob, key, iv) ?: return, base, subtitleCallback, callback)
    }

    private suspend fun emit(
        config: String,
        base: String,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val playback = mapOf("User-Agent" to USER_AGENT, "Origin" to base, "Referer" to "$base/")
        for ((lang, file) in playerTracks(config, base)) {
            try {
                subtitleCallback(SubtitleFile(lang, file))
            } catch (t: Throwable) {
                extractorLog("$name subtitle emit failed: ${t.message}")
            }
        }

        var produced = false
        val sources = jsonTree(config)?.path("sources")
        for (source in sources ?: return) {
            val stream = source.path("url").asText("")
            if (stream.isBlank()) continue
            val label = source.path("label").asText("").ifBlank { source.path("height").asText("") }
            produced = emitStream(name, name, clean(stream), "$base/", label, playback, callback) || produced
        }
        if (!produced) extractorLog("$name read the config for $base and found no source in it")
    }

    /** Which host is asked for the record, and whose referer the link is then signed against. The
     * host in the url, unless that domain has stopped answering and its codes are still in the
     * pool, in which case a domain that does answer is asked instead. */
    protected open fun apiBase(url: String): String = hostRoot(url, mainUrl)

    /** The two parts the version pairs, or every part when the version is not one it pairs. */
    private fun chosen(parts: List<String>, version: Int): List<String> {
        val pair = listOf(version, PAIR_SUM - version)
        if (pair.any { it < 1 || it > parts.size }) return parts
        return pair.map { parts[it - 1] }
    }

    private fun videoCode(url: String): String =
        url.substringBefore('?').substringBefore('#').trimEnd('/').substringAfterLast('/')

    private companion object {
        const val PAIR_SUM = 31
        const val TAG_BYTES = 16
        val KEY_SIZES = setOf(16, 24, 32)
    }
}

/** One class per domain because the registry claims a host, not a family. The label stays the
 * frontend rather than the domain, because these domains rotate and none of them is a name a user
 * would recognise. The two filemoon domains keep their own label since that name is on the page.
 * All nine answer the same api with the same code, so a record read from one reads on the rest. */
class ByseLapuix : Byse("Byse", "https://byselapuix.com")

class ByseKoze : Byse("Byse", "https://bysekoze.com")

class ByseSukior : Byse("Byse", "https://bysesukior.com")

class ByseVepoin : Byse("Byse", "https://bysevepoin.com")

class ByseWihe : Byse("Byse", "https://bysewihe.com")

class ByseZejataos : Byse("Byse", "https://bysezejataos.com")

class FilemoonByse : Byse("Filemoon", "https://filemoon.sx")

class FilemoonToByse : Byse("Filemoon", "https://filemoon.to")

class Gn1r5n : Byse("Byse", "https://gn1r5n.org")

/** filemoon.in has been held at its registrar and answers NXDOMAIN on every name server since
 * before this layer existed, so its page can never be fetched. One extension still hands out links
 * on it, and the codes in those links are in the same pool every domain above reads, so the record
 * is asked of a domain that answers instead of the one in the url. */
class FilemoonIn : Byse("Filemoon", "https://filemoon.in") {
    override fun apiBase(url: String): String = "https://filemoon.sx"
}
