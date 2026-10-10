@file:JvmName("LifecycleKt")

package androidx.lifecycle

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

val Lifecycle.coroutineScope: LifecycleCoroutineScope
    get() = lifecycleHostScope

private val lifecycleHostScope: LifecycleCoroutineScope by lazy {
    LifecycleCoroutineScope(SupervisorJob() + Dispatchers.Main)
}
