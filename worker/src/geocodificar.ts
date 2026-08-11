// Geocodificación (Nominatim) con caché KV — forward y reverse.
// El formulario usa GET /api/geocodificar; el worker geocodifica en reverse
// al crear un reporte. Si Nominatim falla, se devuelve null (lat/lng mandan).
import { Hono, type Context } from "hono";
import { rateLimit, type Bindings } from "./index";

const UA = "enlace-sismo/1.0 (https://enlacesismo.com)";
const TTL_KV = 30 * 24 * 3600; // 30 días

/**
 * Normaliza un nombre de ciudad de Nominatim: "Cali ciudad" → "Cali",
 * "bogotá d.c." → "Bogotá". Sufijos comunes de Colombia; alias contra el
 * catálogo no viven aquí (el catálogo es del workspace web, que deduplica).
 */
export function normalizarCiudad(raw: string): string {
  let s = String(raw).toLowerCase().trim();
  s = s.replace(/\s*(ciudad|municipio)\s*$/i, "");
  s = s.replace(/\s*d\.?\s*c\.?\s*$/i, "");
  s = s.replace(/\s*d\.?\s*e\.?\s*$/i, "");
  s = s.trim();
  if (!s) return "";
  return (s.charAt(0).toUpperCase() + s.slice(1)).slice(0, 80);
}

/**
 * Reverse geocode: dirección legible + nivel de precisión + barrio + ciudad.
 * Celda ~1.1 km cacheada en KV (v3: con ciudad).
 */
export async function reverseGeocode(c: Context<Bindings>, lat: number, lng: number): Promise<ReverseResultado> {
  const celda = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const key = `geo:rev:v3:${celda}`;
  const cacheado = await c.env.KV.get(key);
  if (cacheado !== null) {
    try {
      return JSON.parse(cacheado) as ReverseResultado;
    } catch {
      // caché corrupta: sigue y regenera
    }
  }
  const vacio: ReverseResultado = { direccion: null, precision: "via" };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return vacio;
    const data = (await res.json()) as {
      display_name?: string;
      addresstype?: string;
      address?: {
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
      };
    };
    const direccion = data.display_name ? String(data.display_name).slice(0, 300) : null;
    const precision: PrecisionPin = precisionDeAddresstype(data.addresstype);
    const barrio = data.address?.neighbourhood ?? data.address?.suburb;
    const ciudad = data.address?.city ?? data.address?.town ?? data.address?.village ?? data.address?.county;
    const resultado: ReverseResultado = {
      direccion,
      precision,
      ...(barrio ? { barrio } : {}),
      ...(ciudad ? { ciudad } : {}),
    };
    await c.env.KV.put(key, JSON.stringify(resultado), { expirationTtl: TTL_KV });
    return resultado;
  } catch {
    return vacio;
  }
}

export type PrecisionPin = "premisa" | "via" | "barrio";

export interface ResultadoForward {
  label: string;
  detalle?: string;
  lat: number;
  lng: number;
  /** Nivel de precisión del punto (vocabulario de coordenadas_nivel del proyecto). */
  precision: PrecisionPin;
}

export interface ReverseResultado {
  direccion: string | null;
  precision: PrecisionPin;
  barrio?: string;
  ciudad?: string;
}

interface NominatimHit {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  addresstype?: string;
}

// addresstype/type de Nominatim → nivel de precisión del proyecto.
const TIPOS_BARRIO = new Set([
  "suburb", "neighbourhood", "quarter", "city", "town", "village",
  "municipality", "county", "state", "region",
]);
const TIPOS_VIA = new Set([
  "road", "pedestrian", "footway", "cycleway", "service",
  "living_street", "unclassified", "primary", "secondary", "tertiary",
  "residential", "trunk", "motorway", "steps", "path",
]);

function precisionDeTipo(tipo: string | undefined): PrecisionPin {
  if (!tipo) return "via";
  if (TIPOS_BARRIO.has(tipo)) return "barrio";
  if (TIPOS_VIA.has(tipo)) return "via";
  return "premisa";
}

// En reverse, addresstype "residential" es una zona residencial (barrio).
function precisionDeAddresstype(tipo: string | undefined): PrecisionPin {
  if (!tipo) return "via";
  if (tipo === "residential" || TIPOS_BARRIO.has(tipo)) return "barrio";
  if (TIPOS_VIA.has(tipo)) return "via";
  return "premisa";
}

// addresstype describe el elemento de dirección real ("road" para calles
// aunque el type del hit diga "residential"); class matiza place/highway.
function precisionDeHit(d: NominatimHit): PrecisionPin {
  if (d.addresstype) return precisionDeAddresstype(d.addresstype);
  if (d.class === "highway") return "via";
  if (d.class === "place") return "barrio";
  return precisionDeTipo(d.type);
}

// "carrera 67 #3c 15, Cali" → street "carrera 67", housenumber "3c 15", city "Cali".
// También "calle 21 No. 8-30". Si la parte de calle no parece dirección
// (sin # ni dígitos), devuelve todo null → búsqueda libre ("plaza bolivar, pereira").
function parsearDireccion(q: string): { street: string | null; housenumber: string | null; city: string | null } {
  const partes = q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length < 2) return { street: null, housenumber: null, city: null };
  const city = partes[partes.length - 1];
  let street = partes.slice(0, -1).join(", ");
  let housenumber: string | null = null;

  // Formato colombiano: "carrera 67 #3c 15" o "# 8 - 30"
  const conHash = street.match(/#\s*([0-9][\w-]*(?:\s*[-–]\s*[\w]+)*)/i);
  if (conHash) {
    housenumber = conHash[1].replace(/\s+/g, " ");
    street = street.replace(conHash[0], "").trim();
  } else {
    const conNo = street.match(/\bno\.?\s*([0-9][\w-]*(?:\s*[-–]\s*[\w]+)*)/i);
    if (conNo) {
      housenumber = conNo[1].replace(/\s+/g, " ");
      street = street.replace(conNo[0], "").trim();
    }
  }

  if (street.length < 3 || city.length < 2 || !/(#|\d)/.test(street + (housenumber ?? ""))) {
    return { street: null, housenumber: null, city: null };
  }
  return { street, housenumber, city };
}

function normalizarHits(lista: NominatimHit[]): ResultadoForward[] {
  const vistos = new Set<string>();
  const salida: ResultadoForward[] = [];
  for (const d of lista) {
    if (!d.display_name || !d.lat || !d.lon) continue;
    const partes = String(d.display_name)
      .split(",")
      .map((s) => s.trim());
    const label = (d.name ?? partes[0] ?? String(d.display_name)).slice(0, 120);
    const detalle = partes.slice(1).slice(0, 4).join(", ").slice(0, 160);
    const clave = `${d.lat},${d.lon}|${label}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const precision = precisionDeHit(d);
    salida.push({ label, detalle: detalle || undefined, lat: Number(d.lat), lng: Number(d.lon), precision });
  }
  return salida;
}

async function consultaNominatim(params: string): Promise<ResultadoForward[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&countrycodes=co&accept-language=es&${params}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    return normalizarHits((await res.json()) as NominatimHit[]);
  } catch {
    return [];
  }
}

/**
 * Forward geocode estilo Google Maps. Multi-etapa para direcciones
 * colombianas, de lo más preciso a lo más general:
 *   1) street + housenumber + city ("carrera 67 #3c 15, Cali")
 *   2) street + city
 *   3) q libre
 *   4) q normalizada sin "#"
 * Cada resultado lleva su nivel de precisión (premisa / via / barrio).
 */
export async function forwardGeocode(c: Context<Bindings>, q: string): Promise<ResultadoForward[]> {
  // v5: precisión por addresstype; la caché v4 se ignora.
  const key = `geo:fwd:v5:${q}`;
  const cacheado = await c.env.KV.get(key);
  if (cacheado !== null) {
    try {
      return JSON.parse(cacheado) as ResultadoForward[];
    } catch {
      // caché corrupta: sigue y regenera
    }
  }

  const vistos = new Set<string>();
  const salida: ResultadoForward[] = [];
  const agregar = (lista: ResultadoForward[]) => {
    for (const r of lista) {
      const clave = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}|${r.label}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(r);
    }
  };

  const { street, housenumber, city } = parsearDireccion(q);
  if (street && city) {
    const base = `street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}`;
    if (housenumber) {
      agregar(await consultaNominatim(`${base}&housenumber=${encodeURIComponent(housenumber)}`));
    }
    if (salida.length === 0) {
      agregar(await consultaNominatim(base));
    }
  }
  if (salida.length === 0) {
    agregar(await consultaNominatim(`q=${encodeURIComponent(q)}`));
  }
  if (salida.length === 0) {
    // El "#" del formato colombiano a veces rompe la búsqueda libre.
    agregar(await consultaNominatim(`q=${encodeURIComponent(q.replace(/#/g, " "))}`));
  }

  const resultados = salida.slice(0, 8);
  await c.env.KV.put(key, JSON.stringify(resultados), { expirationTtl: TTL_KV });
  return resultados;
}

const app = new Hono<Bindings>();

app.get("/", async (c) => {
  const q = c.req.query("q");
  const latRaw = c.req.query("lat");
  const lngRaw = c.req.query("lng");

  if (!(await rateLimit(c, "rl:geocodificar", 30))) {
    return c.json({ error: "Demasiadas búsquedas. Espera un momento." }, 429);
  }

  if (q) {
    if (q.length < 3 || q.length > 200) return c.json({ error: "consulta inválida" }, 400);
    return c.json({ resultados: await forwardGeocode(c, q) });
  }

  if (latRaw !== undefined && lngRaw !== undefined) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return c.json({ error: "coordenadas inválidas" }, 400);
    }
    return c.json(await reverseGeocode(c, lat, lng));
  }

  return c.json({ error: "usa ?q= o ?lat=&lng=" }, 400);
});

export default app;
