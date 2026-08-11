import { defineConfig } from "astro/config";

// Sitio estático en Cloudflare Pages. Los datos dinámicos (alertas) se
// leen del API en https://api.enlacesismo.com
export default defineConfig({
  site: "https://enlacesismo.com",
  output: "static",
  compressHTML: true,
});
