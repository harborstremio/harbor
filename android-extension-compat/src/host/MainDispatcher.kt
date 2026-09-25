@file:OptIn(InternalCoroutinesApi::class)

package harbor.compat.host

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.InternalCoroutinesApi
import kotlinx.coroutines.MainCoroutineDispatcher
import kotlinx.coroutines.internal.MainDispatcherFactory
import java.util.concurrent.Executors
import kotlin.coroutines.CoroutineContext

/** A main thread for extensions that were built for a device and expect one.
 *
 * Without this, the first extension that touches the main dispatcher takes the whole scrape down
 * with a message about a missing module, because off a device there is no main thread to find. One
 * daemon thread is enough: nothing here draws, and the ordering guarantee is what the calling code
 * is actually after. */
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

/** Found through META-INF/services, which is the only hook the coroutines library offers. */
class HostMainDispatcherFactory : MainDispatcherFactory {

    override val loadPriority: Int = 0

    override fun createDispatcher(allFactories: List<MainDispatcherFactory>): MainCoroutineDispatcher =
        HostMainDispatcher
}
