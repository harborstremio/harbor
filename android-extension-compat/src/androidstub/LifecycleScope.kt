@file:JvmName("LifecycleOwnerKt")

package androidx.lifecycle

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

val LifecycleOwner.lifecycleScope: LifecycleCoroutineScope
    get() = hostScope

private val hostScope: LifecycleCoroutineScope by lazy {
    LifecycleCoroutineScope(SupervisorJob() + Dispatchers.Main)
}
