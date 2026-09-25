package com.lagradost.cloudstream3.mvvm

import com.lagradost.api.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.PrintWriter
import java.io.StringWriter
import java.net.SocketTimeoutException
import java.net.UnknownHostException

const val ERROR_TAG = "extension"

fun logError(throwable: Throwable) {
    Log.d(ERROR_TAG, "-------------------------------------------------------------------")
    Log.d(ERROR_TAG, "Error: ${throwable.localizedMessage}")
    Log.d(ERROR_TAG, stackTraceOf(throwable))
    Log.d(ERROR_TAG, "-------------------------------------------------------------------")
}

fun <T> normalSafeApiCall(apiCall: () -> T): T? = try {
    apiCall()
} catch (throwable: Throwable) {
    logError(throwable)
    null
}

suspend fun <T> suspendSafeApiCall(apiCall: suspend () -> T): T? = try {
    apiCall()
} catch (cancel: CancellationException) {
    throw cancel
} catch (throwable: Throwable) {
    logError(throwable)
    null
}

suspend fun <T> safeApiCall(apiCall: suspend () -> T): Resource<T> = withContext(Dispatchers.IO) {
    try {
        Resource.Success(apiCall())
    } catch (cancel: CancellationException) {
        throw cancel
    } catch (throwable: Throwable) {
        logError(throwable)
        failureOf(throwable)
    }
}

private fun failureOf(throwable: Throwable): Resource.Failure {
    val network = throwable is SocketTimeoutException ||
        throwable is UnknownHostException ||
        throwable is IOException
    val text = throwable.localizedMessage ?: throwable.message ?: throwable.toString()
    return Resource.Failure(network, null, null, text)
}

private fun stackTraceOf(throwable: Throwable): String {
    val writer = StringWriter()
    PrintWriter(writer).use { throwable.printStackTrace(it) }
    return writer.toString()
}
