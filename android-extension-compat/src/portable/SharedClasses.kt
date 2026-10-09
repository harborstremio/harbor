package com.harbor.capstan

private val SHARED_PREFIXES = arrayOf(
    "android.",
    "androidx.",
    "com.google.android.material.",
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
