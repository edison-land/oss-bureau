import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function staticRoutesPlugin(): Plugin {
  return {
    name: "oss-bureau-static-routes",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const indexHtml = path.join(distDir, "index.html");
      if (!fs.existsSync(indexHtml)) return;
      const html = fs.readFileSync(indexHtml, "utf8");

      // Static route entry points so direct hits & refreshes return 200 OK on GitHub Pages
      for (const route of ["registry", "issues", "protocol"]) {
        const dir = path.join(distDir, route);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
      }
      // SPA fallback for dynamic /case/<CASE-ID> deep links
      fs.writeFileSync(path.join(distDir, "404.html"), html, "utf8");
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), staticRoutesPlugin()],
  base: command === "build" ? "/oss-bureau/" : "/",
  server: {
    fs: {
      allow: [".."],
    },
  },
}));
