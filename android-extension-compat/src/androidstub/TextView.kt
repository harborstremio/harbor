package android.widget

import android.content.Context
import android.graphics.Typeface
import android.view.View

open class TextView(context: Context?) : View(context) {

    var text: CharSequence? = null
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
}
