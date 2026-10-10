package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.hostOf
import com.lagradost.cloudstream3.utils.loadExtractor

class HbLinksLol : ExtractorApi() {

    override val name: String = "HBLinks"

    override val mainUrl: String = "https://hblinks.lol"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val page = playerPage(url, referer ?: mainUrl, mapOf("User-Agent" to USER_AGENT)) ?: return
        val here = hostOf(url)

        val sent = HashSet<String>()
        val once: (ExtractorLink) -> Unit = { link -> if (sent.add(link.url)) callback(link) }

        var produced = false
        for (mirror in mirrors(page, here)) {
            if (loadExtractor(mirror, url, subtitleCallback, once)) produced = true
        }
        if (!produced) extractorLog("$name found no mirror serving on $url")
    }

    private fun mirrors(page: String, here: String): List<String> {
        val out = LinkedHashSet<String>()
        for (tag in ANCHOR.findAll(page).map { it.value }) {
            if (!NEW_TAB.containsMatchIn(tag)) continue
            val href = HREF.find(tag)?.groupValues?.get(1)?.let(::clean) ?: continue
            if (!href.startsWith("http")) continue
            val host = hostOf(href)
            if (host.isEmpty() || host == here) continue
            out.add(href)
        }
        return out.toList()
    }

    private companion object {
        val ANCHOR = Regex("""<a\b[^>]*>""", RegexOption.IGNORE_CASE)

        val NEW_TAB = Regex("""target\s*=\s*["']?_blank""", RegexOption.IGNORE_CASE)

        val HREF = Regex("""href\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    }
}
