import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { onRequestOptions, onRequestPost } from "./functions/api/ai-agent";
import { onRequestOptions as searchManualOptions, onRequestPost as searchManualPost } from "./functions/api/search-manual";

const isElectron = process.env.BUILD_TARGET === "electron";

// Dev/preview only: bridge the Cloudflare Pages Function so the assistant works
// behind the HTTPS preview proxy. Production uses the real Pages Function.
function assistantApiPlugin(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const requestUrl = req.url;
    if (!requestUrl) return next();
    const isAssistant = requestUrl.startsWith("/api/ai-agent");
    const isManualSearch = requestUrl.startsWith("/api/search-manual");
    if (!isAssistant && !isManualSearch) return next();
    if (req.method !== "POST" && req.method !== "OPTIONS") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    try {
      const forwardedHost = req.headers["x-forwarded-host"];
      const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(",")[0]?.trim() || req.headers.host || "localhost:8081";
      const forwardedProto = req.headers["x-forwarded-proto"];
      const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() || "http";
      const url = new URL(requestUrl, `${proto}://${host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else headers.set(key, value);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const request = new Request(url, {
        method: req.method,
        headers,
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const response = isManualSearch
        ? (req.method === "OPTIONS" ? await searchManualOptions({ request }) : await searchManualPost({ request, env: process.env }))
        : (req.method === "OPTIONS" ? await onRequestOptions({ request }) : await onRequestPost({ request, env: process.env }));
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
  return {
    name: "gnl1z-assistant-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  base: isElectron ? "./" : "/",

  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: [".e2b.app"],
    hmr: {
      overlay: false,
    },
  },

  preview: { host: "0.0.0.0", port: 8081, allowedHosts: [".e2b.app"] },

  plugins: [
    assistantApiPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "icon-192x192.png",
        "icon-512x512.png",
      ],
      manifestFilename: "manifest.webmanifest",
      manifest: {
        id: "/",
        name: "GNL1Z Asset Integrity Management",
        short_name: "GNL1Z",
        description: "Industrial Asset Management for the GNL1Z Sonatrach AP-C3MR™ liquefaction facility.",
        theme_color: "#0f172a",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,woff,woff2,webp}"],
        navigateFallback: "/index.html",
        // Auth must never be fulfilled from a cached application shell.
        navigateFallbackDenylist: [/^\/auth\//],
        // Do not precache public PDFs/drawings; cache them on first use instead.
        globIgnores: ["**/pfd/**", "**/images/**", "**/pdf/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(png|jpg|jpeg|svg|webp)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.pdf$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "pdf-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          database: ["./src/data/gnl1z_database.json"],
        },
      },
    },
  },
});
