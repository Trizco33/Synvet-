import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

const BUILD_VERSION = String(Date.now());

function swVersionPlugin(): Plugin {
  return {
    name: "synvet-sw-version",
    apply: "build",
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(import.meta.dirname, "dist/public");
      const swPath = path.join(outDir, "sw.js");
      if (!fs.existsSync(swPath)) return;
      const content = fs.readFileSync(swPath, "utf-8").replace(/__BUILD_VERSION__/g, BUILD_VERSION);
      fs.writeFileSync(swPath, content);
    },
  };
}

// Em dev (Replit), PORT e BASE_PATH são injetados pelo workflow.
// Em build (Vercel/CI), não existem — usamos defaults seguros.
const isDevServer = process.env.npm_lifecycle_event === "dev";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

const basePath = process.env.BASE_PATH ?? "/";

if (isDevServer && !rawPort) {
  throw new Error("PORT environment variable is required for dev server.");
}

export default defineConfig({
  base: basePath,
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
