import { defineConfig } from "astro/config";

// Sitio estático en Cloudflare Pages. Los datos dinámicos (alertas) se
// leen del API en https://api.enlacesismo.app
export default defineConfig({
  site: "https://enlacesismo.app",
  output: "static",
  compressHTML: true,
});
