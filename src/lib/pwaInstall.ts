// PWA install capture — registered once at app boot (main.tsx) so the
// `beforeinstallprompt` event is never lost while the user is on other routes.
//
// Chromium fires the event once per browsing session when the app meets the
// installability criteria (manifest + registered service worker + HTTPS).
// iOS Safari never fires it — there we rely on `navigator.standalone` and the
// manual "Add to Home Screen" steps.

import { useEffect, useReducer } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(fn => fn());

export const subscribePwaInstall = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** True when the app is running as an installed PWA (Chrome standalone / iOS Safari). */
export const isStandalone = (): boolean => {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch { /* matchMedia unavailable */ }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
};

export const isInstalled = (): boolean => installed || isStandalone();

/** True when the browser offered one-tap install and the app is not installed yet. */
export const canInstall = (): boolean => deferred !== null && !installed;

/** Trigger the native install prompt (user gesture required). */
export const promptInstall = async (): Promise<InstallOutcome> => {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null; // the browser consumes the prompt either way
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") installed = true;
    emit();
    return choice.outcome;
  } catch {
    emit();
    return "unavailable";
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // suppress the default infobar; we render our own CTA
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Subscribe a component to install-state changes (beforeinstallprompt / appinstalled). */
export function usePwaInstall() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribePwaInstall(force), []);
  return { installed: isInstalled(), canInstall: canInstall() };
}
