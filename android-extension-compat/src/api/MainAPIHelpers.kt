@file:JvmName("MainAPIKt")
@file:JvmMultifileClass

package com.lagradost.cloudstream3

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule
import kotlinx.serialization.json.Json
import java.util.Base64

/**
 * Both parsers are lenient on purpose. Scraped payloads carry fields the extension never declared
 * and drop fields it did, and a parser that refused them would fail the whole page.
 */
val json: Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    explicitNulls = false
}

val mapper: JsonMapper = JsonMapper.builder()
    .addModule(KotlinModule.Builder().build())
    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true)
    .build()

fun base64Encode(array: ByteArray): String = Base64.getEncoder().encodeToString(array)

/**
 * Site payloads use both alphabets and are careless about padding and stray whitespace, so this
 * tries the tolerant decoder first and the url safe one after, and yields nothing on failure
 * rather than killing the scrape.
 */
fun base64DecodeArray(string: String): ByteArray {
    val cleaned = string.trim()
    if (cleaned.isEmpty()) return ByteArray(0)
    val padded = when (cleaned.length % 4) {
        2 -> "$cleaned=="
        3 -> "$cleaned="
        else -> cleaned
    }
    runCatching { return Base64.getMimeDecoder().decode(padded) }
    runCatching { return Base64.getUrlDecoder().decode(padded.replace('+', '-').replace('/', '_')) }
    return ByteArray(0)
}

fun base64Decode(string: String): String = String(base64DecodeArray(string), Charsets.ISO_8859_1)

/** Titles arrive shouted or all lowercase, this puts them back to one word per capital. */
fun String.fixTitle(): String = split(" ").joinToString(" ") { word ->
    word.lowercase().replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}

fun MainAPI.fixUrl(url: String): String {
    if (url.startsWith("//")) return "https:$url"
    if (url.startsWith("http")) return url
    if (url.isEmpty()) return ""
    val base = mainUrl.trimEnd('/')
    return if (url.startsWith("/")) base + url else "$base/$url"
}

fun MainAPI.fixUrlNull(url: String?): String? {
    if (url.isNullOrEmpty()) return null
    return fixUrl(url)
}

fun mainPageOf(vararg elements: Pair<String, String>): List<MainPageData> =
    elements.map { MainPageData(name = it.second, data = it.first) }

/** Quality labels are free text on every site, so match on letters and digits only. */
fun getQualityFromString(string: String?): SearchQuality? {
    val token = string?.lowercase()?.filter { it.isLetterOrDigit() }
    if (token.isNullOrEmpty()) return null
    return when (token) {
        "cam", "hdcam", "camhd", "hdts" -> SearchQuality.Cam
        "camrip", "hdcamrip" -> SearchQuality.CamRip
        "ts", "telesync", "predvd", "pdvd" -> SearchQuality.Telesync
        "wp", "workprint" -> SearchQuality.WorkPrint
        "tc", "telecine", "hdtc" -> SearchQuality.Telecine
        "hq", "hqrip", "hqhd" -> SearchQuality.HQ
        "hd", "hdrip", "hdtv", "720p", "1080p", "fullhd", "fhd" -> SearchQuality.HD
        "hdr", "hdr10", "hdr10plus", "dolbyvision", "dv" -> SearchQuality.HDR
        "bluray", "blueray", "bdrip", "brrip", "bd", "bdremux" -> SearchQuality.BlueRay
        "dvd", "dvdrip", "dvdscr", "dvdr", "scr" -> SearchQuality.DVD
        "sd", "sdrip", "480p", "360p", "240p" -> SearchQuality.SD
        "4k", "2160p", "fourk" -> SearchQuality.FourK
        "uhd", "ultrahd" -> SearchQuality.UHD
        "sdr" -> SearchQuality.SDR
        "web", "webrip", "webdl", "webhd", "webdlrip" -> SearchQuality.WebRip
        else -> null
    }
}
