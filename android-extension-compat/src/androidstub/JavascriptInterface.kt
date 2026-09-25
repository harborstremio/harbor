package android.webkit

/** Runtime retention is required: a bridge object is handed to the view as a plain Object, and the
 * only thing that marks which of its methods are callable from page script is this annotation. */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class JavascriptInterface
