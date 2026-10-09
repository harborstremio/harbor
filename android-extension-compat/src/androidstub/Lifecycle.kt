package androidx.lifecycle

open class Lifecycle {

    enum class State {
        DESTROYED,
        INITIALIZED,
        CREATED,
        STARTED,
        RESUMED,
        ;

        fun isAtLeast(state: State): Boolean = compareTo(state) >= 0
    }

    open val currentState: State = State.RESUMED
}
