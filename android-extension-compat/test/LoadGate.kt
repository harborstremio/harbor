package harbor.capstan.test

import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoadStage
import com.harbor.capstan.LoadWatch
import com.harbor.capstan.LoadedExtension
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.ProviderInfo
import harbor.compat.host.PlatformHost
import java.io.File

/** Runs every sample extension through the real loader and records where each one got to.
 *
 * The stages come from the loader itself rather than from a copy of its steps here, so a stage
 * this gate reports as reached is one production code actually reached.
 */

class ProviderReport(val info: ProviderInfo)

class GateRow(
    val file: String,
    val reached: List<Pair<LoadStage, String>>,
    val version: Int,
    val entryClass: String,
    val providers: List<ProviderReport>,
    val extractors: List<String>,
    val failure: Failure?,
) {
    val ok: Boolean get() = failure == null

    val failedStage: LoadStage?
        get() = if (ok) null else LoadStage.entries.firstOrNull { stage -> reached.none { it.first == stage } }
}

class Failure(
    val exceptionType: String,
    val message: String,
    val namedType: String?,
    val owner: String,
    val gap: MissingSurface.Gap?,
)

private const val TIMEOUT_MS = 120_000L

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val samples = File(root, "samples")
        .listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.sortedBy { it.name }
        .orEmpty()
    if (samples.isEmpty()) {
        System.err.println("no samples under $root")
        kotlin.system.exitProcess(1)
    }

    PlatformHost.dataDir = File(root, "out/loadgate-data")
    val groups = GroupIndex.read(File(root, "spec/groups"))
    val config = LoaderConfig(cacheDir = File(root, "out/cache"), callTimeoutMs = TIMEOUT_MS)

    val cache = File(root, "out/cache")
    val rows = ExtensionLoader(config).use { loader -> samples.map { run(loader, it, groups, cache) } }

    for (row in rows) {
        if (row.ok) {
            println("PASS ${row.file.padEnd(30)} ${row.providers.joinToString(", ") { it.info.name }}")
        } else {
            println("FAIL ${row.file.padEnd(30)} at ${row.failedStage}: ${row.failure!!.message.take(120)}")
        }
    }

    val report = File(root, "out/LOAD-GATE.md")
    report.parentFile.mkdirs()
    report.writeText(GateReport.render(rows))
    val passed = rows.count { it.ok }
    println()
    println("LOAD GATE $passed/${rows.size} extensions loaded")
    println("report ${report.path}")
    if (passed != rows.size) kotlin.system.exitProcess(1)
}

private fun run(loader: ExtensionLoader, file: File, groups: GroupIndex, cache: File): GateRow {
    val reached = ArrayList<Pair<LoadStage, String>>()
    val watch = LoadWatch { stage, detail -> reached.add(stage to detail) }
    val outcome = runCatching { loader.load(file, watch) }
    val extension = outcome.getOrNull()
    val row = GateRow(
        file = file.name,
        reached = reached,
        version = extension?.version ?: 0,
        entryClass = extension?.entryClassName ?: reached.firstOrNull { it.first == LoadStage.ENTRY }?.second ?: "",
        providers = extension?.providers?.map { ProviderReport(it.info) }.orEmpty(),
        extractors = extension?.extractorNames.orEmpty(),
        failure = outcome.exceptionOrNull()?.let { describe(it, groups, cache, reached) },
    )
    extension?.close()
    return row
}

/** The type an exception names is the whole point of the failure line: it is the single fact that
 * says which part of the surface owes the fix. */
private fun describe(
    failure: Throwable,
    groups: GroupIndex,
    cache: File,
    reached: List<Pair<LoadStage, String>>,
): Failure {
    var cause: Throwable = failure
    while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
    val message = (cause.message ?: cause::class.java.name).lineSequence().first().trim()
    val named = TYPE_IN_MESSAGE.find(message)?.value?.replace('/', '.')
    val jarName = reached.firstOrNull { it.first == LoadStage.CONVERT }?.second?.substringBefore(',')
    return Failure(
        exceptionType = cause::class.java.name,
        message = message,
        namedType = named,
        owner = named?.let { groups.owner(it) } ?: "not a type name, see the message",
        gap = if (named == null || jarName == null) null else MissingSurface.measure(File(cache, jarName), named),
    )
}

private val TYPE_IN_MESSAGE = Regex("""[A-Za-z_][\w$]*(?:[./][A-Za-z_][\w$]*){2,}""")

/** Maps a class named in a failure back to the group of the compat surface that owns it. */
class GroupIndex(private val byClass: Map<String, String>) {

    fun owner(className: String): String {
        byClass[className]?.let { return it }
        val outer = className.substringBefore('$')
        byClass[outer]?.let { return "$it (outer type $outer)" }
        val prefix = byClass.keys.filter { className.startsWith("${it.substringBeforeLast('.')}.") }
        if (prefix.isNotEmpty()) return "${byClass.getValue(prefix.first())} (same package, type itself not in the contract)"
        return "no group: outside the measured contract"
    }

    companion object {
        fun read(dir: File): GroupIndex {
            val map = HashMap<String, String>()
            dir.listFiles { f: File -> f.isFile && f.name.endsWith(".txt") }?.sortedBy { it.name }?.forEach { file ->
                val group = file.nameWithoutExtension
                file.forEachLine { line ->
                    val parts = line.split('|')
                    if (parts.size >= 2 && parts[1].isNotBlank()) map.putIfAbsent(parts[1], group)
                }
            }
            return GroupIndex(map)
        }
    }
}
