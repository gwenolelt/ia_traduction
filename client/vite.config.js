import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // Proxy les appels API vers le serveur Express
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
