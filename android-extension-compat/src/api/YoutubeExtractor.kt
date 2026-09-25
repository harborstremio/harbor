package com.lagradost.cloudstream3.extractors

import com.harbor.capstan.startNewPipe
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import com.lagradost.cloudstream3.utils.Qualities
import com.lagradost.cloudstream3.utils.SubtitleHelper
import com.lagradost.cloudstream3.utils.extractorLog
import com.lagradost.cloudstream3.utils.getQualityFromName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfo

/** YouTube, through the player endpoint one of its own clients calls.
 *
 * The extractor library is asked first. It is maintained against YouTube's changes and returns a
 * variant manifest plus the progressive streams. The hand written client call below it is kept for
 * the cases the library declines, and for a host that ships without the library.
 *
 * A client is asked rather than the web page because the web page hands back urls that have to be
 * run through the player javascript before they play, and a client answer does not. Which client
 * is asked is load bearing: the phone clients are now refused by the endpoint outright and the web
 * client answers UNPLAYABLE. On 2026-09-24 the headset client below was refused too, with
 * LOGIN_REQUIRED, which is what the library path answers.
 * Videos both paths refuse, age gated ones above all, produce no link rather than a link that
 * fails later in the player. */
open class YoutubeExtractor : ExtractorApi() {

    override val name: String = "YouTube"

    override val mainUrl: String = "https://www.youtube.com"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val id = videoId(url) ?: return
        if (fromLibrary(id, subtitleCallback, callback)) return
        val payload = jsonBody(
            mapOf(
                "context" to mapOf(
                    "client" to mapOf(
                        "clientName" to CLIENT_NAME,
                        "clientVersion" to CLIENT_VERSION,
                        "deviceMake" to "Oculus",
                        "deviceModel" to "Quest 3",
                        "osName" to "Android",
                        "osVersion" to "12",
                        "androidSdkVersion" to 32,
                        "hl" to "en",
                        "gl" to "US",
                    ),
                ),
                "videoId" to id,
                "contentCheckOk" to true,
                "racyCheckOk" to true,
            ),
        )

        val body = try {
            app.post(
                "https://www.youtube.com/youtubei/v1/player",
                json = payload,
                headers = mapOf(
                    "Content-Type" to "application/json",
                    "User-Agent" to CLIENT_USER_AGENT,
                ),
            ).text
        } catch (t: Throwable) {
            extractorLog("$name player call failed for $id: ${t.message}")
            return
        }

        val tree = jsonTree(body) ?: return
        val status = tree.path("playabilityStatus").path("status").asText("")
        if (status.isNotBlank() && !status.equals("OK", ignoreCase = true)) {
            extractorLog("$name refused $id: $status")
            return
        }

        val streaming = tree.path("streamingData")
        val hls = streaming.path("hlsManifestUrl").asText("")
        if (hls.isNotBlank()) {
            emitStream(name, name, hls, mainUrl, null, emptyMap(), callback)
        }

        for (format in streaming.path("formats")) {
            val stream = format.path("url").asText("")
            if (stream.isBlank()) continue
            val label = format.path("qualityLabel").asText("")
            callback(
                ExtractorLink(
                    source = name,
                    name = "$name $label".trim(),
                    url = stream,
                    referer = mainUrl,
                    quality = if (label.isBlank()) Qualities.Unknown.value else getQualityFromName(label),
                    type = ExtractorLinkType.VIDEO,
                ),
            )
        }

        for (track in tree.path("captions")
            .path("playerCaptionsTracklistRenderer").path("captionTracks")) {
            val captionUrl = track.path("baseUrl").asText("")
            if (captionUrl.isBlank()) continue
            val tag = track.path("languageCode").asText("")
            val label = track.path("name").path("simpleText").asText("").ifBlank { tag }
            val english = SubtitleHelper.fromTagToEnglishLanguageName(tag) ?: label.ifBlank { "Unknown" }
            subtitleCallback(SubtitleFile(english, "$captionUrl&fmt=vtt"))
        }
    }

    private suspend fun fromLibrary(
        id: String,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ): Boolean = withContext(Dispatchers.IO) {
        val info = try {
            startNewPipe()
            val extractor = ServiceList.YouTube.getStreamExtractor("$WATCH$id")
            extractor.fetchPage()
            StreamInfo.getInfo(extractor)
        } catch (declined: Throwable) {
            extractorLog("$name library declined $id: ${declined.message}")
            return@withContext false
        }
        var produced = false
        val manifest = info.hlsUrl.orEmpty()
        if (manifest.isNotBlank()) {
            produced = emitStream(name, name, manifest, mainUrl, null, emptyMap(), callback)
        }
        info.videoStreams.orEmpty().filterNot { it.isVideoOnly }.forEach { stream ->
            val content = stream.content.orEmpty()
            if (content.isBlank()) return@forEach
            val label = stream.resolution.orEmpty()
            callback(
                ExtractorLink(
                    source = name,
                    name = "$name $label".trim(),
                    url = content,
                    referer = mainUrl,
                    quality = if (label.isBlank()) Qualities.Unknown.value else getQualityFromName(label),
                    type = ExtractorLinkType.VIDEO,
                ),
            )
            produced = true
        }
        info.subtitles.orEmpty().forEach { track ->
            val content = track.content.orEmpty()
            if (content.isBlank()) return@forEach
            val tag = track.languageTag.orEmpty()
            val label = SubtitleHelper.fromTagToEnglishLanguageName(tag)
                ?: track.displayLanguageName.orEmpty().ifBlank { tag }.ifBlank { "Unknown" }
            subtitleCallback(SubtitleFile(label, content))
        }
        produced
    }

    private fun videoId(url: String): String? =
        Regex("""[?&]v=([A-Za-z0-9_-]{6,})""").find(url)?.groupValues?.get(1)
            ?: Regex("""youtu\.be/([A-Za-z0-9_-]{6,})""").find(url)?.groupValues?.get(1)
            ?: Regex("""/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{6,})""").find(url)?.groupValues?.get(1)

    private companion object {
        const val WATCH = "https://www.youtube.com/watch?v="
        const val CLIENT_NAME = "ANDROID_VR"
        const val CLIENT_VERSION = "1.61.43"
        const val CLIENT_USER_AGENT =
            "com.google.android.apps.youtube.vr.oculus/1.61.43 (Linux; U; Android 12; GB) gzip"
    }
}

class YoutubeShort : YoutubeExtractor() {
    override val name = "YouTube"
    override val mainUrl = "https://youtu.be"
}

class YoutubeNoCookie : YoutubeExtractor() {
    override val name = "YouTube"
    override val mainUrl = "https://www.youtube-nocookie.com"
}
