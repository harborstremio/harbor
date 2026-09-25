package androidx.appcompat.app

import androidx.fragment.app.FragmentActivity

/** The activity type every extension casts to before it touches a screen. Everything it needs is
 * the fragment host underneath, so this adds no state of its own. */
open class AppCompatActivity : FragmentActivity()
