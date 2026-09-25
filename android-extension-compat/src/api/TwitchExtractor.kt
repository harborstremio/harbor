package com.lagradost.cloudstream3.extractors

import com.fasterxml.jackson.databind.JsonNode
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.app
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorLog

/** Twitch live channels and vods.
 *
 * Playback needs a signed token, which the site gets from its own graph endpoint before asking the
 * playlist server for the manifest. Both steps are done here so a channel link resolves to a
 * normal hls master the player can treat like any other. */
open class TwitchExtractor : ExtractorApi() {

    override val name: String = "Twitch"

    override val mainUrl: String = "https://www.twitch.tv"

    override val requiresReferer: Boolean = false

    override suspend fun getUrl(
        url: String,
        referer: String?,
        subtitleCallback: (SubtitleFile) -> Unit,
        callback: (ExtractorLink) -> Unit,
    ) {
        val vod = VOD.find(url)?.groupValues?.get(1)
        val channel = if (vod == null) channelName(url) else null
        if (vod == null && channel == null) return

        val token = accessToken(vod, channel) ?: return
        val value = token.first
        val signature = token.second

        val manifest = if (vod != null) {
            "https://usher.ttvnw.net/vod/$vod.m3u8"
        } else {
            "https://usher.ttvnw.net/api/channel/hls/$channel.m3u8"
        } + "?client_id=$CLIENT_ID&token=${encode(value)}&sig=$signature" +
            "&allow_source=true&allow_audio_only=true&fast_bread=true&player_backend=mediaplayer"

        val label = vod ?: channel.orEmpty()
        if (!emitStream(name, "$name $label".trim(), manifest, mainUrl, null, emptyMap(), callback)) {
            extractorLog("$name produced no playlist for $label")
        }
    }

    /** The graph call returns the token and the signature that the playlist server checks. */
    private suspend fun accessToken(vod: String?, channel: String?): Pair<String, String>? {
        val isLive = vod == null
        val id = vod ?: channel ?: return null
        val query = "query{" +
            (if (isLive) "streamPlaybackAccessToken(channelName:\"$id\"," else "videoPlaybackAccessToken(id:\"$id\",") +
            "params:{platform:\"web\",playerBackend:\"mediaplayer\",playerType:\"site\"})" +
            "{value signature}" +
            (if (isLive) "user(login:\"$id\"){stream{id}}" else "") +
            "}"

        val body = try {
            app.post(
                "https://gql.twitch.tv/gql",
                json = jsonBody(mapOf("query" to query)),
                headers = mapOf(
                    "Client-ID" to CLIENT_ID,
                    "Content-Type" to "application/json",
                    "User-Agent" to USER_AGENT,
                ),
            ).text
        } catch (t: Throwable) {
            extractorLog("$name token call failed for $id: ${t.message}")
            return null
        }

        val tree = jsonTree(body)?.path("data") ?: return null
        if (isLive && offline(tree)) {
            extractorLog("$name channel $id is not streaming, so there is no manifest to hand back")
            return null
        }
        val node = if (isLive) tree.path("streamPlaybackAccessToken") else tree.path("videoPlaybackAccessToken")
        val value = node.path("value").asText("")
        val signature = node.path("signature").asText("")
        if (value.isBlank() || signature.isBlank()) return null
        return value to signature
    }

    /** Whether the answer says this channel is not streaming.
     *
     * A token is issued for an offline channel exactly as it is for a live one, and the playlist
     * server then answers 404 with a json body, so without this the extractor hands back a link
     * that cannot play. The live status is asked for in the same graph call as the token, so it
     * costs no extra request. Only an answer that carries the channel and no stream counts: a
     * missing or null user means the question was not answered and the link is still worth having.
     */
    private fun offline(tree: JsonNode): Boolean {
        val user = tree.path("user")
        if (!user.isObject) return false
        val stream = user.path("stream")
        return stream.isMissingNode || stream.isNull
    }

    private fun channelName(url: String): String? {
        val path = url.substringAfter("twitch.tv/", "").substringBefore('?').substringBefore('#').trim('/')
        val first = path.substringBefore('/')
        if (first.isBlank() || first in RESERVED) return null
        return first
    }

    private fun encode(value: String): String =
        java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20")

    private companion object {
        const val CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"
        val VOD = Regex("""/videos?/(\d+)""")
        val RESERVED = setOf("directory", "videos", "settings", "downloads", "subscriptions", "p", "u")
    }
}

class TwitchPlayer : TwitchExtractor() {
    override val name = "Twitch"
    override val mainUrl = "https://player.twitch.tv"
}
