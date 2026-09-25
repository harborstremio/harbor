package com.harbor.capstan

/** The package prefixes an extension is allowed to name: the compat layer, the platform types it
 * was compiled against, and the dependency libraries. Anything else, the loader and the rest of the
 * host included, does not exist as far as extension code is concerned.
 *
 * Both platforms read this list, so the barrier an extension meets is the same one either side of
 * the wire. What differs is only how the barrier is built, which is a class loader shape and not a
 * policy. */
private val SHARED_PREFIXES = arrayOf(
    "android.",
    "androidx.",
    "org.xmlpull.",
    "com.lagradost.",
    "kotlin.",
    "kotlinx.",
    "_COROUTINE.",
    "okhttp3.",
    "okio.",
    "io.ktor.",
    "com.fleeksoft.",
    "org.jsoup.",
    "org.schabi.newpipe.",
    "org.json.",
    "com.fasterxml.jackson.",
    "com.google.gson.",
    "org.jetbrains.annotations.",
    "org.intellij.lang.annotations.",
)

internal fun isSharedClass(name: String): Boolean = SHARED_PREFIXES.any { name.startsWith(it) }
