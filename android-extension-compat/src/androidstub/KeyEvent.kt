package android.view

open class KeyEvent @JvmOverloads constructor(
    val action: Int = ACTION_DOWN,
    val keyCode: Int = KEYCODE_UNKNOWN,
    val metaState: Int = 0,
) {
    open fun isShiftPressed(): Boolean = metaState and META_SHIFT_ON != 0

    companion object {
        const val ACTION_DOWN: Int = 0
        const val ACTION_UP: Int = 1
        const val KEYCODE_UNKNOWN: Int = 0
        const val KEYCODE_BACK: Int = 4
        const val META_SHIFT_ON: Int = 1
    }
}
