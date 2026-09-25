package android.app

import android.content.Context
import android.content.ContextWrapper

/** Sits under ContextWrapper so the unwrap walk extensions use to find the hosting activity from
 * an arbitrary context can actually reach one. */
open class Activity @JvmOverloads constructor(base: Context? = null) : ContextWrapper(base)
