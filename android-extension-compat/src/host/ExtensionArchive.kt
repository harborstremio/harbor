package com.harbor.capstan

import com.google.gson.JsonParser
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

class ExtensionFormatException(message: String) : RuntimeException(message)

/** What an extension file declares about itself. */
class ExtensionManifest(
    val name: String,
    val entryClassName: String?,
    val version: Int,
    val requiresResources: Boolean,
)

/** An extension file read off disk: its declaration, its Dalvik units, and an identity for the
 * exact bytes that were read, which is what the converted jar is cached against. */
class OpenArchive(
    val file: File,
    val manifest: ExtensionManifest,
    val dexUnits: List<ByteArray>,
    val fingerprint: String,
)

object ExtensionArchive {

    private const val MANIFEST_ENTRY = "manifest.json"

    fun read(file: File): OpenArchive {
        if (!file.isFile) throw ExtensionFormatException("not a file: $file")
        val fingerprint = fingerprint(file)
        ZipFile(file).use { zip ->
            val manifest = readManifest(zip, file)
            val units = dexEntries(zip).map { entry -> zip.getInputStream(entry).use(InputStream::readBytes) }
            if (units.isEmpty()) throw ExtensionFormatException("${file.name} contains no Dalvik unit")
            return OpenArchive(file, manifest, units, fingerprint)
        }
    }

    private fun readManifest(zip: ZipFile, file: File): ExtensionManifest {
        val entry = zip.getEntry(MANIFEST_ENTRY)
            ?: throw ExtensionFormatException("${file.name} has no $MANIFEST_ENTRY")
        val text = zip.getInputStream(entry).use { it.readBytes().toString(Charsets.UTF_8) }
        val root = runCatching { JsonParser.parseString(text).asJsonObject }.getOrElse {
            throw ExtensionFormatException("${file.name} has an unreadable $MANIFEST_ENTRY")
        }

        fun str(key: String): String? =
            root.get(key)?.takeIf { !it.isJsonNull }?.asString?.takeIf { it.isNotBlank() }

        return ExtensionManifest(
            name = str("name") ?: file.nameWithoutExtension,
            entryClassName = str("pluginClassName"),
            version = root.get("version")?.takeIf { !it.isJsonNull }?.asInt ?: 0,
            requiresResources = root.get("requiresResources")?.takeIf { !it.isJsonNull }?.asBoolean ?: false,
        )
    }

    /** classes.dex leads and the numbered units follow in numeric order. The converter merges them
     * in this order and a later unit may only add to what an earlier one defined. */
    private fun dexEntries(zip: ZipFile): List<ZipEntry> {
        val units = ArrayList<Pair<Int, ZipEntry>>()
        val names = zip.entries()
        while (names.hasMoreElements()) {
            val entry = names.nextElement()
            if (entry.isDirectory) continue
            val index = unitIndex(entry.name) ?: continue
            units.add(index to entry)
        }
        return units.sortedBy { it.first }.map { it.second }
    }

    private fun unitIndex(name: String): Int? {
        if (!name.endsWith(".dex") || name.contains('/')) return null
        val stem = name.removeSuffix(".dex")
        if (stem == "classes") return 1
        val suffix = stem.removePrefix("classes")
        if (suffix.length == stem.length) return null
        return suffix.toIntOrNull()
    }

    fun fingerprint(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(1 shl 16)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }.substring(0, 24)
    }
}
