package android.view

open class KeyEvent @JvmOverloads constructor(
    val action: Int = ACTION_DOWN,
    val keyCode: Int = KEYCODE_UNKNOWN,
) {
    companion object {
        const val ACTION_DOWN: Int = 0
        const val ACTION_UP: Int = 1
        const val KEYCODE_UNKNOWN: Int = 0
        const val KEYCODE_BACK: Int = 4
    }
}
