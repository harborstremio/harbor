package com.lagradost.cloudstream3

import com.lagradost.api.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

suspend fun <A, B> List<A>.amap(f: suspend (A) -> B): List<B> = coroutineScope {
    map { async { f(it) } }.awaitAll()
}

suspend fun <A, B> List<A>.amapIndexed(f: suspend (Int, A) -> B): List<B> = coroutineScope {
    mapIndexed { index, item -> async { f(index, item) } }.awaitAll()
}

suspend fun <A, B> List<A>.apmap(f: suspend (A) -> B): List<B> = amap(f)

suspend fun runAllAsync(vararg transforms: suspend () -> Unit) {
    coroutineScope {
        for (transform in transforms) {
            launch {
                try {
                    transform()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (t: Throwable) {
                    Log.w("runAllAsync", "one branch failed: ${t::class.java.simpleName}: ${t.message}")
                }
            }
        }
    }
}
