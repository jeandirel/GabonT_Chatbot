"use client";

import { useEffect } from "react";

/** Enregistre le service worker PWA. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
