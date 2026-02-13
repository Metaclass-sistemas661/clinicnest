import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_COMMIT__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "dev"
    ),
    __BUILD_REF__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GITHUB_REF_NAME ?? "local"
    ),
    __BUILD_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? mode),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        template: "treemap",
      }),
  ].filter(Boolean),
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
