package androidx.appcompat.app

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle

open class AppCompatActivity : FragmentActivity() {

    private val lifecycle = Lifecycle()

    open fun getLifecycle(): Lifecycle = lifecycle
}
