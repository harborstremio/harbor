package com.lagradost.cloudstream3.utils

import com.lagradost.cloudstream3.SubtitleFile
import java.util.UUID

val INFER_TYPE: ExtractorLinkType? = null

abstract class ExtractorApi {

    abstract val name: String

    abstract val mainUrl: String

    abstract val requiresReferer: Boolean

    open suspend fun getUrl(
        url: String,
        referer: String? = null,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        getUrl(url, referer)?.forEach(callback)
    }

    open suspend fun getUrl(url: String, referer: String? = null): List<ExtractorLink>? = null

    open fun getExtractorUrl(id: String): String = id

    suspend fun getSafeUrl(
        url: String,
        referer: String? = null,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        try {
            getUrl(url, referer, subtitleCallback, callback)
        } catch (t: Throwable) {
            extractorLog("$name failed on $url: ${t::class.java.simpleName}: ${t.message}")
        }
    }
}

suspend fun newExtractorLink(
    source: String,
    name: String,
    url: String,
    type: ExtractorLinkType? = INFER_TYPE,
    initializer: suspend ExtractorLink.() -> Unit = { },
): ExtractorLink {
    val link = ExtractorLink(
        source = source,
        name = name,
        url = url,
        type = type ?: inferExtractorLinkType(url),
    )
    link.initializer()
    if (type == null) link.type = inferExtractorLinkType(link.url)
    return link
}

suspend fun newDrmExtractorLink(
    source: String,
    name: String,
    url: String,
    type: ExtractorLinkType = ExtractorLinkType.DASH,
    uuid: UUID = DrmExtractorLink.CLEARKEY,
    initializer: suspend DrmExtractorLink.() -> Unit = { },
): DrmExtractorLink {
    val link = DrmExtractorLink(source = source, name = name, url = url, type = type, uuid = uuid)
    link.initializer()
    return link
}

fun ExtractorApi.fixUrl(url: String): String {
    if (url.startsWith("//")) return "https:$url"
    if (url.startsWith("http")) return url
    if (url.isEmpty()) return ""
    val base = mainUrl.trimEnd('/')
    return if (url.startsWith("/")) base + url else "$base/$url"
}

suspend fun loadExtractor(
    url: String,
    subtitleCallback: (SubtitleFile) -> Unit,
    callback: (ExtractorLink) -> Unit,
): Boolean = loadExtractor(url, null, subtitleCallback, callback)

suspend fun loadExtractor(
    url: String,
    referer: String?,
    subtitleCallback: (SubtitleFile) -> Unit,
    callback: (ExtractorLink) -> Unit,
): Boolean {
    val target = httpsify(url.trim())
    if (target.isEmpty()) return false

    var produced = 0
    val collect: (ExtractorLink) -> Unit = { link ->
        produced++
        callback(link)
    }

    val watch = extractorWatch
    val ran = if (watch == null) null else ArrayList<String>()
    try {
        for (api in extractorsFor(target)) {
            ran?.add(api.name)
            api.getSafeUrl(target, referer ?: api.mainUrl, subtitleCallback, collect)
            if (produced > 0) break
        }
    } finally {
        if (watch != null) {
            watch(
                ExtractorProbe(
                    url = target,
                    host = hostOf(target),
                    named = namedExtractorsFor(target).map { it.name },
                    ran = ran.orEmpty(),
                    produced = produced,
                ),
            )
        }
    }
    return produced > 0
}

fun getQualityFromName(qualityName: String?): Int {
    val raw = qualityName?.trim()?.lowercase() ?: return Qualities.Unknown.value
    if (raw.isEmpty()) return Qualities.Unknown.value

    NAMED_QUALITIES[raw]?.let { return it }
    for ((word, value) in NAMED_QUALITIES) {
        if (raw.contains(word)) return value
    }

    val digits = Regex("""(\d{3,4})""").find(raw)?.groupValues?.get(1)?.toIntOrNull()
        ?: return Qualities.Unknown.value
    return Qualities.fromHeight(digits).value
}

private val NAMED_QUALITIES = linkedMapOf(
    "2160p" to Qualities.P2160.value,
    "1440p" to Qualities.P1440.value,
    "1080p" to Qualities.P1080.value,
    "720p" to Qualities.P720.value,
    "480p" to Qualities.P480.value,
    "360p" to Qualities.P360.value,
    "240p" to Qualities.P240.value,
    "144p" to Qualities.P144.value,
    "4k" to Qualities.P2160.value,
    "uhd" to Qualities.P2160.value,
    "2k" to Qualities.P1440.value,
    "qhd" to Qualities.P1440.value,
    "fullhd" to Qualities.P1080.value,
    "full hd" to Qualities.P1080.value,
    "fhd" to Qualities.P1080.value,
    "hd" to Qualities.P720.value,
    "sd" to Qualities.P480.value,
    "low" to Qualities.P360.value,
)

fun httpsify(url: String): String = if (url.startsWith("//")) "https:$url" else url

fun getPacked(string: String): String? =
    PACKED.find(string)?.value ?: PACKED_LOOSE.find(string)?.value

fun getAndUnpack(string: String): String {
    val block = PACKED.find(string) ?: PACKED_LOOSE.find(string) ?: return string
    val unpacked = JsUnpacker(block.value).unpack() ?: return string
    return string.substring(0, block.range.first) + unpacked + string.substring(block.range.last + 1)
}

private val PACKED = Regex(
    """eval\(function\(p,a,c,k,e,[^)]*\)\{.+?\.split\('\|'\)[^)]*\)\)""",
    RegexOption.DOT_MATCHES_ALL,
)

private val PACKED_LOOSE = Regex(
    """eval\(function\(p,a,c,k,e,[^)]*\).+?\.split\('\|'\)\s*\)\s*\)""",
    RegexOption.DOT_MATCHES_ALL,
)
