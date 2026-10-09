package com.harbor.capstan.bridge

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.Provider
import harbor.compat.host.HostLink
import harbor.compat.host.LogSink
import harbor.compat.host.PlatformHost
import java.io.BufferedReader
import java.io.File
import java.io.FileDescriptor
import java.io.FileOutputStream
import java.io.InputStream
import java.io.InputStreamReader
import java.io.PrintStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlin.system.exitProcess

private const val CALL_CEILING_MS = 120_000L

private const val DEFAULT_TIMEOUT_MS = CALL_CEILING_MS + 10_000L

class BridgeServer(
    private val output: BridgeOutput,
    private val catalog: BridgeCatalog,
    private val hostRequests: BridgeHostRequests? = null,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun serve(input: InputStream) {
        val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))
        try {
            while (true) {
                val line = reader.readLine() ?: return
                if (line.isBlank()) continue
                val frame = BridgeRequest.frameOf(line)
                if (frame != null && hostRequests != null && BridgeHostRequests.isAnswer(frame)) {
                    hostRequests.answer(frame)
                    continue
                }
                val request = try {
                    if (frame == null) throw BridgeError(CODE_BAD_REQUEST, "line is not JSON")
                    BridgeRequest.parse(frame)
                } catch (failure: BridgeError) {
                    output.fail("", failure.code, failure.message ?: failure.code)
                    continue
                }
                scope.launch { answer(request) }
            }
        } finally {
            hostRequests?.close()
        }
    }

    private suspend fun answer(request: BridgeRequest) {
        try {
            val timeout = request.long("timeoutMs", DEFAULT_TIMEOUT_MS).coerceIn(1_000L, 600_000L)
            val result = withTimeout(timeout) { dispatch(request) }
            output.ok(request.id, result)
        } catch (failure: Throwable) {
            val (code, message) = describeFailure(failure)
            PlatformHost.log(6, "bridge", "${request.method} failed: $message", failure)
            output.fail(request.id, code, message)
        }
    }

    private fun dispatch(request: BridgeRequest): JsonObject = when (request.method) {
        "ping" -> ping()
        "install" -> catalog.install(request.string("path"))
        "uninstall" -> catalog.uninstall(request.string("id"))
        "extensions" -> extensions()
        "providers" -> providers()
        "catalogue" -> catalogue(request)
        "cataloguePage" -> cataloguePage(request)
        "search" -> search(request)
        "load" -> load(request)
        "loadLinks" -> loadLinks(request)
        "shutdown" -> shutdown()
        else -> throw BridgeError(CODE_UNKNOWN_METHOD, "no method '${request.method}'")
    }

    private fun ping(): JsonObject {
        val out = JsonObject()
        out.addProperty("pong", true)
        out.addProperty("protocol", PROTOCOL_VERSION)
        out.addProperty("extensions", catalog.extensionList().size)
        out.addProperty("providers", catalog.providerList().size)
        return out
    }

    private fun extensions(): JsonObject {
        val list = JsonArray()
        for (entry in catalog.extensionList()) list.add(BridgeEncode.extension(entry))
        val out = JsonObject()
        out.add("extensions", list)
        return out
    }

    private fun providers(): JsonObject {
        val list = JsonArray()
        for (entry in catalog.providerList()) list.add(BridgeEncode.provider(entry))
        val out = JsonObject()
        out.add("providers", list)
        return out
    }

    private fun catalogue(request: BridgeRequest): JsonObject {
        val entry = catalog.provider(request.string("providerId"))
        val rows = JsonArray()
        for (row in entry.provider.catalogue) rows.add(BridgeEncode.catalogueRow(row))
        val out = JsonObject()
        out.addProperty("providerId", entry.id)
        out.addProperty("hasMainPage", entry.provider.info.hasMainPage)
        out.add("rows", rows)
        return out
    }

    private fun cataloguePage(request: BridgeRequest): JsonObject {
        val entry = catalog.provider(request.string("providerId"))
        val asked = request.string("row")
        val row = entry.provider.rowNamed(asked)
            ?: throw BridgeError(CODE_BAD_REQUEST, "no catalogue row '$asked' on ${entry.id}")
        val page = request.int("page", 1).coerceAtLeast(1)
        val since = System.currentTimeMillis()
        val fetched = entry.provider.cataloguePage(row.name, page)
        val sections = JsonArray()
        for (section in fetched.sections) sections.add(BridgeEncode.catalogueSection(section))
        val out = JsonObject()
        out.addProperty("providerId", entry.id)
        out.addProperty("row", row.name)
        out.addProperty("page", page)
        out.addProperty("hasNext", fetched.hasNext)
        out.add("sections", sections)
        if (fetched.items == 0) note(out, entry.provider, since)
        return out
    }

    private fun search(request: BridgeRequest): JsonObject {
        val entry = catalog.provider(request.string("providerId"))
        val query = request.string("query")
        val page = request.int("page", 1).coerceAtLeast(1)
        val since = System.currentTimeMillis()
        val items = if (request.bool("quick", false)) {
            entry.provider.quickSearch(query)
        } else {
            entry.provider.search(query, page)
        }
        val results = JsonArray()
        for (item in items) results.add(BridgeEncode.searchItem(item))
        val out = JsonObject()
        out.addProperty("providerId", entry.id)
        out.addProperty("page", page)
        out.add("results", results)
        if (items.isEmpty()) note(out, entry.provider, since)
        return out
    }

    private fun load(request: BridgeRequest): JsonObject {
        val entry = catalog.provider(request.string("providerId"))
        val since = System.currentTimeMillis()
        val media = entry.provider.load(request.string("url"))
        val out = JsonObject()
        out.addProperty("providerId", entry.id)
        out.addProperty("found", media != null)
        if (media != null) out.add("result", BridgeEncode.mediaItem(media))
        else note(out, entry.provider, since)
        return out
    }

    private fun loadLinks(request: BridgeRequest): JsonObject {
        val entry = catalog.provider(request.string("providerId"))
        val since = System.currentTimeMillis()
        val found = entry.provider.loadLinks(request.string("data"), request.bool("isCasting", false))
        val links = JsonArray()
        for (link in found.links) links.add(BridgeEncode.streamLink(link))
        val subtitles = JsonArray()
        for (item in found.subtitles) subtitles.add(BridgeEncode.subtitle(item))
        val out = JsonObject()
        out.addProperty("providerId", entry.id)
        out.addProperty("success", found.handled)
        out.add("links", links)
        out.add("subtitles", subtitles)
        if (found.links.isEmpty()) note(out, entry.provider, since)
        return out
    }

    private fun note(out: JsonObject, provider: Provider, since: Long) {
        val text = provider.why(since) ?: return
        out.addProperty("note", text)
    }

    private fun shutdown(): JsonObject {
        Thread {
            Thread.sleep(50)
            exitProcess(0)
        }.also { it.isDaemon = false }.start()
        val out = JsonObject()
        out.addProperty("stopping", true)
        return out
    }
}

object Bridge {

    @JvmStatic
    fun main(arguments: Array<String>) {
        val protocol = PrintStream(FileOutputStream(FileDescriptor.out), false, Charsets.UTF_8.name())
        System.setOut(PrintStream(FileOutputStream(FileDescriptor.err), true, Charsets.UTF_8.name()))
        PlatformHost.logSink = LogSink { priority, tag, message, error ->
            System.err.println("${priorityLabel(priority)}/$tag: $message")
            error?.printStackTrace(System.err)
        }

        dataDirOf(arguments)?.let { PlatformHost.dataDir = it }
        val root = File(PlatformHost.dataDir, "extensions")
        val loader = ExtensionLoader(LoaderConfig(cacheDir = File(root, "cache"), callTimeoutMs = CALL_CEILING_MS))
        val catalog = BridgeCatalog(root, loader)
        for (warning in catalog.restore()) System.err.println("W/bridge: restore skipped $warning")

        val output = BridgeOutput(protocol)
        val hostRequests = BridgeHostRequests(output)
        HostLink.channel = hostRequests
        BridgeServer(output, catalog, hostRequests).serve(System.`in`)
    }

    private fun dataDirOf(arguments: Array<String>): File? {
        val index = arguments.indexOf("--data-dir")
        if (index < 0 || index + 1 >= arguments.size) return null
        return File(arguments[index + 1])
    }

    private fun priorityLabel(priority: Int): String = when (priority) {
        2 -> "V"
        3 -> "D"
        4 -> "I"
        5 -> "W"
        6 -> "E"
        7 -> "A"
        else -> "?"
    }
}
