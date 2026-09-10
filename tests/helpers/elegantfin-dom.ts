import { load, type CheerioAPI } from "cheerio";

type Selection = ReturnType<CheerioAPI>;
type Listener = (event: unknown) => void;
type Mutation = { type: "attributes" | "childList"; target: DomElement; attributeName?: string };

// Cheerio provides the real HTML parser and CSS selector engine. The adapter supplies
// the browser mutation/event boundaries used by a generated theme script; layout is
// deliberately left to the browser regression checks.
export function createThemeDom(html: string) {
  const $ = load(html);
  const elements = new WeakMap<object, DomElement>();
  const observers = new Set<Observer>();
  const documentListeners = new Map<string, Set<Listener>>();
  const windowListeners = new Map<string, Set<Listener>>();
  const nativeClicks = new WeakMap<DomElement, () => void>();
  const intervals = new Map<number, () => void>();
  const tasks = new Map<number, () => void>();
  let nextTimer = 1;

  function wrap(selection: Selection): DomElement | null {
    const node = selection.get(0);
    if (!node) return null;
    let element = elements.get(node);
    if (!element) {
      element = new DomElement(selection.first());
      elements.set(node, element);
    }
    return element;
  }

  function notify(mutation: Mutation) {
    for (const observer of observers) observer.receive(mutation);
  }

  class DomElement {
    readonly style: Record<string, string> = {};
    readonly selection: Selection;
    constructor(selection: Selection) {
      this.selection = selection;
    }
    get id() {
      return this.getAttribute("id") ?? "";
    }
    set id(value: string) {
      this.setAttribute("id", value);
    }
    get type() {
      return this.getAttribute("type") ?? "";
    }
    set type(value: string) {
      this.setAttribute("type", value);
    }
    get inert() {
      return this.hasAttribute("inert");
    }
    set inert(value: boolean) {
      if (value) {
        this.setAttribute("inert", "");
        if (this.contains(document.activeElement)) document.activeElement = document.body;
      } else this.removeAttribute("inert");
    }
    get parentElement() {
      return wrap(this.selection.parent());
    }
    get nextElementSibling() {
      return wrap(this.selection.next());
    }
    get firstChild() {
      return wrap(this.selection.children().first());
    }
    get isConnected() {
      return this === document.documentElement || document.documentElement.contains(this);
    }
    get innerHTML() {
      return this.selection.html() ?? "";
    }
    set innerHTML(value: string) {
      this.selection.html(value);
      notify({ type: "childList", target: this });
    }
    get textContent() {
      return this.selection.text();
    }
    set textContent(value: string) {
      this.selection.text(value);
      notify({ type: "childList", target: this });
    }
    get classList() {
      const change = (names: string[], add: boolean) => {
        const old = this.getAttribute("class");
        if (add) this.selection.addClass(names.join(" "));
        else this.selection.removeClass(names.join(" "));
        if (old !== this.getAttribute("class"))
          notify({ type: "attributes", target: this, attributeName: "class" });
      };
      return {
        contains: (name: string) => this.selection.hasClass(name),
        add: (...names: string[]) => change(names, true),
        remove: (...names: string[]) => change(names, false),
        toggle: (name: string, force?: boolean) => {
          const add = force ?? !this.selection.hasClass(name);
          change([name], add);
          return add;
        },
      };
    }
    getAttribute(name: string) {
      return this.selection.attr(name) ?? null;
    }
    hasAttribute(name: string) {
      return this.getAttribute(name) !== null;
    }
    setAttribute(name: string, value: string) {
      if (this.getAttribute(name) === String(value)) return;
      this.selection.attr(name, String(value));
      notify({ type: "attributes", target: this, attributeName: name });
    }
    removeAttribute(name: string) {
      if (!this.hasAttribute(name)) return;
      this.selection.removeAttr(name);
      notify({ type: "attributes", target: this, attributeName: name });
    }
    querySelector(selector: string) {
      return wrap(
        selector.startsWith(":scope > ")
          ? this.selection.children(selector.slice(9))
          : this.selection.find(selector),
      );
    }
    querySelectorAll(selector: string) {
      return this.selection
        .find(selector)
        .toArray()
        .map((node) => wrap($(node))!);
    }
    closest(selector: string) {
      return wrap(this.selection.closest(selector));
    }
    matches(selector: string) {
      return this.selection.is(selector);
    }
    contains(element: DomElement) {
      return (
        this === element ||
        this.selection
          .find("*")
          .toArray()
          .some((node) => node === element.selection.get(0))
      );
    }
    appendChild(element: DomElement) {
      this.selection.append(element.selection);
      notify({ type: "childList", target: this });
      return element;
    }
    insertBefore(element: DomElement, anchor: DomElement | null) {
      if (anchor) anchor.selection.before(element.selection);
      else this.selection.append(element.selection);
      notify({ type: "childList", target: this });
      return element;
    }
    removeChild(element: DomElement) {
      element.selection.remove();
      notify({ type: "childList", target: this });
      return element;
    }
    remove() {
      this.parentElement?.removeChild(this);
    }
    click() {
      dispatchClick(this);
    }
    focus(_options?: FocusOptions) {
      if (this.isConnected && !this.closest("[inert]")) document.activeElement = this;
    }
  }

  class Observer {
    private targets: { element: DomElement; options: MutationObserverInit }[] = [];
    private pending: Mutation[] = [];
    private readonly callback: (mutations: Mutation[]) => void;
    constructor(callback: (mutations: Mutation[]) => void) {
      this.callback = callback;
    }
    observe(element: DomElement, options: MutationObserverInit) {
      this.targets.push({ element, options });
      observers.add(this);
    }
    disconnect() {
      this.targets = [];
      this.pending = [];
      observers.delete(this);
    }
    receive(mutation: Mutation) {
      if (
        this.targets.some(
          ({ element, options }) =>
            (element === mutation.target ||
              (options.subtree && element.contains(mutation.target))) &&
            (mutation.type === "childList"
              ? options.childList
              : options.attributes &&
                (!options.attributeFilter ||
                  options.attributeFilter.includes(mutation.attributeName!))),
        )
      ) {
        this.pending.push(mutation);
      }
    }
    deliver() {
      const pending = this.pending;
      this.pending = [];
      if (pending.length) this.callback(pending);
      return pending.length > 0;
    }
  }

  const add = (listeners: Map<string, Set<Listener>>, type: string, listener: Listener) => {
    const bucket = listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    listeners.set(type, bucket);
  };
  const document = {
    documentElement: wrap($("html"))!,
    body: wrap($("body"))!,
    activeElement: wrap($("body"))!,
    querySelector: (selector: string) => wrap($(selector)),
    querySelectorAll: (selector: string) =>
      $(selector)
        .toArray()
        .map((node) => wrap($(node))!),
    getElementById: (id: string) => wrap($("#" + id)),
    createElement: (tag: string) => wrap($("<" + tag + "></" + tag + ">"))!,
    addEventListener: (type: string, listener: Listener) => add(documentListeners, type, listener),
    removeEventListener: (type: string, listener: Listener) =>
      documentListeners.get(type)?.delete(listener),
  };
  const schedule = (queue: Map<number, () => void>, fn: () => void) => {
    const id = nextTimer++;
    queue.set(id, fn);
    return id;
  };
  const window = {
    MutationObserver: Observer,
    setInterval: (fn: () => void) => schedule(intervals, fn),
    clearInterval: (id: number) => intervals.delete(id),
    setTimeout: (fn: () => void) => schedule(tasks, fn),
    clearTimeout: (id: number) => tasks.delete(id),
    requestAnimationFrame: (fn: () => void) => schedule(tasks, fn),
    cancelAnimationFrame: (id: number) => tasks.delete(id),
    addEventListener: (type: string, listener: Listener) => add(windowListeners, type, listener),
    removeEventListener: (type: string, listener: Listener) =>
      windowListeners.get(type)?.delete(listener),
  };
  function flush() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const delivered = Array.from(observers, (observer) => observer.deliver()).some(Boolean);
      const pending = Array.from(tasks.values());
      tasks.clear();
      for (const task of pending) task();
      if (!delivered && pending.length === 0) return;
    }
    throw new Error("Theme mutation observer did not settle");
  }
  function dispatchClick(target: DomElement, nativeHandler?: () => void) {
    let propagationStopped = false;
    let defaultPrevented = false;
    const event = {
      target,
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {
        propagationStopped = true;
      },
    };
    for (const listener of documentListeners.get("click") ?? []) listener(event);
    if (!propagationStopped) {
      const handler = nativeHandler ?? nativeClicks.get(target.closest("button") ?? target);
      handler?.();
    }
    flush();
    return { defaultPrevented, propagationStopped };
  }

  return {
    document,
    window,
    Observer,
    Element: DomElement,
    flush,
    click: (selector: string, nativeHandler?: () => void) => {
      const target = document.querySelector(selector);
      if (!target) throw new Error("Missing click target: " + selector);
      return dispatchClick(target, nativeHandler);
    },
    bindClick: (selector: string, handler: () => void) => {
      const target = document.querySelector(selector);
      if (!target) throw new Error("Missing handler target: " + selector);
      nativeClicks.set(target, handler);
    },
    key: (key: string) => {
      for (const listener of windowListeners.get("keydown") ?? []) listener({ key });
      flush();
    },
    tick: () => {
      for (const interval of intervals.values()) interval();
      flush();
    },
    pendingIntervals: () => intervals.size,
    activeObservers: () => observers.size,
    listeners: (type: string) =>
      (documentListeners.get(type)?.size ?? 0) + (windowListeners.get(type)?.size ?? 0),
  };
}

type DomElement = NonNullable<
  ReturnType<ReturnType<typeof createThemeDom>["document"]["querySelector"]>
>;
