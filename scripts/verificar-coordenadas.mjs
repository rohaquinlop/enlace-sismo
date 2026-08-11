#!/usr/bin/env node
/**
 * Verifica coordenadas de data/*.json contra DOS geocodificadores independientes:
 *   1. Google Maps embed (maps.google.com/maps?q=...&output=embed) — el MISMO geocoder
 *      que resuelve el destino en los enlaces "Cómo llegar" (dir/?api=1&destination=lat,lng).
 *   2. ArcGIS World Geocoder (findAddressCandidates) — segunda opinión con score 0-100.
 *
 * Regla de veredicto:
 *   - CONFIRMADA: Google y ArcGIS coinciden a < 150 m → usar coordenadas de Google.
 *   - DISCREPANCIA: coinciden a >= 150 m → investigar antes de publicar.
 *   - GOOGLE-SOLO / SIN-GEOCODIFICAR: sin segunda opinión → revisar manualmente.
 *
 * Uso: node scripts/verificar-coordenadas.mjs   (lee data/acopios.json y data/albergues.json)
 * Salida: /tmp/verificacion.json + tabla en consola.
 * La salida es un BORRADOR: el mantenedor decide qué coordenada se publica.
 */
import { readFileSync, writeFileSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (enlace-sismo; verificacion de coordenadas humanitaria)";

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function googleGeocode(query) {
  const url = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  const html = await res.text();
  // Nivel 1 — lugar resuelto: ["0x...:0x...", "dirección formateada", [lat,lng]]
  const m = html.match(/\["0x[0-9a-f]+:0x[0-9a-f]+","([^"]*)",\[(-?[0-9.]+),(-?[0-9.]+)\]\]/);
  if (m)
    return {
      ok: true,
      lat: parseFloat(m[2]),
      lng: parseFloat(m[3]),
      direccion: m[1],
      nivel: "lugar",
    };
  // Nivel 2 — centro de cámara: [[[alt,lng,lat],[0,0,0],...]] (geocodificado a vía/barrio)
  const c = html.match(/\[\[\[[0-9.]+,-?[0-9.]+,-?[0-9.]+\],\[0,0,0\]/);
  if (c) {
    const partes = c[0].match(/-?[0-9.]+/g);
    return {
      ok: true,
      lat: parseFloat(partes[2]),
      lng: parseFloat(partes[1]),
      direccion: "(centro de cámara — vía/barrio)",
      nivel: "camara",
    };
  }
  return { ok: false };
}

async function arcgisGeocode(query) {
  const url =
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=pjson&outSR=4326&maxLocations=1&SingleLine=" +
    encodeURIComponent(query);
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const d = await res.json();
  const c = d.candidates?.[0];
  if (c) return { ok: true, lat: c.location.y, lng: c.location.x, score: c.score, address: c.address };
  return { ok: false };
}

const CATALOGOS = [
  { archivo: "data/acopios.json", clave: "acopios" },
  { archivo: "data/albergues.json", clave: "albergues" },
];

const resultados = [];

for (const cat of CATALOGOS) {
  const doc = JSON.parse(readFileSync(cat.archivo, "utf8"));
  for (const e of doc[cat.clave]) {
    const query = `${e.direccion}, ${e.ciudad}, ${e.departamento}, Colombia`;
    const g = await googleGeocode(query);
    await sleep(1300);
    const a = await arcgisGeocode(query);
    await sleep(600);

    const r = {
      id: e.id,
      catalogo: cat.clave,
      direccion_publicada: e.direccion,
      actual: { lat: e.lat, lng: e.lng },
    };

    if (g.ok) {
      r.google = { lat: g.lat, lng: g.lng, direccion: g.direccion, nivel: g.nivel };
      r.distancia_actual_m = Math.round(haversine(e.lat, e.lng, g.lat, g.lng));
    }
    if (a.ok) r.arcgis = { lat: a.lat, lng: a.lng, score: a.score, address: a.address };
    if (g.ok && a.ok) r.distancia_google_arcgis_m = Math.round(haversine(g.lat, g.lng, a.lat, a.lng));

    if (!g.ok) r.veredicto = "SIN-GEOCODIFICAR";
    else if (!a.ok) r.veredicto = "GOOGLE-SOLO";
    else if (r.distancia_google_arcgis_m < 150) r.veredicto = "CONFIRMADA";
    else if (r.distancia_google_arcgis_m < 500) r.veredicto = "CONFIRMADA-CON-CAUTELA";
    else r.veredicto = "DISCREPANCIA";

    resultados.push(r);
    const gStr = g.ok ? `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)} [${g.nivel}] ${g.direccion.slice(0, 45)}` : "—";
    const aStr = a.ok ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)} (score ${a.score})` : "—";
    console.log(`[${r.veredicto.padEnd(15)}] ${e.id.padEnd(28)} actual→${r.distancia_actual_m ?? "?"}m\n    G: ${gStr}\n    A: ${aStr}`);
  }
}

writeFileSync("/tmp/verificacion.json", JSON.stringify(resultados, null, 2));
const n = (v) => resultados.filter((r) => r.veredicto === v).length;
console.log(`\nCONFIRMADA: ${n("CONFIRMADA")} · CON-CAUTELA: ${n("CONFIRMADA-CON-CAUTELA")} · DISCREPANCIA: ${n("DISCREPANCIA")} · GOOGLE-SOLO: ${n("GOOGLE-SOLO")} · SIN-GEOCODIFICAR: ${n("SIN-GEOCODIFICAR")}`);
