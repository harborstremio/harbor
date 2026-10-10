@file:JvmName("Log")

package android.util

import harbor.compat.host.PlatformHost
import java.io.PrintWriter
import java.io.StringWriter

const val VERBOSE: Int = 2
const val DEBUG: Int = 3
const val INFO: Int = 4
const val WARN: Int = 5
const val ERROR: Int = 6
const val ASSERT: Int = 7

fun v(tag: String, message: String): Int = write(VERBOSE, tag, message, null)

fun d(tag: String, message: String): Int = write(DEBUG, tag, message, null)

fun i(tag: String, message: String): Int = write(INFO, tag, message, null)

fun w(tag: String, message: String): Int = write(WARN, tag, message, null)

fun e(tag: String, message: String): Int = write(ERROR, tag, message, null)

fun v(tag: String, message: String, error: Throwable?): Int = write(VERBOSE, tag, message, error)

fun d(tag: String, message: String, error: Throwable?): Int = write(DEBUG, tag, message, error)

fun i(tag: String, message: String, error: Throwable?): Int = write(INFO, tag, message, error)

fun w(tag: String, message: String, error: Throwable?): Int = write(WARN, tag, message, error)

fun e(tag: String, message: String, error: Throwable?): Int = write(ERROR, tag, message, error)

fun w(tag: String, error: Throwable?): Int = write(WARN, tag, error?.message ?: "", error)

fun wtf(tag: String, message: String): Int = write(ASSERT, tag, message, null)

fun isLoggable(tag: String, level: Int): Boolean = true

fun getStackTraceString(error: Throwable?): String {
    if (error == null) return ""
    val writer = StringWriter()
    error.printStackTrace(PrintWriter(writer))
    return writer.toString()
}

fun println(priority: Int, tag: String, message: String): Int = write(priority, tag, message, null)

private fun write(priority: Int, tag: String, message: String, error: Throwable?): Int {
    PlatformHost.log(priority, tag, message, error)
    return message.length
}
