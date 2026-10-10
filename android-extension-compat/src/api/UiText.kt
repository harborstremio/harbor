package com.lagradost.cloudstream3.utils

import android.content.Context

sealed class UiText {

    class DynamicString(val value: String) : UiText()

    class StringResource(val resId: Int) : UiText()

    fun asString(context: Context?): String = when (this) {
        is DynamicString -> value
        is StringResource -> try {
            context?.getResources()?.getString(resId).orEmpty()
        } catch (error: Throwable) {
            ""
        }
    }

    fun asStringNull(context: Context?): String? = asString(context).ifEmpty { null }
}
