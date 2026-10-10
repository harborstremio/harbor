package androidx.lifecycle

import kotlin.coroutines.CoroutineContext
import kotlinx.coroutines.CoroutineScope

open class LifecycleCoroutineScope internal constructor(
    override val coroutineContext: CoroutineContext,
) : CoroutineScope
