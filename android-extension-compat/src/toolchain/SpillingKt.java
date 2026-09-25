package kotlin.coroutines.jvm.internal;

/**
 * Twelve of the thirteen sample extensions call this out of every suspend function they compile.
 *
 * <p>It is not part of the standard library. The Android build toolchain synthesises it into the
 * application when it rewrites coroutine state machines, so an extension built that way links
 * against a member that exists only inside the app it was built for, and the compat layer is the
 * only place left to put it.
 *
 * <p>Null is the answer the synthesised version gives. The rewrite only reaches a slot the state
 * machine will not read again, so clearing it is what frees the value for collection, which is the
 * whole reason the call is emitted.
 *
 * <p>Written in Java because the Kotlin compiler refuses to place a source file in this package.
 */
public final class SpillingKt {

    private SpillingKt() {
    }

    public static Object nullOutSpilledVariable(Object value) {
        return null;
    }
}
