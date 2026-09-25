package harbor;

import com.google.gson.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;

/** Checks the compat layer against the contract measured from real extension bytecode.
 *
 * Every entry in spec/required.json is a class, method or field that at least one extension
 * references. Resolving it here with reflection is the same resolution the virtual machine
 * performs at the invoke site, so a member that passes here cannot raise NoSuchMethodError
 * there. The report is per member, because a single missing one is a dead code path.
 *
 * Resolution alone is not the whole contract. Each entry also carries the shape the call sites
 * were compiled against: invokestatic against an instance method, or a class where the extension
 * expects an interface, links and then throws IncompatibleClassChangeError the first time that
 * line runs. A member of the wrong shape is counted unresolved, because at runtime it is. */
public final class Contract {
  static String desc(Class<?> c) {
    if (c == void.class) return "V";
    if (c == boolean.class) return "Z";
    if (c == byte.class) return "B";
    if (c == char.class) return "C";
    if (c == short.class) return "S";
    if (c == int.class) return "I";
    if (c == long.class) return "J";
    if (c == float.class) return "F";
    if (c == double.class) return "D";
    if (c.isArray()) return "[" + desc(c.getComponentType());
    return "L" + c.getName().replace('.', '/') + ";";
  }

  static String sig(Class<?>[] ps, Class<?> ret) {
    StringBuilder b = new StringBuilder("(");
    for (Class<?> p : ps) b.append(desc(p));
    return b.append(')').append(desc(ret)).toString();
  }

  static Executable findMethod(Class<?> c, String name, String want) {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      if (name.equals("<init>")) {
        for (Constructor<?> m : k.getDeclaredConstructors())
          if (sig(m.getParameterTypes(), void.class).equals(want)) return m;
        break;
      }
      for (Method m : k.getDeclaredMethods())
        if (m.getName().equals(name) && sig(m.getParameterTypes(), m.getReturnType()).equals(want)) return m;
      for (Class<?> i : k.getInterfaces()) {
        Executable m = findMethod(i, name, want);
        if (m != null) return m;
      }
    }
    return null;
  }

  static Field findField(Class<?> c, String name, String want) {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      for (Field f : k.getDeclaredFields())
        if (f.getName().equals(name) && desc(f.getType()).equals(want)) return f;
      for (Class<?> i : k.getInterfaces()) {
        Field f = findField(i, name, want);
        if (f != null) return f;
      }
    }
    return null;
  }

  static Set<String> strings(JsonObject rec, String field) {
    Set<String> out = new LinkedHashSet<>();
    if (rec == null || !rec.has(field)) return out;
    for (JsonElement e : rec.getAsJsonArray(field)) out.add(e.getAsString());
    return out;
  }

  static boolean flag(JsonObject rec, String field) {
    return rec != null && rec.has(field) && rec.get(field).getAsBoolean();
  }

  /** The shape the bytecode demands, or null when this member is used as the compat layer offers it. */
  static String shapeFault(String kind, Class<?> c, String name, Member found, JsonObject rec) {
    if (kind.equals("class")) {
      if (flag(rec, "implemented") && !c.isInterface()) return "extensions implement it, must be an interface";
      if (flag(rec, "extended")) {
        if (c.isInterface()) return "extensions extend it, must be a class";
        if (Modifier.isFinal(c.getModifiers())) return "extensions extend it, must be open";
      }
      if (flag(rec, "instantiated") && Modifier.isAbstract(c.getModifiers()))
        return "extensions construct it, must be concrete";
      if (flag(rec, "interface") && !c.isInterface()) return "called through invokeinterface, must be an interface";
      return null;
    }
    if (kind.equals("method")) {
      Member m = found;
      Set<String> invoke = strings(rec, "invoke");
      boolean isStatic = Modifier.isStatic(m.getModifiers());
      if (invoke.contains("static") && !isStatic) return "called with invokestatic, must be static";
      if (!invoke.contains("static") && !invoke.isEmpty() && isStatic) return "called on an instance, must not be static";
      if (flag(rec, "itf") && !c.isInterface()) return "called through invokeinterface, owner must be an interface";
      if (invoke.contains("special") && !name.equals("<init>") && Modifier.isAbstract(m.getModifiers()))
        return "reached by a super call, must have a body";
      return null;
    }
    Member f = found;
    Set<String> access = strings(rec, "access");
    boolean isStatic = Modifier.isStatic(f.getModifiers());
    boolean wantStatic = access.contains("get-static") || access.contains("put-static");
    boolean wantInstance = access.contains("get-instance") || access.contains("put-instance");
    if (wantStatic && !isStatic) return "read with getstatic, must be static";
    if (wantInstance && isStatic) return "read off an instance, must not be static";
    if ((access.contains("put-static") || access.contains("put-instance")) && Modifier.isFinal(f.getModifiers()))
      return "extensions assign it, must be mutable";
    return null;
  }

  public static void main(String[] a) throws Exception {
    Path root = Paths.get(a[0]);
    JsonObject spec = JsonParser.parseReader(
        Files.newBufferedReader(root.resolve("spec/required.json"))).getAsJsonObject();
    List<URL> cp = new ArrayList<>();
    for (String d : new String[] {"out", "libs"}) {
      File dir = root.resolve(d).toFile();
      File[] fs = dir.listFiles();
      if (fs == null) continue;
      for (File f : fs) if (f.getName().endsWith(".jar")) cp.add(f.toURI().toURL());
    }
    URLClassLoader cl = new URLClassLoader(cp.toArray(new URL[0]), Contract.class.getClassLoader());
    JsonObject req = spec.getAsJsonObject("required");
    List<String> missing = new ArrayList<>();
    List<String> wrongShape = new ArrayList<>();
    int ok = 0;
    for (String key : req.keySet()) {
      String[] p = key.split("[|]", -1);
      JsonElement raw = req.get(key);
      JsonObject rec = raw.isJsonObject() ? raw.getAsJsonObject() : new JsonObject();
      String fault = null;
      boolean found = false;
      try {
        Class<?> c = Class.forName(p[1], false, cl);
        Member m = p[0].equals("class") ? null
            : p[0].equals("method") ? findMethod(c, p[2], p[3]) : findField(c, p[2], p[3]);
        found = p[0].equals("class") || m != null;
        if (found) fault = shapeFault(p[0], c, p[2], m, rec);
      } catch (Throwable t) {
        found = false;
      }
      if (found && fault == null) {
        ok++;
      } else {
        missing.add(key);
        if (fault != null) wrongShape.add(key + "  " + fault);
      }
    }
    Collections.sort(missing);
    Collections.sort(wrongShape);
    try (PrintWriter w = new PrintWriter(Files.newBufferedWriter(root.resolve("out/missing.txt")))) {
      for (String m : missing) w.println(m);
    }
    try (PrintWriter w = new PrintWriter(Files.newBufferedWriter(root.resolve("out/shape.txt")))) {
      for (String m : wrongShape) w.println(m);
    }
    System.out.printf("CONTRACT %d/%d resolved, %d missing, %d present but wrong shape%n",
        ok, req.size(), missing.size(), wrongShape.size());
    Map<String, Integer> byClass = new TreeMap<>();
    for (String m : missing) byClass.merge(m.split("[|]")[1], 1, Integer::sum);
    byClass.entrySet().stream()
        .sorted((x, y) -> y.getValue() - x.getValue()).limit(25)
        .forEach(e -> System.out.printf("  %3d  %s%n", e.getValue(), e.getKey()));
    for (String m : wrongShape.subList(0, Math.min(10, wrongShape.size()))) System.out.println("  SHAPE  " + m);
  }
}
