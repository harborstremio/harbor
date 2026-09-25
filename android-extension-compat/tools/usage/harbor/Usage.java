package harbor;

import com.google.gson.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import org.objectweb.asm.*;

/** Records HOW each contract member is referenced, read from the extensions' own bytecode.
 *
 * Existence is not enough. A call site compiled as invokestatic against an instance method
 * resolves fine under reflection and then throws IncompatibleClassChangeError the first time it
 * runs, so the invoke kind is part of the contract. The same holds for interface versus class
 * owners, for static versus instance fields, and for any type the extensions extend, which
 * cannot be final no matter how well its members match. */
public final class Usage {
  static final String[] OURS = {"com/lagradost/", "android/", "androidx/"};

  final Map<String, Set<String>> invoke = new TreeMap<>();
  final Map<String, Set<String>> access = new TreeMap<>();
  final Map<String, Set<String>> typeFacts = new TreeMap<>();
  final Set<String> keys;
  final List<String> conflicts = new ArrayList<>();

  Usage(Set<String> keys) {
    this.keys = keys;
  }

  static boolean ours(String internal) {
    for (String p : OURS) {
      if (internal.startsWith(p)) return true;
    }
    return false;
  }

  void addType(String internal, String fact) {
    if (internal == null || internal.startsWith("[") || !ours(internal)) return;
    String key = "class|" + internal.replace('/', '.') + "||";
    if (!keys.contains(key)) return;
    typeFacts.computeIfAbsent(key, k -> new TreeSet<>()).add(fact);
  }

  void addMethod(String owner, String name, String desc, String kind, boolean itf) {
    if (owner.startsWith("[") || !ours(owner)) return;
    String key = "method|" + owner.replace('/', '.') + "|" + name + "|" + desc;
    if (!keys.contains(key)) return;
    Set<String> kinds = invoke.computeIfAbsent(key, k -> new TreeSet<>());
    kinds.add(kind);
    if (itf || kind.equals("interface")) {
      kinds.add("itf");
      addType(owner, "interface");
    }
  }

  void addField(String owner, String name, String desc, String kind) {
    if (owner.startsWith("[") || !ours(owner)) return;
    String key = "field|" + owner.replace('/', '.') + "|" + name + "|" + desc;
    if (!keys.contains(key)) return;
    access.computeIfAbsent(key, k -> new TreeSet<>()).add(kind);
  }

  void handle(Handle h) {
    switch (h.getTag()) {
      case Opcodes.H_INVOKESTATIC -> addMethod(h.getOwner(), h.getName(), h.getDesc(), "static", h.isInterface());
      case Opcodes.H_INVOKEVIRTUAL -> addMethod(h.getOwner(), h.getName(), h.getDesc(), "virtual", false);
      case Opcodes.H_INVOKEINTERFACE -> addMethod(h.getOwner(), h.getName(), h.getDesc(), "interface", true);
      case Opcodes.H_INVOKESPECIAL, Opcodes.H_NEWINVOKESPECIAL ->
          addMethod(h.getOwner(), h.getName(), h.getDesc(), "special", h.isInterface());
      case Opcodes.H_GETSTATIC -> addField(h.getOwner(), h.getName(), h.getDesc(), "get-static");
      case Opcodes.H_PUTSTATIC -> addField(h.getOwner(), h.getName(), h.getDesc(), "put-static");
      case Opcodes.H_GETFIELD -> addField(h.getOwner(), h.getName(), h.getDesc(), "get-instance");
      case Opcodes.H_PUTFIELD -> addField(h.getOwner(), h.getName(), h.getDesc(), "put-instance");
      default -> { }
    }
  }

  void scan(byte[] bytes) {
    new ClassReader(bytes).accept(new ClassVisitor(Opcodes.ASM9) {
      @Override
      public void visit(int v, int acc, String name, String sig, String sup, String[] itfs) {
        addType(sup, "extended");
        if (itfs != null) {
          for (String i : itfs) addType(i, "implemented");
        }
      }

      @Override
      public MethodVisitor visitMethod(int acc, String mn, String md, String sig, String[] ex) {
        return new MethodVisitor(Opcodes.ASM9) {
          @Override
          public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
            String kind = switch (op) {
              case Opcodes.INVOKESTATIC -> "static";
              case Opcodes.INVOKEINTERFACE -> "interface";
              case Opcodes.INVOKESPECIAL -> "special";
              default -> "virtual";
            };
            addMethod(owner, name, desc, kind, itf);
          }

          @Override
          public void visitFieldInsn(int op, String owner, String name, String desc) {
            String kind = switch (op) {
              case Opcodes.GETSTATIC -> "get-static";
              case Opcodes.PUTSTATIC -> "put-static";
              case Opcodes.GETFIELD -> "get-instance";
              default -> "put-instance";
            };
            addField(owner, name, desc, kind);
          }

          @Override
          public void visitTypeInsn(int op, String type) {
            if (op == Opcodes.NEW) addType(type, "instantiated");
          }

          @Override
          public void visitInvokeDynamicInsn(String n, String d, Handle bsm, Object... args) {
            handle(bsm);
            for (Object a : args) {
              if (a instanceof Handle h) handle(h);
            }
          }
        };
      }
    }, ClassReader.SKIP_FRAMES);
  }

  void checkConflicts() {
    invoke.forEach((key, k) -> {
      if (k.contains("static") && (k.contains("virtual") || k.contains("interface") || k.contains("special"))) {
        conflicts.add("invoke " + key + " " + k);
      }
    });
    access.forEach((key, k) -> {
      boolean st = k.contains("get-static") || k.contains("put-static");
      boolean inst = k.contains("get-instance") || k.contains("put-instance");
      if (st && inst) conflicts.add("field " + key + " " + k);
    });
    typeFacts.forEach((key, k) -> {
      if (k.contains("implemented") && (k.contains("extended") || k.contains("instantiated"))) {
        conflicts.add("type " + key + " " + k);
      }
    });
  }

  static JsonArray arr(Collection<String> c) {
    JsonArray a = new JsonArray();
    for (String s : c) a.add(s);
    return a;
  }

  public static void main(String[] argv) throws Exception {
    Path root = Paths.get(argv[0]);
    JsonObject spec = JsonParser.parseReader(
        Files.newBufferedReader(root.resolve("spec/required.json"))).getAsJsonObject();
    Usage u = new Usage(new HashSet<>(spec.getAsJsonObject("required").keySet()));
    int classes = 0, jars = 0;
    File[] fs = root.resolve("samples/jars").toFile().listFiles();
    Arrays.sort(fs);
    for (File f : fs) {
      if (!f.getName().endsWith(".jar")) continue;
      jars++;
      try (ZipFile z = new ZipFile(f)) {
        for (Enumeration<? extends ZipEntry> en = z.entries(); en.hasMoreElements(); ) {
          ZipEntry e = en.nextElement();
          if (!e.getName().endsWith(".class")) continue;
          try (InputStream in = z.getInputStream(e)) {
            u.scan(in.readAllBytes());
          }
          classes++;
        }
      }
    }
    u.checkConflicts();
    JsonObject out = new JsonObject();
    out.addProperty("jars", jars);
    out.addProperty("classes", classes);
    JsonObject inv = new JsonObject();
    u.invoke.forEach((k, v) -> inv.add(k, arr(v)));
    JsonObject acc = new JsonObject();
    u.access.forEach((k, v) -> acc.add(k, arr(v)));
    JsonObject typ = new JsonObject();
    u.typeFacts.forEach((k, v) -> typ.add(k, arr(v)));
    out.add("invoke", inv);
    out.add("access", acc);
    out.add("types", typ);
    out.add("conflicts", arr(u.conflicts));
    Files.createDirectories(root.resolve("out"));
    try (Writer w = Files.newBufferedWriter(root.resolve("out/usage.json"))) {
      new GsonBuilder().setPrettyPrinting().create().toJson(out, w);
    }
    System.out.printf("USAGE %d jars %d classes, methods %d, fields %d, types %d, conflicts %d%n",
        jars, classes, u.invoke.size(), u.access.size(), u.typeFacts.size(), u.conflicts.size());
  }
}
