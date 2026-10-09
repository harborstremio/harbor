package android.widget

import android.content.Context

open class Button(context: Context?) : TextView(context) {
    init {
        isClickable = true
        isFocusable = true
    }
}
