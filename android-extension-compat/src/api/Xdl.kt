package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.loadExtractor

class Xdl : ExtractorApi() {

    override val name: String = "XDL"

    override val mainUrl: String = "https://new.xdl.my.id"

    override val requiresReferer: Boolean = true

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val page = playerPage(url, referer ?: "${hostRoot(url, mainUrl)}/")
        if (page == null) {
            extractorLog("$name page did not answer for $url")
            return
        }

        val backends = HIDDEN.findAll(page)
            .map { it.groupValues[1] to it.groupValues[2] }
            .filter { (field, _) -> field.endsWith("download") }
            .distinct()
            .take(MAX_BACKENDS)
            .toList()

        if (backends.isEmpty()) {
            extractorLog("$name found no download form on $url")
            return
        }

        var produced = 0
        val counted: (ExtractorLink) -> Unit = {
            produced++
            callback(it)
        }
        for ((field, value) in backends) {
            val location = redirect(url, mapOf(field to value)) ?: continue
            if (!isFile(location, url)) {
                runCatching { loadExtractor(location, url, subtitleCallback, counted) }
                continue
            }
            counted(
                ExtractorLink(
                    source = name,
                    name = "$name ${label(field)}",
                    url = location,
                    referer = url,
                    quality = Qualities.Unknown.value,
                    type = ExtractorLinkType.VIDEO,
                    headers = mapOf("User-Agent" to USER_AGENT),
                ),
            )
        }
        if (produced == 0) extractorLog("$name got no file address from ${backends.size} backends on $url")
    }

    private suspend fun isFile(location: String, referer: String): Boolean = try {
        val response = app.head(location, referer = referer, headers = mapOf("User-Agent" to USER_AGENT))
        val type = response.headers["content-type"].orEmpty().substringBefore(';').trim().lowercase()
        response.isSuccessful && type.isNotEmpty() && !type.startsWith("text/")
    } catch (t: Throwable) {
        extractorLog("$name head failed for $location: ${t.message}")
        false
    }

    private suspend fun redirect(url: String, data: Map<String, String>): String? = try {
        val response = app.post(
            url,
            referer = url,
            headers = mapOf("User-Agent" to USER_AGENT),
            data = data,
            allowRedirects = false,
        )
        response.headers["location"]?.takeIf { it.startsWith("http") }
    } catch (t: Throwable) {
        extractorLog("$name post failed for ${data.keys.firstOrNull()}: ${t.message}")
        null
    }

    private fun label(field: String): String =
        field.removeSuffix("_download").removeSuffix("download").trim('_').ifEmpty { "direct" }

    private companion object {
        const val MAX_BACKENDS = 4

        val HIDDEN = Regex(
            """<input[^>]+type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']""",
            RegexOption.IGNORE_CASE,
        )
    }
}
