package com.harbor.capstan

class ExtensionLoadException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

internal fun describe(t: Throwable): String {
    var cause: Throwable = t
    while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
    return "${cause::class.java.name}: ${cause.message}"
}
