package kotlin.coroutines.jvm.internal;

// The Android build toolchain synthesises this into the app, and Kotlin refuses this package.
public final class SpillingKt {

    private SpillingKt() {
    }

    public static Object nullOutSpilledVariable(Object value) {
        return null;
    }
}
