import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      // content.ts se compila aparte con vite.content.config.ts
      input: {
        background: resolve(__dirname, "src/background/background.ts"),
        popup: resolve(__dirname, "src/popup/popup.ts"),
        sidepanel: resolve(__dirname, "src/sidepanel/sidepanel.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
    target: "es2020",
    minify: false,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "src/popup/popup.html", dest: "." },
        { src: "src/popup/popup.css", dest: "." },
        { src: "src/sidepanel/sidepanel.html", dest: "." },
        { src: "src/sidepanel/sidepanel.css", dest: "." },
        { src: "icons", dest: ".", overwrite: false },
      ],
    }),
  ],
});
