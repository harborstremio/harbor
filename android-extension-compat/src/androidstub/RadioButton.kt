package android.widget

import android.content.Context

open class RadioButton(context: Context?) : CompoundButton(context) {

    var tag: Any? = null

    override fun toggle() {
        if (!isChecked) isChecked = true
    }
}
