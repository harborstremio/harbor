package android.util

import harbor.compat.host.PlatformHost

class DisplayMetrics {

    @JvmField
    var density: Float = PlatformHost.density

    @JvmField
    var scaledDensity: Float = PlatformHost.density

    @JvmField
    var densityDpi: Int = (PlatformHost.density * DENSITY_DEFAULT).toInt()

    @JvmField
    var widthPixels: Int = PlatformHost.widthPixels

    @JvmField
    var heightPixels: Int = PlatformHost.heightPixels

    @JvmField
    var xdpi: Float = PlatformHost.density * DENSITY_DEFAULT

    @JvmField
    var ydpi: Float = PlatformHost.density * DENSITY_DEFAULT

    fun setTo(other: DisplayMetrics) {
        density = other.density
        scaledDensity = other.scaledDensity
        densityDpi = other.densityDpi
        widthPixels = other.widthPixels
        heightPixels = other.heightPixels
        xdpi = other.xdpi
        ydpi = other.ydpi
    }

    companion object {
        const val DENSITY_DEFAULT: Int = 160
    }
}
