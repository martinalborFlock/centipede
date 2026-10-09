import { defineConfig } from "vite";
import { resolve } from "path";

// Las content scripts de Chrome no admiten módulos ES: no pueden tener imports.
// Se empaquetan aparte como IIFE para incluir todo el código compartido dentro de content.js.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2020",
    minify: false,
    lib: {
      entry: resolve(__dirname, "src/content/content.ts"),
      name: "BugRecorderContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
