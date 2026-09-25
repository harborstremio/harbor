package com.harbor.capstan

import java.io.File
import java.net.URL
import java.net.URLClassLoader
import java.util.Collections
import java.util.Enumeration

private fun isSharedResource(path: String): Boolean =
    isSharedClass(path.trimStart('/').replace('/', '.'))

private fun <T> Enumeration<T>.collect(): List<T> {
    val out = ArrayList<T>()
    while (hasMoreElements()) out.add(nextElement())
    return out
}

/** Stands between an extension and the host: it hands out the compat layer and the dependency
 * jars by delegating to the loader that already defined them, and answers everything else with a
 * ClassNotFoundException.
 *
 * Delegation rather than a second copy is the point. A class handed back here is the very class
 * the host holds, so a provider the extension registers is a provider the host can call. */
class CompatParentLoader(private val compat: ClassLoader) : ClassLoader(getPlatformClassLoader()) {

    override fun loadClass(name: String, resolve: Boolean): Class<*> {
        synchronized(getClassLoadingLock(name)) {
            findLoadedClass(name)?.let {
                if (resolve) resolveClass(it)
                return it
            }
            try {
                return super.loadClass(name, resolve)
            } catch (notOnPlatform: ClassNotFoundException) {
                if (!isSharedClass(name)) throw notOnPlatform
            }
            val loaded = compat.loadClass(name)
            if (resolve) resolveClass(loaded)
            return loaded
        }
    }

    override fun getResource(name: String): URL? =
        super.getResource(name) ?: if (isSharedResource(name)) compat.getResource(name) else null

    override fun getResources(name: String): Enumeration<URL> =
        if (isSharedResource(name)) compat.getResources(name) else super.getResources(name)

    companion object {
        init {
            registerAsParallelCapable()
        }

        fun standard(): CompatParentLoader =
            CompatParentLoader(CompatParentLoader::class.java.classLoader)
    }
}

/** Child first loader over one converted extension jar.
 *
 * The shared prefixes are the exception to child first and go to the parent even when the jar
 * carries a class of that name, because two copies of a compat type are two unrelated types at
 * runtime and every call between host and extension across them would fail. */
class ExtensionClassLoader(
    jar: File,
    private val compat: CompatParentLoader,
) : URLClassLoader(arrayOf(jar.toURI().toURL()), compat) {

    override fun loadClass(name: String, resolve: Boolean): Class<*> {
        synchronized(getClassLoadingLock(name)) {
            findLoadedClass(name)?.let {
                if (resolve) resolveClass(it)
                return it
            }
            val loaded = if (isSharedClass(name)) compat.loadClass(name) else own(name) ?: compat.loadClass(name)
            if (resolve) resolveClass(loaded)
            return loaded
        }
    }

    private fun own(name: String): Class<*>? = try {
        findClass(name)
    } catch (absent: ClassNotFoundException) {
        null
    }

    override fun getResource(name: String): URL? = findResource(name) ?: compat.getResource(name)

    override fun getResources(name: String): Enumeration<URL> =
        Collections.enumeration(findResources(name).collect() + compat.getResources(name).collect())

    companion object {
        init {
            registerAsParallelCapable()
        }
    }
}
