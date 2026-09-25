package android.view

open class MotionEvent private constructor() {

    var downTime: Long = 0L
    var eventTime: Long = 0L
    var action: Int = ACTION_DOWN
    var x: Float = 0f
    var y: Float = 0f
    var metaState: Int = 0

    open fun recycle() {
        downTime = 0L
        eventTime = 0L
        action = ACTION_DOWN
        x = 0f
        y = 0f
        metaState = 0
    }

    companion object {
        const val ACTION_DOWN: Int = 0
        const val ACTION_UP: Int = 1
        const val ACTION_MOVE: Int = 2
        const val ACTION_CANCEL: Int = 3

        @JvmStatic
        fun obtain(
            downTime: Long,
            eventTime: Long,
            action: Int,
            x: Float,
            y: Float,
            metaState: Int,
        ): MotionEvent {
            val e = MotionEvent()
            e.downTime = downTime
            e.eventTime = eventTime
            e.action = action
            e.x = x
            e.y = y
            e.metaState = metaState
            return e
        }
    }
}
