import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => { cleanup(); if (typeof localStorage !== "undefined") localStorage.clear(); });

if (typeof window !== "undefined") {
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }),
});

// jsdom does not implement layout observers used by Radix/cmdk.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
if (typeof Element !== "undefined") Element.prototype.scrollIntoView = vi.fn();
if (typeof window !== "undefined" && !window.crypto.randomUUID) {
  Object.defineProperty(window.crypto, "randomUUID", { value: () => `test-${Math.random().toString(36).slice(2)}-${Date.now()}` });
}

}
