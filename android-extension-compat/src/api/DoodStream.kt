package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.httpsify

/** Dood and its mirrors.
 *
 * The page never contains the stream url. It contains a pass_md5 path which answers with the
 * first half of the url, and the caller has to append its own random tail plus the token. The
 * finished link only plays when the request carries the embed page as referer. */
open class DoodStream : ExtractorApi() {

    override val name: String = "DoodStream"

    override val mainUrl: String = "https://dood.to"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val embed = url.replace("/d/", "/e/")
        val response = try {
            app.get(embed, referer = referer, headers = mapOf("User-Agent" to USER_AGENT))
        } catch (t: Throwable) {
            extractorLog("$name page failed for $embed: ${t.message}")
            return
        }
        val page = response.text

        // Most of these domains are now a redirect to whichever one the operator is serving from
        // this week, and the pass_md5 path in the page belongs to that domain rather than to the
        // one the extension asked for, so the root has to come from where the request landed.
        val root = hostRoot(response.url.ifBlank { embed }, mainUrl)

        val passPath = PASS_MD5.find(page)?.value ?: return
        val token = passPath.substringAfterLast('/')
        val prefix = try {
            app.get(root + passPath, referer = embed, headers = mapOf("User-Agent" to USER_AGENT)).text.trim()
        } catch (t: Throwable) {
            extractorLog("$name pass failed for $passPath: ${t.message}")
            return
        }
        if (!prefix.startsWith("http")) return

        val link = "$prefix${randomTail()}?token=$token&expiry=${System.currentTimeMillis()}"
        callback(
            ExtractorLink(
                source = name,
                name = name,
                url = link,
                referer = "$root/",
                quality = Qualities.Unknown.value,
                type = ExtractorLinkType.VIDEO,
                headers = mapOf("User-Agent" to USER_AGENT),
            ),
        )
    }

    private fun randomTail(): String = (1..10)
        .map { ALPHABET.random() }
        .joinToString("")


    private companion object {
        val PASS_MD5 = Regex("""/pass_md5/[^'"\s]+""")
        const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    }
}

class DoodLi : DoodStream() {
    override val name = "Dood"
    override val mainUrl = "https://doodstream.com"
}

/** Where dood.to and myvidplay.com both land today. Registered under its own name so a link keeps
 * naming the host that actually served it. */
class PlayMogo : DoodStream() {
    override val name = "PlayMogo"
    override val mainUrl = "https://playmogo.com"
}

/** One of Anikage's servers. The extension ships no extractors at all, so this host has nothing
 * but the layer, and its pages are dood's with a different domain in front. */
class MyVidPlay : DoodStream() {
    override val name = "MyVidPlay"
    override val mainUrl = "https://myvidplay.com"
}
