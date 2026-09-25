package android.widget

import android.content.Context
import android.util.AttributeSet
import android.view.View

open class ProgressBar @JvmOverloads constructor(
    context: Context?,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context) {
    var isIndeterminate: Boolean = true
    var progress: Int = 0
    var max: Int = 100
}
