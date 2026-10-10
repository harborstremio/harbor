package android.widget

import android.content.Context
import android.graphics.Typeface
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.View

open class TextView(context: Context?) : View(context) {

    interface OnEditorActionListener {
        fun onEditorAction(v: TextView?, actionId: Int, event: KeyEvent?): Boolean
    }

    private val textWatchers = ArrayList<TextWatcher>()

    var text: CharSequence? = null
        set(value) {
            val previous = field
            field = value
            dispatchTextChanged(previous, value)
        }
    var textColor: Int = 0
    var textSize: Float = 0f
    var gravity: Int = 0
    var typeface: Typeface? = null
    var typefaceStyle: Int = 0
    var isAllCaps: Boolean = false
    var lineSpacingExtra: Float = 0f
    var lineSpacingMultiplier: Float = 1f
    var maxLines: Int = Int.MAX_VALUE

    open fun setTypeface(typeface: Typeface?, style: Int) {
        this.typeface = typeface
        typefaceStyle = style
    }

    open fun setLineSpacing(add: Float, mult: Float) {
        lineSpacingExtra = add
        lineSpacingMultiplier = mult
    }

    open fun addTextChangedListener(watcher: TextWatcher?) {
        if (watcher == null || textWatchers.contains(watcher)) return
        textWatchers.add(watcher)
    }

    open fun removeTextChangedListener(watcher: TextWatcher?) {
        if (watcher == null) return
        textWatchers.remove(watcher)
    }

    private fun dispatchTextChanged(previous: CharSequence?, current: CharSequence?) {
        if (textWatchers.isEmpty()) return
        val before = previous?.length ?: 0
        val count = current?.length ?: 0
        for (watcher in ArrayList(textWatchers)) {
            try {
                watcher.beforeTextChanged(previous, 0, before, count)
                watcher.onTextChanged(current, 0, before, count)
                watcher.afterTextChanged(current as? Editable)
            } catch (t: Throwable) {
            }
        }
    }
}
