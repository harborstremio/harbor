package harbor.capstan.test

import com.harbor.capstan.CompatParentLoader
import com.harbor.capstan.DexConverter
import com.harbor.capstan.ExtensionArchive
import com.harbor.capstan.ExtensionClassLoader
import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.UnconvertedMethod
import harbor.compat.host.PlatformHost
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.lang.reflect.Modifier

private val TIMEOUT_MS: Long = (System.getenv("STUB_TIMEOUT_MS") ?: "").toLongOrNull() ?: 45_000L

private class StubRow(
    val file: String,
    val providers: Int,
    val loadFailure: String?,
    val checks: List<StubCheck>,
)

private class StubCheck(val note: UnconvertedMethod, val verdict: String, val ok: Boolean)

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val from = System.getenv("STUB_SAMPLES")?.takeIf { it.isNotBlank() }?.let(::File) ?: File(root, "samples")
    val wanted = args.drop(1)
    val samples = from
        .listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.filter { wanted.isEmpty() || wanted.contains(it.nameWithoutExtension) }
        ?.sortedBy { it.name }
        .orEmpty()
    if (samples.isEmpty()) {
        System.err.println("no samples selected under $from")
        kotlin.system.exitProcess(1)
    }

    PlatformHost.dataDir = File(root, "out/stubgate-data")
    val cache = File(root, "out/cache")
    val converter = DexConverter(DexConverter.defaultToolsDir())
    val rows = ExtensionLoader(LoaderConfig(cacheDir = cache, callTimeoutMs = TIMEOUT_MS)).use { loader ->
        samples.map { row(loader, converter, cache, it) }
    }

    for (row in rows) {
        if (row.loadFailure != null) {
            println("FAIL ${row.file.padEnd(30)} load failed: ${row.loadFailure.take(110)}")
            continue
        }
        if (row.checks.isEmpty()) {
            println("ok   ${row.file.padEnd(30)} ${row.providers} provider(s), nothing unavailable")
            continue
        }
        for (check in row.checks) {
            println("${if (check.ok) "PASS" else "FAIL"} ${row.file.padEnd(30)} ${check.note.display}: ${check.verdict}")
        }
    }

    val report = File(root, "out/" + (System.getenv("STUB_REPORT") ?: "STUB-GATE.md"))
    report.parentFile.mkdirs()
    report.writeText(render(rows))
    val checks = rows.flatMap { it.checks }
    val passed = checks.count { it.ok }
    val broken = rows.count { it.loadFailure != null }
    println()
    println("STUB GATE $passed/${checks.size} stubbed methods refuse honestly, across ${rows.size} archives")
    println("$broken archive(s) failed to load")
    println("report ${report.path}")
    if (passed != checks.size || broken != 0) kotlin.system.exitProcess(1)
}

private fun row(loader: ExtensionLoader, converter: DexConverter, cache: File, file: File): StubRow {
    val outcome = runCatching { loader.load(file) }
    val extension = outcome.getOrNull()
        ?: return StubRow(file.name, 0, firstLine(outcome.exceptionOrNull()!!), emptyList())
    val providers = extension.providers.size
    val notes = extension.unavailable
    extension.close()
    if (notes.isEmpty()) return StubRow(file.name, providers, null, emptyList())
    val archive = ExtensionArchive.read(file)
    val jar = converter.jarFor(archive, cache)
    val checks = ExtensionClassLoader(jar, CompatParentLoader.standard()).use { classes ->
        notes.map { check(classes, it) }
    }
    return StubRow(file.name, providers, null, checks)
}

private fun check(classes: ClassLoader, note: UnconvertedMethod): StubCheck {
    val type = runCatching { classes.loadClass(note.owner) }.getOrNull()
        ?: return StubCheck(note, "class ${note.owner} is not in the converted jar", false)
    val method = find(type, note)
        ?: return StubCheck(note, "no method matching ${note.method}${note.descriptor}", false)
    method.isAccessible = true
    val receiver = if (Modifier.isStatic(method.modifiers)) null else receiver(type)
    if (receiver == null && !Modifier.isStatic(method.modifiers)) {
        return StubCheck(note, "cannot obtain an instance of ${note.owner} to call it on", false)
    }
    val arguments = method.parameterTypes.map { zero(it) }.toTypedArray()
    val thrown = try {
        method.invoke(receiver, *arguments)
        return StubCheck(note, "returned instead of refusing", false)
    } catch (wrapped: InvocationTargetException) {
        wrapped.targetException
    } catch (other: Throwable) {
        return StubCheck(note, "reflection failed before the body ran: ${firstLine(other)}", false)
    }
    val message = thrown.message.orEmpty()
    return when {
        thrown !is UnsupportedOperationException ->
            StubCheck(note, "threw ${thrown::class.java.name} rather than the refusal", false)
        !message.contains(note.display) ->
            StubCheck(note, "the refusal does not name the method: $message", false)
        !message.contains("the rest of the extension is unaffected") ->
            StubCheck(note, "the refusal does not say what still works: $message", false)
        message.contains("d2j") || message.contains("com.googlecode") ->
            StubCheck(note, "the refusal leaks converter internals: ${message.take(80)}", false)
        else -> StubCheck(note, "refused: $message", true)
    }
}

private fun find(type: Class<*>, note: UnconvertedMethod): Method? {
    val named = type.declaredMethods.filter { it.name == note.method }
    return named.firstOrNull { descriptor(it) == note.descriptor } ?: named.singleOrNull()
}

private fun descriptor(method: Method): String =
    method.parameterTypes.joinToString("", prefix = "(", postfix = ")") { descriptor(it) } + descriptor(method.returnType)

private fun descriptor(type: Class<*>): String = when {
    type == Void.TYPE -> "V"
    type == Boolean::class.javaPrimitiveType -> "Z"
    type == Byte::class.javaPrimitiveType -> "B"
    type == Char::class.javaPrimitiveType -> "C"
    type == Short::class.javaPrimitiveType -> "S"
    type == Int::class.javaPrimitiveType -> "I"
    type == Long::class.javaPrimitiveType -> "J"
    type == Float::class.javaPrimitiveType -> "F"
    type == Double::class.javaPrimitiveType -> "D"
    type.isArray -> "[" + descriptor(type.componentType)
    else -> "L" + type.name.replace('.', '/') + ";"
}

private fun receiver(type: Class<*>): Any? {
    runCatching {
        return type.getDeclaredField("INSTANCE").also { it.isAccessible = true }.get(null)
    }
    runCatching {
        return type.getDeclaredConstructor().also { it.isAccessible = true }.newInstance()
    }
    return null
}

private fun zero(type: Class<*>): Any? = when {
    type == Boolean::class.javaPrimitiveType -> false
    type == Byte::class.javaPrimitiveType -> 0.toByte()
    type == Char::class.javaPrimitiveType -> 0.toChar()
    type == Short::class.javaPrimitiveType -> 0.toShort()
    type == Int::class.javaPrimitiveType -> 0
    type == Long::class.javaPrimitiveType -> 0L
    type == Float::class.javaPrimitiveType -> 0f
    type == Double::class.javaPrimitiveType -> 0.0
    else -> null
}

private fun firstLine(t: Throwable): String {
    var cause: Throwable = t
    while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
    return "${cause::class.java.simpleName}: ${cause.message?.lineSequence()?.firstOrNull().orEmpty()}"
}

private fun render(rows: List<StubRow>): String {
    val checks = rows.flatMap { it.checks }
    val out = StringBuilder("# Stub gate\n\n")
    out.append("Dalvik accepts a method the class file format does not, so the converter replaces the body\n")
    out.append("it cannot hold with a throw. This calls every one of those and reads what came back.\n\n")
    out.append("Result: **${checks.count { it.ok }} of ${checks.size}** stubbed methods refuse honestly")
    out.append(", across ${rows.size} archives.\n\n")
    out.append("| extension | providers | method | what it did |\n| --- | --- | --- | --- |\n")
    for (row in rows) {
        if (row.loadFailure != null) {
            out.append("| `${row.file}` | | _load failed_ | ${row.loadFailure} |\n")
            continue
        }
        if (row.checks.isEmpty()) {
            out.append("| `${row.file}` | ${row.providers} | _nothing unavailable_ | |\n")
            continue
        }
        for (check in row.checks) {
            out.append("| `${row.file}` | ${row.providers} | `${check.note.display}` | ${check.verdict} |\n")
        }
    }
    out.append('\n')
    for (row in rows) {
        for (check in row.checks) {
            out.append("`${row.file}` ${check.note.display}${check.note.descriptor}\n\n")
            out.append("- why: ${check.note.reason}\n")
            out.append("- verdict: ${if (check.ok) "honest refusal" else "FAILED"}\n\n")
        }
    }
    return out.toString()
}
