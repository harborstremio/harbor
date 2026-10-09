package probe;

class GoodStatic {
  public static void m() { }
}

class BadStatic {
  public void m() { }
}

class GoodVirtual {
  public void m() { }
}

class BadVirtual {
  public static void m() { }
}

interface GoodItf {
  void m();
}

class BadItf {
  public void m() { }
}

interface GoodImplemented { }

class BadImplemented { }

class GoodExtended { }

final class BadExtended { }

class GoodNew { }

abstract class BadNew { }

class GoodStaticField {
  public static int f;
}

class BadStaticField {
  public int f;
}

class GoodPutField {
  public int f;
}

class BadPutField {
  public final int f = 1;
}

class GoodSuper {
  public void m() { }
}

abstract class BadSuper {
  public abstract void m();
}

class Present { }
