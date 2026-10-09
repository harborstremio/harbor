package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.M3u8Helper
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getAndUnpack
import com.lagradost.cloudstream3.utils.getQualityFromName
import com.lagradost.cloudstream3.utils.httpsify
import com.lagradost.cloudstream3.utils.inferExtractorLinkType

const val USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"

class PlayerSource(val url: String, val label: String?)

fun refusalPage(code: Int): Boolean = code == 429 || code == 502 || code == 504 || code in 520..530

suspend fun playerPage(
    url: String,
    referer: String?,
    headers: Map<String, String> = emptyMap(),
): String? = try {
    val response = app.get(
        url,
        referer = referer,
        headers = mapOf("User-Agent" to USER_AGENT, "Accept-Language" to "en-US,en;q=0.9") + headers,
    )
    if (refusalPage(response.code)) {
        extractorLog("page refused with ${response.code} on $url")
        null
    } else {
        val text = response.text
        if (text.isBlank()) null else getAndUnpack(text)
    }
} catch (t: Throwable) {
    extractorLog("page fetch failed for $url: ${t.message}")
    null
}

fun playerSources(raw: String): List<PlayerSource> {
    val script = unescapeSlashes(raw)
    val out = LinkedHashMap<String, PlayerSource>()

    for (match in FILE_ENTRY.findAll(script)) {
        val url = clean(match.groupValues[2])
        if (!looksPlayable(url)) continue
        val label = match.groupValues.getOrNull(3)?.takeIf { it.isNotBlank() }
        if (!out.containsKey(url)) out[url] = PlayerSource(url, label)
    }

    for (match in BARE_STREAM.findAll(script)) {
        val url = clean(match.value)
        if (!looksPlayable(url)) continue
        if (!out.containsKey(url)) out[url] = PlayerSource(url, null)
    }

    return out.values.toList()
}

fun playerTracks(raw: String, base: String): List<Pair<String, String>> {
    val script = unescapeSlashes(raw)
    val out = LinkedHashMap<String, String>()
    for (match in OBJECT_LITERAL.findAll(script)) {
        val body = match.value
        val url = field(body, "file") ?: field(body, "src") ?: continue
        val kind = field(body, "kind").orEmpty()
        if (kind.contains("thumb", ignoreCase = true)) continue
        val label = field(body, "label") ?: field(body, "language") ?: field(body, "lang")
        val isSubtitle = SUBTITLE_SUFFIX.any { pathOf(url)?.endsWith(it) == true } ||
            kind.equals("captions", ignoreCase = true) || kind.equals("subtitles", ignoreCase = true)
        if (!isSubtitle) continue
        val full = absolute(base, clean(url))
        val name = label?.takeIf { it.isNotBlank() } ?: "Unknown"
        val english = SubtitleHelper.fromTagToEnglishLanguageName(name) ?: name
        if (!out.containsKey(full)) out[full] = english
    }
    return out.map { (url, lang) -> lang to url }
}

suspend fun emitPlayerPage(
    source: String,
    name: String,
    pageUrl: String,
    script: String,
    referer: String,
    headers: Map<String, String> = emptyMap(),
    subtitleCallback: (SubtitleFile) -> Unit,
    callback: (ExtractorLink) -> Unit,
): Boolean {
    var produced = false

    for ((lang, url) in playerTracks(script, pageUrl)) {
        try {
            subtitleCallback(SubtitleFile(lang, url))
        } catch (t: Throwable) {
            extractorLog("subtitle emit failed for $url: ${t.message}")
        }
    }

    for (entry in playerSources(script)) {
        val url = absolute(pageUrl, entry.url)
        produced = emitStream(source, name, url, referer, entry.label, headers, callback) || produced
    }
    return produced
}

suspend fun emitStream(
    source: String,
    name: String,
    url: String,
    referer: String,
    label: String? = null,
    headers: Map<String, String> = emptyMap(),
    callback: (ExtractorLink) -> Unit,
): Boolean {
    val type = inferExtractorLinkType(url)
    if (type == ExtractorLinkType.M3U8) {
        val expanded = M3u8Helper.generateM3u8(source, url, referer, null, headers, name)
        expanded.forEach(callback)
        return expanded.isNotEmpty()
    }
    callback(
        ExtractorLink(
            source = source,
            name = name,
            url = url,
            referer = referer,
            quality = getQualityFromName(label ?: qualityHint(url)),
            type = type,
            headers = headers,
        ),
    )
    return true
}

fun qualityHint(url: String): String? =
    Regex("""[/_.-](\d{3,4})p?[/_.-]""").find(url)?.groupValues?.get(1)

fun looksPlayable(url: String): Boolean {
    val path = pathOf(url) ?: return false
    return PLAYABLE_SUFFIX.any { path.contains(it) }
}

fun pathOf(url: String): String? {
    if (!url.startsWith("http")) return null
    val rest = url.substringAfter("://", "")
    val slash = rest.indexOf('/')
    if (slash < 0) return null
    return rest.substring(slash).substringBefore('?').substringBefore('#').lowercase()
}

fun clean(raw: String): String =
    httpsify(raw.trim().trim('"', '\'', ',').replace("""\/""", "/").replace("&amp;", "&"))

fun unescapeSlashes(text: String): String = text.replace("""\/""", "/")

fun field(body: String, name: String): String? =
    Regex("""["']?$name["']?\s*:\s*["']([^"']*)["']""", RegexOption.IGNORE_CASE)
        .find(body)?.groupValues?.get(1)

private val PLAYABLE_SUFFIX = listOf(".m3u8", ".mpd", ".mp4", ".mkv", ".webm", ".m4v", "/manifest")

private val SUBTITLE_SUFFIX = listOf(".vtt", ".srt", ".ass", ".ssa", ".sub")

private val FILE_ENTRY = Regex(
    """["']?(file|src|source|url)["']?\s*:\s*["']([^"']+)["'](?:\s*,\s*["']?(?:label|quality|res)["']?\s*:\s*["']([^"']*)["'])?""",
    RegexOption.IGNORE_CASE,
)

private val BARE_STREAM = Regex("""https?://[^\s"'<>]+?\.(?:m3u8|mpd|mp4)[^\s"'<>]*""")

private val OBJECT_LITERAL = Regex("""\{[^{}]{0,500}\}""")

fun embedFileId(url: String): String? {
    val path = url.substringAfter("://", "").substringAfter('/', "")
        .substringBefore('?').substringBefore('#')
    val last = path.trimEnd('/').substringAfterLast('/').substringBefore('.')
    return last.removePrefix("embed-").takeIf { it.length >= 6 && it.all(Char::isLetterOrDigit) }
}

fun hostRoot(url: String, fallback: String): String = try {
    val uri = java.net.URI(httpsify(url.trim()))
    if (uri.host.isNullOrBlank()) fallback else "${uri.scheme ?: "https"}://${uri.host}"
} catch (t: Throwable) {
    fallback
}
