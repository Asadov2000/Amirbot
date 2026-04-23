"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isProduction = process.env.NODE_ENV === "production";
    const isLocalHost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if (!isProduction || isLocalHost) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      void caches.keys().then((keys) => {
        keys.forEach((key) => {
          void caches.delete(key);
        });
      });

      return;
    }

    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
