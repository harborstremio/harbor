package com.harbor.capstan

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
