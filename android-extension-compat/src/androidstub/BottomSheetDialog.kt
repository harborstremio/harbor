package com.google.android.material.bottomsheet

import android.app.Dialog
import android.content.Context
import android.view.View

open class BottomSheetDialog @JvmOverloads constructor(
    context: Context? = null,
    theme: Int = 0,
) : Dialog(context) {

    private val behavior = BottomSheetBehavior<View>()

    open fun getBehavior(): BottomSheetBehavior<View> = behavior

    open fun getDismissWithAnimation(): Boolean = false

    open fun setDismissWithAnimation(value: Boolean) {}
}
