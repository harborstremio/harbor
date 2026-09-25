package com.lagradost.cloudstream3

import android.app.Activity

/**
 * Extensions reach for the activity to raise a toast or open a dialog. Off Android there is none,
 * and every call site guards for that, so it stays null rather than handing back a fake.
 */
object CommonActivity {

    var activity: Activity? = null
}
