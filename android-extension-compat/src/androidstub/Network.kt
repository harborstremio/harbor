package android.net

/** A network as an extension sees it.
 *
 * Desktop Harbor has exactly one, and nothing an extension can call here addresses it, so this
 * carries no identity. It exists because callbacks are declared in terms of it, and a missing type
 * fails the whole extension at load rather than the one path that would have used it. */
open class Network
