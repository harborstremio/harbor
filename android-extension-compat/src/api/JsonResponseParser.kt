package com.lagradost.nicehttp

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule
import kotlin.reflect.KClass

class JsonResponseParser(private val mapper: ObjectMapper = shared) : ResponseParser {

    override fun <T : Any> parse(text: String, kClass: KClass<T>): T =
        mapper.readValue(trimToJson(text), kClass.java)

    override fun <T : Any> parseSafe(text: String, kClass: KClass<T>): T? = try {
        parse(text, kClass)
    } catch (t: Throwable) {
        null
    }

    override fun writeValueAsString(obj: Any): String = mapper.writeValueAsString(obj)

    // Servers prepend anti hijack prefixes such as )]}' and XSSI guards to JSON bodies.
    private fun trimToJson(text: String): String {
        val start = text.indexOfFirst { it == '{' || it == '[' }
        if (start <= 0) return text
        val head = text.substring(0, start)
        return if (head.any { !it.isWhitespace() && it != ')' && it != ']' && it != '}' && it != '\'' && it != ';' && it != '&' })
            text
        else
            text.substring(start)
    }

    companion object {
        val shared: ObjectMapper = JsonMapper.builder()
            .addModule(KotlinModule.Builder().build())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES, false)
            .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true)
            .build()
    }
}
