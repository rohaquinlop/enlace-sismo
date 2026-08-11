#!/usr/bin/env node
/**
 * Geocodifica direcciones de catálogos vía Nominatim (OpenStreetMap).
 * Mismo método usado en centros-salud.json.
 *
 * Uso:
 *   node scripts/geocodificar.mjs < direcciones.json
 *
 * Entrada (stdin): [{ "id": "...", "query": "Calle X #Y-Z, Ciudad" }, ...]
 * Salida (stdout): [{ "id": "...", "query": "...", "lat": ..., "lng": ...,
 *                      "nombre": "...", "direccion_nominatim": "..." }, ...]
 *
 * Regla de oro: el resultado es un BORRADOR. El mantenedor debe contrastar
 * cada coordenada contra el lugar real antes de publicarla en data/*.json.
 * Nominatim pide 1 petición/segundo: el script espera 1.1 s entre llamadas.
 */
import { readFileSync } from "node:fs";

const stdin = readFileSync(0, "utf8").trim();
const entradas = JSON.parse(stdin);
if (!Array.isArray(entradas)) throw new Error("Entrada debe ser un arreglo JSON");

const UA = "enlace-sismo/1.0 (recopilacion de acopios post-sismo; contacto: proyecto opensource)";
const out = [];

for (const e of entradas) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=co&q=" +
    encodeURIComponent(e.query);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (items.length === 0) {
      out.push({ id: e.id, query: e.query, error: "sin-resultado" });
      console.error(`  ✗ ${e.id}: sin resultado (${e.query})`);
    } else {
      const it = items[0];
      out.push({
        id: e.id,
        query: e.query,
        lat: parseFloat(it.lat),
        lng: parseFloat(it.lon),
        nombre: it.name ?? "",
        direccion_nominatim: it.display_name ?? "",
      });
      console.error(`  ✓ ${e.id}: ${it.lat}, ${it.lon} — ${it.display_name ?? it.name}`);
    }
  } catch (err) {
    out.push({ id: e.id, query: e.query, error: err.message });
    console.error(`  ✗ ${e.id}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 1100));
}

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
