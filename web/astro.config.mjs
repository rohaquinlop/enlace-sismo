import { defineConfig } from "astro/config";

// Sitio estático en Cloudflare Pages. Los datos dinámicos (puntos de
// rescate, catálogos en vivo) se leen del API en https://api.enlacesismo.com
export default defineConfig({
  site: "https://enlacesismo.com",
  output: "static",
  compressHTML: true,
});
