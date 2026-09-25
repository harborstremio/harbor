package com.harbor.capstan

import java.io.File
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.concurrent.ConcurrentHashMap

class DexConversionException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/** Turns the Dalvik units of an extension into a jar of JVM bytecode, in this process.
 *
 * The converter is reached by reflection through a classloader that holds only its own jars. It
 * ships its own ASM, and letting that meet the host's would be a coin toss over which version a
 * shared name resolves to. */
class DexConverter(private val toolsDir: File) {

    private val tools: ClassLoader by lazy { isolate() }

    private val locks = ConcurrentHashMap<String, Any>()

    /** The cached jar for [archive], converting it first if this is the first time these exact
     * bytes have been seen. */
    fun jarFor(archive: OpenArchive, cacheDir: File): File {
        val target = File(cacheDir, "${archive.file.nameWithoutExtension}-${archive.fingerprint}.jar")
        if (target.isFile && target.length() > 0) return target
        synchronized(locks.computeIfAbsent(target.path) { Any() }) {
            if (target.isFile && target.length() > 0) return target
            if (!cacheDir.isDirectory && !cacheDir.mkdirs()) {
                throw DexConversionException("cannot create cache directory $cacheDir")
            }
            val staging = File(cacheDir, "${target.nameWithoutExtension}.${ProcessHandle.current().pid()}.part")
            staging.delete()
            try {
                convert(archive.dexUnits, staging)
                Files.move(staging.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            } finally {
                staging.delete()
            }
            return target
        }
    }

    fun convert(units: List<ByteArray>, target: File) {
        if (units.isEmpty()) throw DexConversionException("nothing to convert")
        try {
            val dex2jar = tools.loadClass("com.googlecode.d2j.dex.Dex2jar")
            val readerType = tools.loadClass("com.googlecode.d2j.reader.BaseDexFileReader")
            var job = dex2jar.getMethod("from", readerType).invoke(null, reader(units))
            job = dex2jar.getMethod("topoLogicalSort").invoke(job)
            job = dex2jar.getMethod("skipDebug", Boolean::class.javaPrimitiveType).invoke(job, false)
            job = dex2jar.getMethod("noCode", Boolean::class.javaPrimitiveType).invoke(job, false)
            target.delete()
            dex2jar.getMethod("to", Path::class.java).invoke(job, target.toPath())
        } catch (t: Throwable) {
            throw DexConversionException("conversion to JVM bytecode failed: ${rootCause(t)}", t)
        }
        if (!target.isFile || target.length() == 0L) {
            throw DexConversionException("conversion produced no output at $target")
        }
    }

    private fun reader(units: List<ByteArray>): Any {
        val single = tools.loadClass("com.googlecode.d2j.reader.DexFileReader")
            .getConstructor(ByteArray::class.java)
        if (units.size == 1) return single.newInstance(units[0])
        val readers = units.map { single.newInstance(it) }
        return tools.loadClass("com.googlecode.d2j.reader.MultiDexFileReader")
            .getConstructor(Collection::class.java)
            .newInstance(readers)
    }

    private fun isolate(): ClassLoader {
        val jars = toolsDir.listFiles { f: File -> f.isFile && f.name.endsWith(".jar") }
            ?.sortedBy { it.name }
            ?: throw DexConversionException("no converter jars under $toolsDir")
        if (jars.isEmpty()) throw DexConversionException("no converter jars under $toolsDir")
        return URLClassLoader(
            jars.map { it.toURI().toURL() }.toTypedArray(),
            ClassLoader.getPlatformClassLoader(),
        )
    }

    private fun rootCause(t: Throwable): String {
        var cause: Throwable = t
        while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
        return "${cause::class.java.simpleName}: ${cause.message}"
    }

    companion object {
        private const val TOOLS_PROPERTY = "harbor.capstan.dexTools"

        private val RELATIVE = File("tools").resolve("dex-tools").resolve("lib").path

        /** Finds the vendored converter by walking up from wherever this code was loaded, so a
         * caller that has not configured anything still gets a working loader from a checkout. */
        fun defaultToolsDir(): File {
            System.getProperty(TOOLS_PROPERTY)?.takeIf { it.isNotBlank() }?.let { return File(it) }
            var here: File? = codeSourceDir()
            var steps = 0
            while (here != null && steps < 6) {
                val candidate = File(here, RELATIVE)
                if (candidate.isDirectory) return candidate
                here = here.parentFile
                steps++
            }
            return File(RELATIVE)
        }

        private fun codeSourceDir(): File? {
            val location = runCatching {
                DexConverter::class.java.protectionDomain?.codeSource?.location
            }.getOrNull() ?: return null
            val path = runCatching { File(location.toURI()) }.getOrNull() ?: return null
            return if (path.isDirectory) path else path.parentFile
        }
    }
}
