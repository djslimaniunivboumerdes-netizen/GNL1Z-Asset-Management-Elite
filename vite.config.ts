import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const isElectron = process.env.BUILD_TARGET === "electron";

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
