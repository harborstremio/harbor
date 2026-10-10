package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

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

    protected open fun apiBase(url: String): String = hostRoot(url, mainUrl)

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

class ByseLapuix : Byse("Byse", "https://byselapuix.com")

class ByseKoze : Byse("Byse", "https://bysekoze.com")

class ByseSukior : Byse("Byse", "https://bysesukior.com")

class ByseVepoin : Byse("Byse", "https://bysevepoin.com")

class ByseWihe : Byse("Byse", "https://bysewihe.com")

class ByseZejataos : Byse("Byse", "https://bysezejataos.com")

class ByseSayeveum : Byse("Byse", "https://bysesayeveum.com")

class FilemoonByse : Byse("Filemoon", "https://filemoon.sx")

class FilemoonToByse : Byse("Filemoon", "https://filemoon.to")

class Gn1r5n : Byse("Byse", "https://gn1r5n.org")

class FilemoonIn : Byse("Filemoon", "https://filemoon.in") {
    override fun apiBase(url: String): String = "https://filemoon.sx"
}
