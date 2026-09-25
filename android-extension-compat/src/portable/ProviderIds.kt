package com.harbor.capstan

/** A provider id is `<extensionId>/<providerName>` with this applied to each half, so an id is
 * stable across runs and safe in a path. Shared because an id minted on one platform is read on
 * the other: a stored election naming `yt/youtube` has to find the same provider on a device. */
fun providerSlug(raw: String): String {
    val builder = StringBuilder(raw.length)
    for (character in raw.lowercase()) {
        val keep = character in 'a'..'z' || character in '0'..'9' || character == '.' || character == '_'
        if (keep) {
            builder.append(character)
        } else if (builder.isNotEmpty() && builder.last() != '-') {
            builder.append('-')
        }
    }
    return builder.toString().trim('-', '.')
}
