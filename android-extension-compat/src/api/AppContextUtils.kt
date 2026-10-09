package com.lagradost.cloudstream3.utils

import androidx.appcompat.app.AlertDialog
import java.util.WeakHashMap

object AppContextUtils {

    private val requested = WeakHashMap<AlertDialog, Int>()

    fun AlertDialog.setDefaultFocus(index: Int = 0) {
        synchronized(requested) { requested[this] = index.coerceAtLeast(0) }
    }

    fun defaultFocusOf(dialog: AlertDialog): Int = synchronized(requested) { requested[dialog] ?: 0 }
}
