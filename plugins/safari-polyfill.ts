export default defineNuxtPlugin(() => {
  if (import.meta.client && typeof window !== "undefined") {
    // Polyfill for safari global that some libraries might expect
    // Safari browser doesn't expose a global 'safari' object by default
    // This prevents ReferenceError when third-party libraries try to access it
    const w = window as unknown as Window & { safari?: Record<string, unknown> };
    const g = globalThis as unknown as typeof globalThis & { safari?: Record<string, unknown> };

    if (typeof w.safari === "undefined") {
      w.safari = {};
    }
    // Also define it as a global variable (not just window property)
    // Some code might try to access 'safari' directly without 'window.'
    if (typeof g.safari === "undefined") {
      g.safari = {};
    }
  }
});
