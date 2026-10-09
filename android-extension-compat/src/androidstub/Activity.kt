package android.app

import android.content.Context
import android.content.ContextWrapper

open class Activity @JvmOverloads constructor(base: Context? = null) : ContextWrapper(base) {

    open fun isFinishing(): Boolean = false

    open fun isDestroyed(): Boolean = false
}
