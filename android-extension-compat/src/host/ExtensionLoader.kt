package com.harbor.capstan

import com.lagradost.cloudstream3.plugins.BasePlugin
import com.lagradost.cloudstream3.plugins.CloudstreamPlugin
import com.lagradost.cloudstream3.plugins.Plugin
import com.lagradost.cloudstream3.utils.registerExtractor
import harbor.compat.host.PlatformHost
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.util.zip.ZipFile

class LoaderConfig(
    /** Where converted jars are kept. Null puts each one beside its own source file. */
    val cacheDir: File? = null,
    val dexToolsDir: File = DexConverter.defaultToolsDir(),
    /** Ceiling on one call into an extension. Zero removes the ceiling. */
    val callTimeoutMs: Long = 120_000,
)

/** Turns an extension file on disk into live providers.
 *
 * One loader owns one coroutine scope, and every suspend call into an extension crosses back into
 * blocking code here rather than anywhere further in, so an extension never has to know what kind
 * of thread the host called it on. */
class ExtensionLoader(private val config: LoaderConfig = LoaderConfig()) : AutoCloseable {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + CoroutineName("capstan-extension"))

    private val edge = SuspendEdge(scope, config.callTimeoutMs)

    private val converter = DexConverter(config.dexToolsDir)

    private val compat = CompatParentLoader.standard()

    init {
        ServiceLedger.install()
    }

    @JvmOverloads
    fun load(file: File, watch: LoadWatch = LoadWatch.NONE): LoadedExtension {
        startNewPipe()
        val archive = ExtensionArchive.read(file)
        watch.reached(LoadStage.ARCHIVE, "${archive.dexUnits.size} dex unit(s), manifest v${archive.manifest.version}")
        val jar = converter.jarFor(archive, config.cacheDir ?: defaultCacheDir(file))
        watch.reached(LoadStage.CONVERT, "${jar.name}, ${jar.length()} bytes")
        val classLoader = ExtensionClassLoader(jar, compat)
        try {
            sealed(classLoader)
            watch.reached(LoadStage.LINK, "barrier holds")
            val entryName = archive.manifest.entryClassName ?: findEntry(jar, classLoader)
            ?: throw ExtensionLoadException("${file.name} declares no entry class and none is annotated")
            watch.reached(LoadStage.ENTRY, entryName)
            val plugin = instantiate(classLoader, entryName)
            watch.reached(LoadStage.INSTANTIATE, plugin::class.java.name)
            register(plugin)
            plugin.extractorApis.forEach(::registerExtractor)
            watch.reached(
                LoadStage.REGISTER,
                "${plugin.mainApis.size} provider(s), ${plugin.extractorApis.size} extractor(s)",
            )
            return LoadedExtension(
                name = archive.manifest.name,
                version = archive.manifest.version,
                file = file,
                entryClassName = entryName,
                providers = plugin.mainApis.map { Provider(it, edge) },
                extractors = plugin.extractorApis.toList(),
                classLoader = classLoader,
            )
        } catch (t: Throwable) {
            runCatching { classLoader.close() }
            throw if (t is ExtensionLoadException) t
            else ExtensionLoadException("${file.name} failed to load: ${describe(t)}", t)
        }
    }

    /** Checks the two halves of the barrier where it is built rather than trusting that it holds:
     * the host is invisible, and a compat type is the one class both sides already share. */
    private fun sealed(classLoader: ClassLoader) {
        val host = ExtensionLoader::class.java.name
        if (runCatching { classLoader.loadClass(host) }.isSuccess) {
            throw ExtensionLoadException("the host is reachable from extension code, refusing to load")
        }
        val shared = classLoader.loadClass(BasePlugin::class.java.name)
        if (shared !== BasePlugin::class.java) {
            throw ExtensionLoadException("the compat layer resolved to a second copy, refusing to load")
        }
    }

    private fun instantiate(classLoader: ClassLoader, entryName: String): BasePlugin {
        val type = try {
            classLoader.loadClass(entryName)
        } catch (absent: ClassNotFoundException) {
            throw ExtensionLoadException("entry class $entryName is not in the converted jar", absent)
        }
        if (!BasePlugin::class.java.isAssignableFrom(type)) {
            throw ExtensionLoadException("entry class $entryName is not an extension entry point")
        }
        val constructor = try {
            type.getDeclaredConstructor()
        } catch (absent: NoSuchMethodException) {
            throw ExtensionLoadException("entry class $entryName has no no argument constructor", absent)
        }
        constructor.isAccessible = true
        return try {
            constructor.newInstance() as BasePlugin
        } catch (failed: InvocationTargetException) {
            throw ExtensionLoadException("entry class $entryName threw while constructing: ${describe(failed)}", failed)
        }
    }

    /** Runs the extension's own registration on a dispatcher of ours, so anything it starts there
     * belongs to this loader's scope and dies with it. */
    private fun register(plugin: BasePlugin) = runBlocking(scope.coroutineContext) {
        if (plugin is Plugin) plugin.load(PlatformHost.applicationContext) else plugin.load()
    }

    /** Fallback for a file that does not name its entry class: the annotation is the other way the
     * entry point is declared. */
    private fun findEntry(jar: File, classLoader: ClassLoader): String? {
        val names = ZipFile(jar).use { zip ->
            zip.entries().asSequence()
                .map { it.name }
                .filter { it.endsWith(".class") && !it.contains('$') }
                .map { it.removeSuffix(".class").replace('/', '.') }
                .toList()
        }
        return names.firstOrNull { name ->
            runCatching {
                classLoader.loadClass(name).isAnnotationPresent(CloudstreamPlugin::class.java)
            }.getOrDefault(false)
        }
    }

    override fun close() {
        scope.cancel()
    }

    private companion object {
        fun defaultCacheDir(file: File): File =
            File(file.absoluteFile.parentFile ?: File("."), ".capstan-cache")
    }
}
