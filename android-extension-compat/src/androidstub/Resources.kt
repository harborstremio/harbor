package android.content.res

import android.graphics.drawable.Drawable
import android.util.DisplayMetrics
import harbor.compat.host.PlatformHost

open class Resources {

    open fun getDisplayMetrics(): DisplayMetrics = DisplayMetrics()

    /** Zero is what Android returns for a name with no entry in the resource table, and every
     * extension that asks guards on it, so an unwired host makes those branches skip themselves. */
    open fun getIdentifier(name: String?, defType: String?, defPackage: String?): Int =
        PlatformHost.resourceId(name, defType, defPackage)

    open fun getLayout(id: Int): XmlResourceParser = XmlResourceParser()

    open fun getDrawable(id: Int, theme: Theme?): Drawable? = null

    open fun getDrawable(id: Int): Drawable? = getDrawable(id, null)

    open fun getString(id: Int): String = ""

    open fun getColor(id: Int, theme: Theme?): Int = 0

    open fun newTheme(): Theme = Theme()

    class Theme {

        fun applyStyle(resId: Int, force: Boolean) {}

        fun setTo(other: Theme) {}
    }
}
