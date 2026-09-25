package com.lagradost.cloudstream3.utils

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule

/** The serializer half of the extension utility surface. Extensions call toJson on data classes
 * they defined themselves, so the mapper has to understand Kotlin constructors and has to skip
 * nulls, which is what their payloads were shaped against. */
object AppUtils {

    private val mapper: JsonMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .serializationInclusion(JsonInclude.Include.NON_NULL)
        .build()

    fun Any.toJson(): String = try {
        if (this is String) this else mapper.writeValueAsString(this)
    } catch (t: Throwable) {
        this.toString()
    }
}
