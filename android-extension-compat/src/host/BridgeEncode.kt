package com.harbor.capstan.bridge

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.harbor.capstan.EpisodeItem
import com.harbor.capstan.MediaItem
import com.harbor.capstan.SearchItem
import com.harbor.capstan.StreamLink
import com.harbor.capstan.SubtitleItem

/** Every value that crosses the wire is shaped here, so the Rust and TypeScript sides have one
 * place to read and nothing has to guess at a field name. */
object BridgeEncode {

    fun provider(entry: ProviderEntry): JsonObject {
        val info = entry.provider.info
        val out = JsonObject()
        out.addProperty("id", entry.id)
        out.addProperty("extensionId", entry.extensionId)
        out.addProperty("name", info.name)
        out.addProperty("lang", info.lang)
        out.addProperty("mainUrl", info.mainUrl)
        out.add("types", strings(info.supportedTypes))
        out.addProperty("hasMainPage", info.hasMainPage)
        out.addProperty("hasQuickSearch", info.hasQuickSearch)
        out.addProperty("hasDownloadSupport", info.hasDownloadSupport)
        out.addProperty("instantLinkLoading", info.instantLinkLoading)
        return out
    }

    fun extension(entry: ExtensionEntry): JsonObject {
        val out = JsonObject()
        out.addProperty("id", entry.id)
        out.addProperty("name", entry.loaded.name)
        out.addProperty("version", entry.loaded.version)
        out.addProperty("entryClass", entry.loaded.entryClassName)
        out.addProperty("file", entry.loaded.file.path)
        out.addProperty("source", entry.source)
        out.add("providers", strings(entry.providerIds))
        out.add("extractors", strings(entry.loaded.extractorNames))
        return out
    }

    fun searchItem(item: SearchItem): JsonObject {
        val out = JsonObject()
        out.addProperty("name", item.name)
        out.addProperty("url", item.url)
        out.addProperty("apiName", item.apiName)
        out.addProperty("type", item.type)
        out.addProperty("posterUrl", item.posterUrl)
        out.add("posterHeaders", headers(item.posterHeaders))
        out.addProperty("quality", item.quality)
        out.addProperty("score", item.scoreOutOf10)
        return out
    }

    fun mediaItem(item: MediaItem): JsonObject {
        val out = JsonObject()
        out.addProperty("name", item.name)
        out.addProperty("url", item.url)
        out.addProperty("apiName", item.apiName)
        out.addProperty("type", item.type)
        out.addProperty("posterUrl", item.posterUrl)
        out.addProperty("backgroundPosterUrl", item.backgroundPosterUrl)
        out.addProperty("year", item.year)
        out.addProperty("plot", item.plot)
        out.add("tags", strings(item.tags))
        out.addProperty("durationMinutes", item.durationMinutes)
        out.addProperty("contentRating", item.contentRating)
        out.addProperty("score", item.scoreOutOf10)
        out.addProperty("comingSoon", item.comingSoon)
        out.addProperty("playableData", item.playableData)
        out.add("episodes", array(item.episodes) { episode(it) })
        out.add("recommendations", array(item.recommendations) { searchItem(it) })
        out.add("actors", strings(item.actors))
        out.add("trailerUrls", strings(item.trailerUrls))
        out.add("syncIds", headers(item.syncIds))
        return out
    }

    fun streamLink(link: StreamLink): JsonObject {
        val out = JsonObject()
        out.addProperty("source", link.source)
        out.addProperty("name", link.name)
        out.addProperty("url", link.url)
        out.addProperty("referer", link.referer)
        out.addProperty("quality", link.quality)
        out.addProperty("type", link.type)
        out.add("headers", headers(link.headers))
        return out
    }

    fun subtitle(item: SubtitleItem): JsonObject {
        val out = JsonObject()
        out.addProperty("lang", item.lang)
        out.addProperty("url", item.url)
        out.add("headers", headers(item.headers))
        return out
    }

    private fun episode(item: EpisodeItem): JsonObject {
        val out = JsonObject()
        out.addProperty("data", item.data)
        out.addProperty("name", item.name)
        out.addProperty("season", item.season)
        out.addProperty("episode", item.episode)
        out.addProperty("posterUrl", item.posterUrl)
        out.addProperty("description", item.description)
        out.addProperty("runtimeMinutes", item.runtimeMinutes)
        out.addProperty("airDate", item.airDate)
        out.addProperty("track", item.track)
        return out
    }

    private fun headers(value: Map<String, String>): JsonElement {
        val out = JsonObject()
        for ((key, entry) in value) out.addProperty(key, entry)
        return out
    }

    private fun strings(values: Collection<String>): JsonArray {
        val out = JsonArray()
        for (value in values) out.add(value)
        return out
    }

    private fun <T> array(values: Collection<T>, encode: (T) -> JsonObject): JsonArray {
        val out = JsonArray()
        for (value in values) out.add(encode(value))
        return out
    }
}
