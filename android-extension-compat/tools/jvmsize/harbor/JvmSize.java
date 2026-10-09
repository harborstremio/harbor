package harbor;

import com.googlecode.d2j.Method;
import com.googlecode.d2j.dex.BaseDexExceptionHandler;
import com.googlecode.d2j.dex.Dex2jar;
import com.googlecode.d2j.node.DexMethodNode;
import com.googlecode.d2j.reader.BaseDexFileReader;
import com.googlecode.d2j.reader.DexFileReader;
import com.googlecode.d2j.reader.MultiDexFileReader;
import org.objectweb.asm.MethodTooLargeException;
import org.objectweb.asm.MethodVisitor;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** How close each extension's largest method sits to the JVM's 65535 byte per method code limit.
 *
 * Dalvik has no such limit, so an archive can carry a method the JVM cannot hold, and the number
 * that decides whether it can is the size of the JVM bytecode the converter produces, not the size
 * of the Dalvik code it started from. So this runs the same conversion production runs, with the
 * same flags, and reads code_length back out of the class files it wrote. The one method the
 * converter could not hold has no class file entry to read, so its size comes from the converter's
 * own report of it.
 *
 * Usage: harbor.JvmSize [--all] archive.cs3 ...
 */
public final class JvmSize {

    public static void main(String[] args) throws Exception {
        boolean all = false;
        List<String> paths = new ArrayList<String>();
        for (String arg : args) {
            if (arg.equals("--all")) all = true;
            else paths.add(arg);
        }
        List<Result> results = new ArrayList<Result>();
        for (String path : paths) {
            File file = new File(path);
            Result r = new Result(file.getName());
            try {
                scan(file, r);
            } catch (Throwable t) {
                r.failure = String.valueOf(t);
            }
            results.add(r);
            if (!all) continue;
        }
        results.sort(new java.util.Comparator<Result>() {
            public int compare(Result a, Result b) { return b.largest - a.largest; }
        });
        System.out.println(pad("archive", 30) + pad("methods", 8) + pad("largest", 9)
                + pad("headroom", 10) + pad("stubbed", 8) + " largest method");
        for (Result r : results) {
            if (r.failure != null) {
                System.out.println(pad(r.archive, 30) + "FAILED " + r.failure);
                continue;
            }
            System.out.println(pad(r.archive, 30) + pad(String.valueOf(r.methods), 8)
                    + pad(String.valueOf(r.largest), 9) + pad(String.valueOf(LIMIT - r.largest), 10)
                    + pad(String.valueOf(r.stubbed.size()), 8) + " " + r.largestName);
        }
        int over = 0, near = 0;
        for (Result r : results) {
            for (String s : r.stubbed) if (s.contains("too large")) over++;
            if (r.largest > LIMIT / 2) near++;
        }
        System.out.println();
        System.out.println("archives " + results.size()
                + ", methods the JVM cannot hold: " + over
                + ", archives whose largest method passes half the limit: " + near);
        for (Result r : results) {
            for (String s : r.stubbed) System.out.println("  " + r.archive + ": " + s);
        }
    }

    static final int LIMIT = 65535;

    static final class Result {
        final String archive;
        int methods;
        int largest;
        String largestName = "";
        final List<String> stubbed = new ArrayList<String>();
        String failure;

        Result(String archive) { this.archive = archive; }
    }

    static void scan(File file, final Result result) throws Exception {
        File jar = File.createTempFile("jvmsize-", ".jar");
        jar.delete();
        Dex2jar.from(reader(file))
                .withExceptionHandler(new BaseDexExceptionHandler() {
                    @Override
                    public void handleMethodTranslateException(Method m, DexMethodNode n, MethodVisitor mv, Exception e) {
                        Throwable c = e;
                        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
                        if (c instanceof MethodTooLargeException) {
                            MethodTooLargeException t = (MethodTooLargeException) c;
                            result.stubbed.add(t.getClassName() + "." + t.getMethodName()
                                    + " too large, " + t.getCodeSize() + " bytes, "
                                    + (t.getCodeSize() - LIMIT) + " over");
                            if (t.getCodeSize() > result.largest) {
                                result.largest = t.getCodeSize();
                                result.largestName = t.getClassName() + "." + t.getMethodName();
                            }
                        } else {
                            result.stubbed.add(String.valueOf(m) + " " + c);
                        }
                        super.handleMethodTranslateException(m, n, mv, e);
                    }
                })
                .topoLogicalSort()
                .skipDebug(false)
                .noCode(false)
                .to(jar.toPath());
        try {
            ZipFile zip = new ZipFile(jar);
            try {
                Enumeration<? extends ZipEntry> entries = zip.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    if (!entry.getName().endsWith(".class")) continue;
                    measure(read(zip.getInputStream(entry)), entry.getName(), result);
                }
            } finally {
                zip.close();
            }
        } finally {
            jar.delete();
        }
    }

    /** Walks one class file and records the largest code_length in it. */
    static void measure(byte[] b, String entry, Result result) {
        int cpCount = u2(b, 8);
        int[] offsets = new int[cpCount];
        int p = 10;
        for (int i = 1; i < cpCount; i++) {
            offsets[i] = p;
            int tag = b[p] & 0xFF;
            switch (tag) {
                case 1: p += 3 + u2(b, p + 1); break;
                case 7: case 8: case 16: case 19: case 20: p += 3; break;
                case 15: p += 4; break;
                case 5: case 6: p += 9; i++; break;
                default: p += 5; break;
            }
        }
        int thisClass = u2(b, p + 2);
        String owner = utf8(b, offsets, u2(b, offsets[thisClass] + 1));
        p += 6;
        p += 2 + 2 * u2(b, p);
        int fields = u2(b, p);
        p += 2;
        for (int i = 0; i < fields; i++) p = skipMember(b, p);
        int methods = u2(b, p);
        p += 2;
        for (int i = 0; i < methods; i++) {
            String name = utf8(b, offsets, u2(b, p + 2));
            int attrs = u2(b, p + 6);
            int q = p + 8;
            boolean hasCode = false;
            for (int k = 0; k < attrs; k++) {
                int len = u4(b, q + 2);
                if (utf8(b, offsets, u2(b, q)).equals("Code")) {
                    hasCode = true;
                    int codeLen = u4(b, q + 6 + 4);
                    if (codeLen > result.largest) {
                        result.largest = codeLen;
                        result.largestName = owner + "." + name;
                    }
                }
                q += 6 + len;
            }
            if (hasCode) result.methods++;
            p = q;
        }
    }

    static String utf8(byte[] b, int[] offsets, int index) {
        int p = offsets[index];
        int len = u2(b, p + 1);
        return new String(b, p + 3, len, java.nio.charset.StandardCharsets.UTF_8);
    }

    static int skipMember(byte[] b, int p) {
        int attrs = u2(b, p + 6);
        int q = p + 8;
        for (int k = 0; k < attrs; k++) q += 6 + u4(b, q + 2);
        return q;
    }

    static int u2(byte[] b, int p) { return ((b[p] & 0xFF) << 8) | (b[p + 1] & 0xFF); }

    static int u4(byte[] b, int p) {
        return ((b[p] & 0xFF) << 24) | ((b[p + 1] & 0xFF) << 16) | ((b[p + 2] & 0xFF) << 8) | (b[p + 3] & 0xFF);
    }

    static byte[] read(InputStream in) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[65536];
        int got;
        while ((got = in.read(chunk)) > 0) buffer.write(chunk, 0, got);
        in.close();
        return buffer.toByteArray();
    }

    static BaseDexFileReader reader(File file) throws Exception {
        List<DexFileReader> units = new ArrayList<DexFileReader>();
        ZipFile zip = new ZipFile(file);
        try {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.getName().endsWith(".dex")) units.add(new DexFileReader(read(zip.getInputStream(entry))));
            }
        } finally {
            zip.close();
        }
        if (units.isEmpty()) throw new IllegalStateException("no dex unit in " + file.getName());
        if (units.size() == 1) return units.get(0);
        return new MultiDexFileReader(units);
    }

    static String pad(String s, int n) {
        StringBuilder b = new StringBuilder(s.length() > n - 1 ? s.substring(0, n - 1) : s);
        while (b.length() < n) b.append(' ');
        return b.toString();
    }

    private JvmSize() {
    }
}
