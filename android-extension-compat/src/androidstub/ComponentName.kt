package android.content

class ComponentName(private val packageName: String, private val className: String) {

    fun getPackageName(): String = packageName

    fun getClassName(): String = className

    fun flattenToString(): String = "$packageName/$className"

    fun flattenToShortString(): String {
        val short = if (className.startsWith("$packageName.")) className.substring(packageName.length) else className
        return "$packageName/$short"
    }

    override fun toString(): String = "ComponentInfo{${flattenToString()}}"

    override fun equals(other: Any?): Boolean =
        other is ComponentName && other.packageName == packageName && other.className == className

    override fun hashCode(): Int = packageName.hashCode() * 31 + className.hashCode()
}
