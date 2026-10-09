package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.absolute
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getAndUnpack

open class DlFormPlayer(
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
        val root = hostRoot(url, mainUrl)
        val pageReferer = referer ?: "$root/"
        val playback = mapOf("Origin" to root, "Referer" to "$root/", "User-Agent" to USER_AGENT)

        val page = playerPage(url, pageReferer)
        if (page == null) {
            extractorLog("$name could not read $url")
            return
        }
        if (emitPlayerPage(name, name, url, page, pageReferer, playback, subtitleCallback, callback)) return

        val action = FORM_ACTION.find(page)?.groupValues?.get(1) ?: return
        val fields = formFields(page, url) ?: return
        val target = absolute(url, clean(action))

        val answer = try {
            getAndUnpack(app.post(target, referer = url, data = fields, headers = POST_HEADERS).text)
        } catch (t: Throwable) {
            extractorLog("$name post to $target failed: ${t.message}")
            return
        }
        if (emitPlayerPage(name, name, target, answer, url, playback, subtitleCallback, callback)) return
        extractorLog("$name found no sources on $url")
    }

    private fun formFields(page: String, url: String): Map<String, String>? {
        val fields = LinkedHashMap<String, String>()
        for (match in HIDDEN.findAll(page)) {
            fields[match.groupValues[1]] = match.groupValues[2]
        }
        if (!fields.containsKey("op")) return null
        if (fields["file_code"].isNullOrBlank()) {
            fields["file_code"] = embedFileId(url) ?: return null
        }
        fields["referer"] = fields["referer"].orEmpty()
        return fields
    }

    private companion object {
        val POST_HEADERS = mapOf(
            "User-Agent" to USER_AGENT,
            "Content-Type" to "application/x-www-form-urlencoded",
        )
        val FORM_ACTION = Regex("""<form[^>]+action\s*=\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
        val HIDDEN = Regex(
            """<input[^>]+name\s*=\s*["']([^"']+)["'][^>]*value\s*=\s*["']([^"']*)["']""",
            RegexOption.IGNORE_CASE,
        )
    }
}

class StreamRuby : DlFormPlayer("StreamRuby", "https://rubystm.com")

class StreamHls : DlFormPlayer("StreamHls", "https://streamhls.to")
