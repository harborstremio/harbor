package com.lagradost.nicehttp

import kotlin.reflect.KClass

interface ResponseParser {
    fun <T : Any> parse(text: String, kClass: KClass<T>): T

    fun <T : Any> parseSafe(text: String, kClass: KClass<T>): T?

    fun writeValueAsString(obj: Any): String = obj.toString()
}
