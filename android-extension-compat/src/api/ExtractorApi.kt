package com.lagradost.cloudstream3.utils

import com.lagradost.cloudstream3.SubtitleFile

/** Passed by an extension that wants the url to decide the link type. It is deliberately null,
 * because that is what the extensions were compiled against, and null is what [newExtractorLink]
 * reads as "infer". */
val INFER_TYPE: ExtractorLinkType? = null

/** One host an extension can pull streams from.
 *
 * Extensions subclass this both to describe hosts the layer does not know about and to override a
 * host it does know about with their own scraping, so every member reached from a subclass has to
 * stay open and every entry point has to survive a throwing subclass without taking the whole
 * link load down with it. */
abstract class ExtractorApi {

    abstract val name: String

    abstract val mainUrl: String

    abstract val requiresReferer: Boolean

    /** The modern entry point. Callback based, so an extractor can emit a link the moment it
     * resolves one instead of holding the whole list until the slowest mirror answers. */
    open suspend fun getUrl(
        url: String,
        referer: String? = null,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        getUrl(url, referer)?.forEach(callback)
    }

    /** The older list returning entry point. Extensions written against it override this one and
     * never touch the callback form, so the default above has to delegate here. */
    open suspend fun getUrl(url: String, referer: String? = null): List<ExtractorLink>? = null

    /** Turns a bare id into a page url on this host. */
    open fun getExtractorUrl(id: String): String = id

    /** Never throws, whatever the subclass does. */
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

/** Builds a link and hands it to the extension to finish. Kotlin emits the $default bridge the
 * extensions link against from the two trailing defaults, so their positions are load bearing. */
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

/** Resolves [url] through the registry and reports whether anything playable came out.
 *
 * The three argument form exists as its own overload rather than as a default, because the
 * extensions call both arities directly and a default would replace one of them with a bridge. */
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

/** Reads a quality out of whatever a page called it. */
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

/** Protocol relative urls are everywhere in embed pages and no http client accepts one. */
fun httpsify(url: String): String = if (url.startsWith("//")) "https:$url" else url

/** The packed javascript block inside a page, if there is one. */
fun getPacked(string: String): String? =
    PACKED.find(string)?.value ?: PACKED_LOOSE.find(string)?.value

/** The page with its packed block replaced by the unpacked source, or the page unchanged. */
fun getAndUnpack(string: String): String {
    val packed = getPacked(string) ?: return string
    return JsUnpacker(packed).unpack() ?: string
}

private val PACKED = Regex(
    """eval\(function\(p,a,c,k,e,[^)]*\)\{.+?\.split\('\|'\)[^)]*\)\)""",
    RegexOption.DOT_MATCHES_ALL,
)

private val PACKED_LOOSE = Regex(
    """eval\(function\(p,a,c,k,e,[^)]*\).+?\.split\('\|'\)\s*\)\s*\)""",
    RegexOption.DOT_MATCHES_ALL,
)
