package android.content

interface DialogInterface {

    fun dismiss()

    fun cancel()

    interface OnClickListener {
        fun onClick(dialog: DialogInterface?, which: Int)
    }

    interface OnKeyListener {
        fun onKey(dialog: DialogInterface?, keyCode: Int, event: android.view.KeyEvent?): Boolean
    }

    interface OnDismissListener {
        fun onDismiss(dialog: DialogInterface?)
    }

    interface OnCancelListener {
        fun onCancel(dialog: DialogInterface?)
    }

    companion object {
        const val BUTTON_POSITIVE: Int = -1
        const val BUTTON_NEGATIVE: Int = -2
        const val BUTTON_NEUTRAL: Int = -3
    }
}
