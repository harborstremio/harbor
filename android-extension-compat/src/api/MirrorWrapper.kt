package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.StringUtils.decodeUri
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.hostOf
import com.lagradost.cloudstream3.utils.loadExtractor

abstract class MirrorWrapper(
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
        val here = hostOf(url)
        val mirrors = try {
            mirrors(url, referer)
                .filter { it.startsWith("http") && hostOf(it).let { host -> host.isNotEmpty() && host != here } }
                .distinct()
                .take(MAX_MIRRORS)
        } catch (t: Throwable) {
            extractorLog("$name mirror list failed for $url: ${t.message}")
            return
        }

        if (mirrors.isEmpty()) {
            extractorLog("$name found no mirror on $url")
            return
        }

        var produced = 0
        val counted: (ExtractorLink) -> Unit = {
            produced++
            callback(it)
        }
        for (mirror in mirrors) {
            try {
                loadExtractor(mirror, url, subtitleCallback, counted)
            } catch (t: Throwable) {
                extractorLog("$name mirror failed for $mirror: ${t.message}")
            }
            if (produced > 0) return
        }
        extractorLog("$name resolved none of ${mirrors.size} mirrors on $url")
    }

    protected abstract suspend fun mirrors(url: String, referer: String?): List<String>
}

class AnimeDekhoWrapper : MirrorWrapper("AnimeDekho", "https://animedekho.app") {

    override suspend fun mirrors(url: String, referer: String?): List<String> {
        val page = playerPage(url, referer ?: "$mainUrl/") ?: return emptyList()
        val named = PROXY_TARGET.find(page)?.groupValues?.get(1)?.decodeUri()?.let { landing(clean(it)) }
        val files = PLAYER_FILE.findAll(page).map { absolute(url, clean(it.groupValues[1])) }
        val frames = FRAME.findAll(page).map { absolute(url, clean(it.groupValues[1])) }
        return listOfNotNull(named) + files + frames
    }

    private suspend fun landing(address: String): String? {
        if (!address.startsWith("http")) return null
        return try {
            app.get(address, referer = "$mainUrl/", headers = mapOf("User-Agent" to USER_AGENT)).url
        } catch (t: Throwable) {
            extractorLog("$name could not follow $address: ${t.message}")
            address
        }
    }
}

class AnimeWorldWrapper : MirrorWrapper("AnimeWorld", "https://animeworld.site") {

    override suspend fun mirrors(url: String, referer: String?): List<String> {
        val page = playerPage(url, referer ?: "$mainUrl/") ?: return emptyList()
        return OPTION.findAll(page).map { clean(it.groupValues[1]) }.toList()
    }
}

open class FilesForeverWrapper : MirrorWrapper("FilesForever", "https://filesforever.link") {

    override suspend fun mirrors(url: String, referer: String?): List<String> {
        val response = try {
            app.get(url, referer = referer ?: "$mainUrl/", headers = mapOf("User-Agent" to USER_AGENT))
        } catch (t: Throwable) {
            extractorLog("$name embed page did not answer for $url: ${t.message}")
            return emptyList()
        }

        val landed = response.url
        val slug = SLUG.find(response.text)?.groupValues?.get(1)
            ?: url.substringBefore('?').substringBefore('#').trimEnd('/').substringAfterLast('/')
        if (slug.isEmpty()) return emptyList()

        val body = app.post(
            "${hostRoot(landed, mainUrl)}/embedhelper2.php",
            referer = landed,
            headers = mapOf("User-Agent" to USER_AGENT),
            data = mapOf(
                "sid" to slug,
                "UserFavSite" to "",
                "currentDomain" to "[\"${hostOf(landed)}\"]",
            ),
        ).text

        val tree = jsonTree(body) ?: return emptyList()
        if (tree.path("domain_blocked").asBoolean(false)) {
            extractorLog("$name refused $slug: ${textIn(tree, "domain_block_reason")}")
            return emptyList()
        }

        val codes = jsonTreeMaybeBase64(textIn(tree, "mresult")) ?: return emptyList()
        val sources = tree.path("sources")
        val out = ArrayList<String>()
        for (key in codes.fieldNames()) {
            val site = textIn(sources.path(key), "siteUrl")
            val code = textIn(codes, key)
            if (site.isEmpty() || code.isEmpty()) continue
            out.add(clean(site + code + textIn(sources.path(key), "embed_suffix")))
        }
        return out
    }
}

class IqSmartGamesWrapper : FilesForeverWrapper() {

    override val name = "FilesForever"

    override val mainUrl = "https://pro.iqsmartgames.com"
}

class ByseTayico : Byse("Byse", "https://bysetayico.com")

// Jackson's asText with a default still answers the string "null" for a json null.
private fun textIn(node: JsonNode, field: String): String =
    node.path(field).takeIf { it.isTextual }?.asText().orEmpty()

private const val MAX_MIRRORS = 8

private val FRAME = Regex(
    """<iframe[^>]+(?:data-src|src)\s*=\s*["']([^"']+)["']""",
    RegexOption.IGNORE_CASE,
)

private val PLAYER_FILE = Regex(
    """["']?file["']?\s*:\s*["'](https?[^"']+)["']""",
    RegexOption.IGNORE_CASE,
)

private val PROXY_TARGET = Regex(
    """127\.0\.0\.1:\d+/\?url=(https?[^)\s"'<>]+)""",
    RegexOption.IGNORE_CASE,
)

private val OPTION = Regex(
    """<option[^>]+value\s*=\s*["'](https?[^"']+)["']""",
    RegexOption.IGNORE_CASE,
)

private val SLUG = Regex(
    """id\s*=\s*["']gdmrfid["'][^>]*value\s*=\s*["']([^"']+)["']""",
    RegexOption.IGNORE_CASE,
)
