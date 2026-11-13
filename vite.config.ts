import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "The Dream Board",
        short_name: "Dream Board",
        description:
          "Two strangers raise a shared pet. Claude connects what everyone feels.",
        theme_color: "#14121c",
        background_color: "#14121c",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { host: true },
});
