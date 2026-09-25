package com.harbor.capstan.bridge

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoadedExtension
import com.harbor.capstan.Provider
import com.harbor.capstan.providerSlug
import java.io.File

class ExtensionEntry(
    val id: String,
    val source: String,
    val loaded: LoadedExtension,
    val providerIds: List<String>,
)

class ProviderEntry(
    val id: String,
    val extensionId: String,
    val provider: Provider,
)

/** What is installed and what it contributed.
 *
 * An install copies the extension file into the bridge's own directory, so a later run does not
 * depend on wherever the user happened to pick the file from, and a manifest records enough to
 * bring the same set back on the next start. */
class BridgeCatalog(private val root: File, private val loader: ExtensionLoader) {

    private val extensions = LinkedHashMap<String, ExtensionEntry>()

    private val providers = LinkedHashMap<String, ProviderEntry>()

    private val lock = Any()

    private val filesDir: File get() = File(root, "files")

    private val manifest: File get() = File(root, "installed.json")

    fun restore(): List<String> {
        val warnings = ArrayList<String>()
        for (record in readManifest()) {
            val file = File(record.second)
            if (!file.isFile) {
                warnings.add("${record.first}: file is gone at ${record.second}")
                continue
            }
            val opened = runCatching { loader.load(file) }
            val loaded = opened.getOrNull()
            if (loaded == null) {
                warnings.add("${record.first}: ${describeFailure(opened.exceptionOrNull()!!).second}")
                continue
            }
            synchronized(lock) { adopt(record.first, record.second, loaded) }
        }
        return warnings
    }

    fun install(path: String): JsonObject {
        val source = File(path)
        if (!source.isFile) throw BridgeError(CODE_INSTALL_FAILED, "no file at $path")
        val id = providerSlug(source.nameWithoutExtension).ifEmpty { providerSlug(source.name) }
        if (id.isEmpty()) throw BridgeError(CODE_INSTALL_FAILED, "cannot derive an id from ${source.name}")
        filesDir.mkdirs()
        val target = File(filesDir, "$id.${source.extension.ifEmpty { "cs3" }}")
        val sameFile = runCatching { source.canonicalFile == target.canonicalFile }.getOrDefault(false)
        if (!sameFile) {
            synchronized(lock) { extensions[id] }?.let { release(it) }
            runCatching { source.copyTo(target, overwrite = true) }
                .getOrElse { throw BridgeError(CODE_INSTALL_FAILED, "cannot copy into ${target.path}: ${it.message}") }
        }
        val loaded = try {
            loader.load(target)
        } catch (failure: Throwable) {
            if (!sameFile) target.delete()
            throw failure
        }
        return synchronized(lock) {
            val entry = adopt(id, source.path, loaded)
            writeManifest()
            BridgeEncode.extension(entry)
        }
    }

    fun uninstall(id: String): JsonObject {
        val entry = synchronized(lock) {
            val found = extensions.remove(id) ?: throw BridgeError(CODE_EXTENSION_NOT_FOUND, "nothing installed as '$id'")
            for (providerId in found.providerIds) providers.remove(providerId)
            writeManifest()
            found
        }
        release(entry)
        val removed = entry.loaded.file.delete()
        if (!removed) entry.loaded.file.deleteOnExit()
        val out = JsonObject()
        out.addProperty("id", id)
        out.addProperty("fileRemoved", removed)
        return out
    }

    fun providerList(): List<ProviderEntry> = synchronized(lock) { providers.values.toList() }

    fun extensionList(): List<ExtensionEntry> = synchronized(lock) { extensions.values.toList() }

    fun provider(id: String): ProviderEntry = synchronized(lock) {
        providers[id] ?: throw BridgeError(CODE_PROVIDER_NOT_FOUND, "no provider '$id'")
    }

    /** Takes ownership of a freshly loaded file, replacing whatever was installed under the same
     * id. The caller holds the lock. */
    private fun adopt(id: String, source: String, loaded: LoadedExtension): ExtensionEntry {
        extensions.remove(id)?.let { previous ->
            for (providerId in previous.providerIds) providers.remove(providerId)
            release(previous)
        }
        val ids = ArrayList<String>()
        for (provider in loaded.providers) {
            val base = "$id/${providerSlug(provider.name).ifEmpty { "provider" }}"
            var candidate = base
            var counter = 2
            while (providers.containsKey(candidate)) {
                candidate = "$base-$counter"
                counter++
            }
            providers[candidate] = ProviderEntry(candidate, id, provider)
            ids.add(candidate)
        }
        val entry = ExtensionEntry(id, source, loaded, ids)
        extensions[id] = entry
        return entry
    }

    private fun release(entry: ExtensionEntry) {
        runCatching { entry.loaded.close() }
    }

    private fun readManifest(): List<Pair<String, String>> {
        if (!manifest.isFile) return emptyList()
        val parsed = runCatching { JsonParser.parseString(manifest.readText()) }.getOrNull() ?: return emptyList()
        if (!parsed.isJsonObject) return emptyList()
        val list = parsed.asJsonObject.getAsJsonArray("extensions") ?: return emptyList()
        val out = ArrayList<Pair<String, String>>()
        for (element in list) {
            if (!element.isJsonObject) continue
            val record = element.asJsonObject
            val id = record.get("id")?.asString ?: continue
            val file = record.get("file")?.asString ?: continue
            out.add(id to file)
        }
        return out
    }

    private fun writeManifest() {
        val list = JsonArray()
        for (entry in extensions.values) {
            val record = JsonObject()
            record.addProperty("id", entry.id)
            record.addProperty("file", entry.loaded.file.path)
            record.addProperty("source", entry.source)
            list.add(record)
        }
        val document = JsonObject()
        document.add("extensions", list)
        runCatching {
            manifest.parentFile?.mkdirs()
            manifest.writeText(document.toString())
        }
    }

}
