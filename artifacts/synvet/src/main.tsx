import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { supabase } from "./lib/supabase";
import { apiOrigin } from "./lib/api-base";

// Em produção fora do Replit (ex.: Vercel), VITE_API_URL aponta para o backend Railway.
// Ex.: VITE_API_URL=https://synvet-api.up.railway.app
// Os hooks gerados já chamam `/api/...`, então o baseUrl é só a ORIGEM (sem /api).
// Sem a variável, usa URL relativa (funciona no Replit onde o proxy unifica tudo).
const origin = apiOrigin();
if (origin) {
  setBaseUrl(origin);
}

declare const __BUILD_VERSION__: string;

setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${__BUILD_VERSION__}`;
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL })
      .then((reg) => {
        // When a new SW is found, ask it to activate immediately, then reload.
        const promote = (sw: ServiceWorker | null) => {
          if (!sw) return;
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            sw.postMessage("SKIP_WAITING");
          }
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              sw.postMessage("SKIP_WAITING");
            }
          });
        };
        promote(reg.waiting);
        reg.addEventListener("updatefound", () => promote(reg.installing));

        // Periodic update check while the tab is open.
        setInterval(() => {
          reg.update().catch(() => undefined);
        }, 60_000);
      })
      .catch(() => {
        // Registration failures shouldn't block the app.
      });

    // When a new SW takes control, reload once to pick up new chunks.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });

  // Recover from stale-chunk errors after a deploy: chunk hashes in the
  // currently-loaded HTML may no longer exist on the server. Force a reload.
  window.addEventListener("error", (event) => {
    const msg = String(event.message ?? "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("ChunkLoadError")
    ) {
      const key = "synvet-chunk-reload";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
