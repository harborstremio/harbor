package android.widget

import android.content.Context

open class Toast(val context: Context?) {

    var text: CharSequence? = null
    var duration: Int = LENGTH_SHORT
    var isShowing: Boolean = false

    open fun show() {
        isShowing = true
        try {
            sink?.invoke(this)
        } catch (t: Throwable) {
        }
    }

    open fun cancel() {
        isShowing = false
    }

    companion object {
        const val LENGTH_SHORT: Int = 0
        const val LENGTH_LONG: Int = 1

        // The host sets this to surface a toast in its own interface. Unset, a toast is recorded
        // and goes nowhere, which is the benign outcome when nothing can display it.
        @JvmStatic
        var sink: ((Toast) -> Unit)? = null

        @JvmStatic
        fun makeText(context: Context?, text: CharSequence?, duration: Int): Toast {
            val toast = Toast(context)
            toast.text = text
            toast.duration = duration
            return toast
        }
    }
}
