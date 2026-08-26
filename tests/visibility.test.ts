import assert from "node:assert/strict";
import test from "node:test";

type VisibilityCallback = (entries: Array<{ target: object; isIntersecting: boolean }>) => void;

class FakeIntersectionObserver {
  static instance: FakeIntersectionObserver | null = null;
  readonly observed = new Set<object>();
  readonly unobserved: object[] = [];
  readonly callback: VisibilityCallback;

  constructor(callback: VisibilityCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instance = this;
  }

  observe(target: object) {
    this.observed.add(target);
  }

  unobserve(target: object) {
    this.observed.delete(target);
    this.unobserved.push(target);
  }

  emit(target: object, isIntersecting: boolean) {
    this.callback([{ target, isIntersecting }]);
  }
}

Object.assign(globalThis, { IntersectionObserver: FakeIntersectionObserver });

const { observe } = await import("../src/lib/visibility.ts");

test("multiple visibility subscribers on one element do not overwrite each other", () => {
  const element = {} as Element;
  const first: boolean[] = [];
  const second: boolean[] = [];

  const offFirst = observe(element, (visible) => first.push(visible));
  const offSecond = observe(element, (visible) => second.push(visible));
  const fake = FakeIntersectionObserver.instance;
  assert.ok(fake);
  assert.equal(fake.observed.size, 1);

  fake.emit(element, true);
  assert.deepEqual(first, [true]);
  assert.deepEqual(second, [true]);

  offFirst();
  fake.emit(element, false);
  assert.deepEqual(first, [true]);
  assert.deepEqual(second, [true, false]);
  assert.equal(fake.unobserved.length, 0);

  offSecond();
  assert.deepEqual(fake.unobserved, [element]);
});
