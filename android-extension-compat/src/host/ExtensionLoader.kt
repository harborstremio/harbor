package com.harbor.capstan

import com.lagradost.cloudstream3.MainActivity
import com.lagradost.cloudstream3.plugins.BasePlugin
import com.lagradost.cloudstream3.plugins.CloudstreamPlugin
import com.lagradost.cloudstream3.plugins.Plugin
import com.lagradost.cloudstream3.plugins.PluginManager
import com.lagradost.cloudstream3.utils.registerExtractor
import harbor.compat.host.AndroidKeyStoreProvider
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
    val cacheDir: File? = null,
    val dexToolsDir: File = DexConverter.defaultToolsDir(),
    val callTimeoutMs: Long = 120_000,
)

class ExtensionLoader(private val config: LoaderConfig = LoaderConfig()) : AutoCloseable {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + CoroutineName("capstan-extension"))

    private val edge = SuspendEdge(scope, config.callTimeoutMs)

    private val converter = DexConverter(config.dexToolsDir)

    private val compat = CompatParentLoader.standard()

    init {
        ServiceLedger.install()
        AndroidKeyStoreProvider.install()
    }

    @JvmOverloads
    fun load(file: File, watch: LoadWatch = LoadWatch.NONE): LoadedExtension {
        startNewPipe()
        val archive = ExtensionArchive.read(file)
        watch.reached(LoadStage.ARCHIVE, "${archive.dexUnits.size} dex unit(s), manifest v${archive.manifest.version}")
        val jar = converter.jarFor(archive, config.cacheDir ?: defaultCacheDir(file))
        val unavailable = converter.unconverted(jar)
        watch.reached(
            LoadStage.CONVERT,
            "${jar.name}, ${jar.length()} bytes" +
                if (unavailable.isEmpty()) "" else ", ${unavailable.size} method(s) unavailable: " +
                    unavailable.joinToString(", ") { it.display },
        )
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
            PluginManager.attach(file, plugin)
            plugin.extractorApis.forEach(::registerExtractor)
            MainActivity.afterPluginsLoadedEvent(true)
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
                unavailable = unavailable,
            )
        } catch (t: Throwable) {
            runCatching { classLoader.close() }
            throw if (t is ExtensionLoadException) t
            else ExtensionLoadException("${file.name} failed to load: ${describe(t)}", t)
        }
    }

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

    private fun register(plugin: BasePlugin) = runBlocking(scope.coroutineContext) {
        if (plugin is Plugin) plugin.load(PlatformHost.applicationContext) else plugin.load()
    }

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
