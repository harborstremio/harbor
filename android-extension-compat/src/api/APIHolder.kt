package com.lagradost.cloudstream3

import java.util.Locale

/**
 * Extensions call `capitalize` through this object because it is declared there as a string
 * extension, which compiles to an instance method taking the receiver.
 */
object APIHolder {

    fun String.capitalize(): String =
        replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }
}
