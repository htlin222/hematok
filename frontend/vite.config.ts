import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Take control immediately and drop stale precaches so a returning
      // visitor never gets served an old build from the service worker.
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // feed.json changes often during the project — always go to network for it.
        runtimeCaching: [
          {
            urlPattern: /\/feed\.json$/,
            handler: "NetworkFirst",
            options: { cacheName: "feed", expiration: { maxEntries: 2 } },
          },
        ],
      },
      manifest: {
        name: "Hematok — ASH Image Bank",
        short_name: "Hematok",
        icons: [
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
      },
    }),
  ],
});
