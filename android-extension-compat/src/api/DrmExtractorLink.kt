package com.lagradost.cloudstream3.utils

import java.util.UUID

open class DrmExtractorLink(
    source: String,
    name: String,
    url: String,
    type: ExtractorLinkType = ExtractorLinkType.DASH,
    var uuid: UUID = WIDEVINE,
    var kid: String? = null,
    var key: String? = null,
    var licenseUrl: String? = null,
    var licenseHeaders: Map<String, String> = emptyMap(),
    referer: String = "",
    quality: Int = Qualities.Unknown.value,
    headers: Map<String, String> = emptyMap(),
    extractorData: String? = null,
) : ExtractorLink(source, name, url, referer, quality, type, headers, extractorData) {

    override fun toString(): String = "DrmExtractorLink($name, $quality, $type, $url)"

    companion object {
        val WIDEVINE: UUID = UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed")

        val CLEARKEY: UUID = UUID.fromString("e2719d58-a985-b3c9-781a-b030af78d30e")
    }
}
