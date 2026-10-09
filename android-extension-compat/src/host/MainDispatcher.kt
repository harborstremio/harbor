@file:OptIn(InternalCoroutinesApi::class)

package harbor.compat.host

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.InternalCoroutinesApi
import kotlinx.coroutines.MainCoroutineDispatcher
import kotlinx.coroutines.internal.MainDispatcherFactory
import java.util.concurrent.Executors
import kotlin.coroutines.CoroutineContext

internal object HostMainDispatcher : MainCoroutineDispatcher() {

    private val thread = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "capstan-main").apply { isDaemon = true }
    }

    override val immediate: MainCoroutineDispatcher get() = this

    override fun dispatch(context: CoroutineContext, block: Runnable) {
        thread.execute(block)
    }

    override fun limitedParallelism(parallelism: Int): CoroutineDispatcher = this

    override fun toString(): String = "capstan-main"
}

class HostMainDispatcherFactory : MainDispatcherFactory {

    override val loadPriority: Int = 0

    override fun createDispatcher(allFactories: List<MainDispatcherFactory>): MainCoroutineDispatcher =
        HostMainDispatcher
}
