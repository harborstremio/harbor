package com.harbor.capstan

import java.io.File
import java.lang.reflect.InvocationHandler
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Proxy
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.concurrent.ConcurrentHashMap

class DexConversionException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

class DexConverter(private val toolsDir: File) {

    private val tools: ClassLoader by lazy { isolate() }

    private val locks = ConcurrentHashMap<String, Any>()

    fun jarFor(archive: OpenArchive, cacheDir: File): File {
        val target = File(cacheDir, "${archive.file.nameWithoutExtension}-${archive.fingerprint}.jar")
        if (cached(target)) return target
        synchronized(locks.computeIfAbsent(target.path) { Any() }) {
            if (cached(target)) return target
            if (!cacheDir.isDirectory && !cacheDir.mkdirs()) {
                throw DexConversionException("cannot create cache directory $cacheDir")
            }
            val staging = File(cacheDir, "${target.nameWithoutExtension}.${ProcessHandle.current().pid()}.part")
            staging.delete()
            try {
                val notes = convert(archive.dexUnits, staging)
                Files.move(staging.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
                writeNotes(notesFile(target), notes)
            } finally {
                staging.delete()
            }
            return target
        }
    }

    fun convert(units: List<ByteArray>, target: File): List<UnconvertedMethod> {
        if (units.isEmpty()) throw DexConversionException("nothing to convert")
        val notes = ArrayList<UnconvertedMethod>()
        try {
            val dex2jar = tools.loadClass("com.googlecode.d2j.dex.Dex2jar")
            val readerType = tools.loadClass("com.googlecode.d2j.reader.BaseDexFileReader")
            val handlerType = tools.loadClass("com.googlecode.d2j.dex.DexExceptionHandler")
            var job = dex2jar.getMethod("from", readerType).invoke(null, reader(units))
            job = dex2jar.getMethod("withExceptionHandler", handlerType).invoke(job, handler(handlerType, notes))
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
        return notes
    }

    fun unconverted(jar: File): List<UnconvertedMethod> {
        val notes = notesFile(jar)
        if (!notes.isFile) return emptyList()
        return runCatching {
            notes.readLines().mapNotNull { line -> line.takeIf { it.isNotBlank() }?.let(UnconvertedMethod::decode) }
        }.getOrDefault(emptyList())
    }

    private fun cached(jar: File): Boolean = jar.isFile && jar.length() > 0 && notesFile(jar).isFile

    private fun notesFile(jar: File) = File(jar.parentFile, "${jar.nameWithoutExtension}.unconverted")

    private fun writeNotes(notes: File, entries: List<UnconvertedMethod>) {
        runCatching { notes.writeText(entries.joinToString("\n") { it.encode() }) }
    }

    private fun handler(handlerType: Class<*>, notes: MutableList<UnconvertedMethod>): Any {
        val base = tools.loadClass("com.googlecode.d2j.dex.BaseDexExceptionHandler")
            .getConstructor()
            .newInstance()
        val stub = InvocationHandler { _, method, args ->
            val given: Array<Any?> = args ?: emptyArray()
            val ours = method.name == "handleMethodTranslateException" && given.size == 4
            val note = if (ours) note(given[0], given[3] as? Throwable) else null
            if (note != null) {
                System.err.println("capstan: ${note.display}${note.descriptor} stubbed, ${note.reason}")
            }
            if (note != null && writeThrow(given[2], note.message)) {
                notes.add(note)
                null
            } else {
                if (note != null) notes.add(note)
                try {
                    method.invoke(base, *given)
                } catch (thrown: InvocationTargetException) {
                    throw thrown.targetException
                }
            }
        }
        return Proxy.newProxyInstance(tools, arrayOf(handlerType), stub)
    }

    private fun note(dexMethod: Any?, failure: Throwable?): UnconvertedMethod {
        val text = dexMethod?.toString().orEmpty()
        val owner = text.substringAfter('L', "").substringBefore(";->").replace('/', '.')
        val rest = text.substringAfter(";->", text)
        val name = rest.substringBefore('(')
        val descriptor = rest.substring(name.length.coerceAtMost(rest.length))
        val cause = failure?.let(::deepest)
        val size = cause?.takeIf { it::class.java.simpleName == "MethodTooLargeException" }
            ?.let { runCatching { it::class.java.getMethod("getCodeSize").invoke(it) as Int }.getOrNull() }
        val reason = when {
            size != null -> "needs $size bytes of JVM method code, the class file format allows $CODE_LIMIT"
            cause != null -> "the converter could not translate it: ${describe(cause)}"
            else -> "the converter could not translate it"
        }
        return UnconvertedMethod(
            owner = owner.ifEmpty { "unknown" },
            method = name.ifEmpty { "unknown" },
            descriptor = descriptor,
            reason = reason,
        )
    }

    private fun writeThrow(visitor: Any?, message: String): Boolean {
        val mv = visitor ?: return false
        val type = mv::class.java
        val int = Int::class.javaPrimitiveType
        val bool = Boolean::class.javaPrimitiveType
        return runCatching {
            type.getMethod("visitTypeInsn", int, String::class.java).invoke(mv, OP_NEW, THROWN)
            type.getMethod("visitInsn", int).invoke(mv, OP_DUP)
            type.getMethod("visitLdcInsn", Any::class.java).invoke(mv, message)
            type.getMethod("visitMethodInsn", int, String::class.java, String::class.java, String::class.java, bool)
                .invoke(mv, OP_INVOKESPECIAL, THROWN, "<init>", "(Ljava/lang/String;)V", false)
            type.getMethod("visitInsn", int).invoke(mv, OP_ATHROW)
            true
        }.getOrDefault(false)
    }

    private fun deepest(t: Throwable): Throwable {
        var cause: Throwable = t
        while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
        return cause
    }

    private fun describe(t: Throwable): String = "${t::class.java.simpleName}: ${t.message}"

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

    private fun rootCause(t: Throwable): String = describe(deepest(t))

    companion object {
        const val CODE_LIMIT = 65535

        private const val TOOLS_PROPERTY = "harbor.capstan.dexTools"

        private const val THROWN = "java/lang/UnsupportedOperationException"

        private const val OP_DUP = 89
        private const val OP_NEW = 187
        private const val OP_INVOKESPECIAL = 183
        private const val OP_ATHROW = 191

        private val RELATIVE = File("tools").resolve("dex-tools").resolve("lib").path

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
