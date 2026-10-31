import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_* for local development, NEXT_PUBLIC_* from the Vercel Supabase
  // integration. Only these public prefixes ever reach the browser.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks, cached separately from app code.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
