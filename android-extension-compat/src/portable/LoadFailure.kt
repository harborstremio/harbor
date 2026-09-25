package com.harbor.capstan

/** Why a load did not finish. One type for both platforms, so a caller that handles a failed
 * install on the desktop handles the same failure on a device. */
class ExtensionLoadException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/** The innermost cause, named. A wrapped failure reads as the wrapper otherwise, which names the
 * layer that noticed rather than the one that broke. */
internal fun describe(t: Throwable): String {
    var cause: Throwable = t
    while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
    return "${cause::class.java.name}: ${cause.message}"
}
