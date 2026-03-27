import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_COMMIT__: JSON.stringify(
      process.env.GITHUB_SHA ?? "dev"
    ),
    __BUILD_REF__: JSON.stringify(
      process.env.GITHUB_REF_NAME ?? "local"
    ),
    __BUILD_ENV__: JSON.stringify(process.env.NODE_ENV ?? mode),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "2.6.0"),
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-alert-dialog",
          ],
          "vendor-charts": ["recharts"],
          "vendor-editor": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-color",
            "@tiptap/extension-highlight",
            "@tiptap/extension-link",
            "@tiptap/extension-placeholder",
            "@tiptap/extension-table",
            "@tiptap/extension-table-cell",
            "@tiptap/extension-table-header",
            "@tiptap/extension-table-row",
            "@tiptap/extension-text-align",
            "@tiptap/extension-text-style",
            "@tiptap/extension-underline",
          ],
          "vendor-pdf": ["jspdf", "jspdf-autotable", "html2canvas"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-firebase": ["firebase/app", "firebase/messaging"],
          "vendor-date": ["date-fns", "date-fns-tz"],
          "vendor-form": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-twilio": ["twilio-video"],
          "vendor-crypto": ["node-forge"],
          "vendor-sentry": ["@sentry/react"],
        },
      },
    },
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
