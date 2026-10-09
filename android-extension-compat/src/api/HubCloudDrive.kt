package com.lagradost.cloudstream3.extractors

import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.hostOf

open class HubCloudDrive : ExtractorApi() {

    override val name: String = "HubCloud"

    override val mainUrl: String = "https://hubcloud.one"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val headers = mapOf("User-Agent" to USER_AGENT)
        val root = hostRoot(url, mainUrl)

        if (isGate(hostOf(url))) {
            val direct = behindGate(url, referer ?: root, headers)
            if (direct == null) extractorLog("$name found no address behind $url")
            else emitStream(name, name, direct, url, null, headers, callback)
            return
        }

        val drive = playerPage(url, referer ?: root, headers)
        val servers = drive?.let { SERVER_LIST.find(it)?.value }
        if (servers == null) {
            extractorLog("$name found no server list on $url")
            return
        }

        val list = playerPage(servers, url, headers)
        if (list == null) {
            extractorLog("$name server list did not answer for $url")
            return
        }

        val label = TITLE.find(drive)?.groupValues?.get(1)?.trim()
        var produced = 0
        for (arm in arms(list)) {
            val link = if (arm.gated) behindGate(arm.href, servers, headers) else arm.href
            if (link == null) continue
            if (emitStream(name, name, link, servers, label, headers, callback)) produced++
        }
        if (produced == 0) extractorLog("$name found no addresses on $servers")
    }

    private class Arm(val href: String, val gated: Boolean)

    private fun arms(list: String): List<Arm> {
        val direct = ArrayList<Arm>()
        val gated = ArrayList<Arm>()
        for (match in HREF.findAll(list)) {
            val href = clean(match.groupValues[1])
            if (!href.startsWith("http")) continue
            val host = hostOf(href)
            when {
                isGate(host) -> gated.add(Arm(href, true))
                host.endsWith(".r2.cloudflarestorage.com") || host.endsWith(".r2.dev") ->
                    direct.add(Arm(href, false))
                host.endsWith(".workers.dev") -> direct.add(Arm(href, false))
                isFile(href) -> direct.add(Arm(href, false))
            }
        }
        return direct + gated
    }

    private fun isGate(host: String): Boolean =
        host.startsWith("pixel.") || host.startsWith("gpdl.")

    private suspend fun behindGate(
        href: String,
        referer: String,
        headers: Map<String, String>,
    ): String? {
        val landed = try {
            app.get(href, referer = referer, headers = headers).url
        } catch (t: Throwable) {
            extractorLog("$name gate read failed for $href: ${t.message}")
            return null
        }
        val target = landed.substringAfter("link=", "")
        if (target.isEmpty()) return null
        val decoded = if (target.contains('%')) {
            try {
                java.net.URLDecoder.decode(target, "UTF-8")
            } catch (t: Throwable) {
                target
            }
        } else {
            target
        }
        return clean(decoded).takeIf { it.startsWith("http") }
    }

    private fun isFile(href: String): Boolean {
        val path = pathOf(href) ?: return false
        return FILE_SUFFIXES.any { path.endsWith(it) }
    }

    private companion object {
        val SERVER_LIST = Regex("""https://[a-z0-9.\-]+/hubcloud\.php\?[^"'\s<>]+""")

        val HREF = Regex("""href="(https://[^"]+)"""")

        val TITLE = Regex("""<title>([^<]+)</title>""", RegexOption.IGNORE_CASE)

        val FILE_SUFFIXES = listOf(".mkv", ".mp4", ".m4v", ".avi", ".webm", ".mov")
    }
}

class HubCloudIst : HubCloudDrive() {
    override val mainUrl: String = "https://hubcloud.ist"
}
