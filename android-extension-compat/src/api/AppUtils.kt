package com.lagradost.cloudstream3.utils

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule

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
