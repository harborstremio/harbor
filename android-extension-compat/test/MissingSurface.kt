package harbor.capstan.test

import java.io.File
import java.util.zip.ZipFile

/** How much of a package an extension actually names, measured from its converted bytecode.
 *
 * A failure reports the first type that could not be resolved, which reads like a one line gap.
 * This is the rest of the iceberg: if the extension names sixty members of the package, no stub
 * is going to make it work, and knowing that before writing one is the whole value.
 */
object MissingSurface {

    class Gap(val packageRoot: String, val types: List<String>)

    fun measure(jar: File, namedType: String): Gap? {
        if (!jar.isFile) return null
        val root = namedType.split('.').take(3).joinToString(".")
        val path = root.replace('.', '/')
        val found = sortedSetOf<String>()
        ZipFile(jar).use { zip ->
            zip.entries().asSequence()
                .filter { it.name.endsWith(".class") }
                .forEach { entry ->
                    val bytes = zip.getInputStream(entry).use { it.readBytes() }
                    collect(bytes, path, found)
                }
        }
        return if (found.isEmpty()) null else Gap(root, found.toList())
    }

    /** Walks the raw class bytes rather than parsing the constant pool: every reference to a type,
     * whether a name or a descriptor, carries its path verbatim, so scanning for the package path
     * finds all of them without needing a bytecode library on this classpath. */
    private fun collect(bytes: ByteArray, path: String, into: MutableSet<String>) {
        val needle = path.toByteArray(Charsets.UTF_8)
        var at = indexOf(bytes, needle, 0)
        while (at >= 0) {
            var end = at + needle.size
            while (end < bytes.size && isTypeChar(bytes[end])) end++
            into.add(String(bytes, at, end - at, Charsets.UTF_8).replace('/', '.'))
            at = indexOf(bytes, needle, end)
        }
    }

    private fun isTypeChar(b: Byte): Boolean {
        val c = b.toInt().toChar()
        return c.isLetterOrDigit() || c == '/' || c == '_' || c == '$'
    }

    private fun indexOf(haystack: ByteArray, needle: ByteArray, from: Int): Int {
        outer@ for (i in from..haystack.size - needle.size) {
            for (j in needle.indices) if (haystack[i + j] != needle[j]) continue@outer
            return i
        }
        return -1
    }
}
