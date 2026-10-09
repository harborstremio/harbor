package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

open class StreamWishExtractor : ExtractorApi() {

    override val name: String = "StreamWish"

    override val mainUrl: String = "https://streamwish.to"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        for (candidate in candidates(url)) {
            val root = hostRoot(candidate, mainUrl)
            val pageReferer = if (candidate == url) referer ?: root else root
            val playbackHeaders = mapOf("Origin" to root, "User-Agent" to USER_AGENT)
            val page = playerPage(candidate, pageReferer) ?: continue

            if (emitPlayerPage(name, name, candidate, page, pageReferer, playbackHeaders, subtitleCallback, callback)) return

            val embed = embedUrl(candidate, page, root) ?: continue
            val embedPage = playerPage(embed, pageReferer) ?: continue
            if (emitPlayerPage(name, name, embed, embedPage, pageReferer, playbackHeaders, subtitleCallback, callback)) return
        }
        extractorLog("$name found no sources on $url")
    }

    private fun candidates(url: String): List<String> {
        val id = fileId(url) ?: return listOf(url)
        val here = hostRoot(url, mainUrl)
        return listOf(url) + READABLE.filter { it != here }.map { "$it/e/$id" }
    }

    private fun embedUrl(url: String, page: String, root: String): String? {
        IFRAME.find(page)?.groupValues?.get(1)?.let { return clean(it) }
        val id = url.trimEnd('/').substringAfterLast('/')
        if (id.isBlank() || url.contains("/e/")) return null
        return "$root/e/$id"
    }

    private fun fileId(url: String): String? {
        val path = url.substringAfter("://", "").substringAfter('/', "")
            .substringBefore('?').substringBefore('#')
        val last = path.trimEnd('/').substringAfterLast('/').substringBefore('.')
        return last.takeIf { it.length >= 6 && it.all(Char::isLetterOrDigit) }
    }

    private companion object {
        val IFRAME = Regex("""<iframe[^>]+src\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)

        val READABLE = listOf("https://hlswish.com", "https://flaswish.com", "https://embedwish.com")
    }
}

class StreamWishTo : StreamWishExtractor() {
    override val name = "Streamwish"
    override val mainUrl = "https://streamwish.to"
}

class StrwishCom : StreamWishExtractor() {
    override val name = "Strwish"
    override val mainUrl = "https://strwish.com"
}

class Hlswish : StreamWishExtractor() {
    override val name = "Hlswish"
    override val mainUrl = "https://hlswish.com"
}

class Flaswish : StreamWishExtractor() {
    override val name = "Flaswish"
    override val mainUrl = "https://flaswish.com"
}

class Wishembed : StreamWishExtractor() {
    override val name = "Wishembed"
    override val mainUrl = "https://wishembed.pro"
}

class Swiftplayers : StreamWishExtractor() {
    override val name = "Swiftplayers"
    override val mainUrl = "https://swiftplayers.com"
}

class Embedwish : StreamWishExtractor() {
    override val name = "Embedwish"
    override val mainUrl = "https://embedwish.com"
}

class Sfastwish : StreamWishExtractor() {
    override val name = "Sfastwish"
    override val mainUrl = "https://sfastwish.com"
}
