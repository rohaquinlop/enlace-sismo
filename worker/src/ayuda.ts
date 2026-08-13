// Registro en vivo de puntos de ayuda (fase de coordinación post-72 h).
// Almacén: D1 (tabla puntos_ayuda). Cada escritura valida la entrada con Ajv
// contra data/schema/punto-ayuda.schema.json antes de INSERT/UPDATE.
// Lectura: API público GET /api/ayuda (proyección sin IPs, CORS abierto).
// El registro de rescates (GitHub como almacén) vive en puntos.ts y NO se toca.
import { Hono, type Context } from "hono";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { rateLimit, type Bindings } from "./index";
import { reverseGeocode, normalizarCiudad } from "./geocodificar";
import puntoAyudaSchema from "../../data/schema/punto-ayuda.schema.json";

const TIPOS = ["acopio", "albergue", "hospital", "otro"];
const MODALIDADES = ["necesita", "recolecta", "ambos"];
const ESTADOS_ADMIN = ["confirmado", "cerrado", "falso", "promovido"];
const ESTADOS_ACTIVOS = ["sin-confirmar", "confirmado", "promovido"];
// Espejo de web/src/lib/items-ayuda.ts (workspaces separados; mantener en sync).
const ITEMS = [
  "agua", "alimentos-no-perecederos", "medicamentos", "insumos-medicos",
  "elementos-aseo", "cobijas", "colchonetas", "camas", "ropa", "calzado",
  "panales", "kits-cocina", "carpas", "herramientas", "linternas", "baterias",
  "generador", "combustible", "maquinaria", "voluntarios", "transporte",
  // Vocabulario del seed de catálogos (acopios): los acopios oficiales
  // declaran estas necesidades; la comunidad debe poder reportarlas igual.
  "alimentos-bebe", "mascotas",
];
const MAX_ITEMS = 20;
const MAX_DESCRIPCION = 1000;
const MAX_DETALLE_FLAG = 500;
const MAX_CIUDADES_DESTINO = 10;
const MAX_NOMBRE = 120;
const MAX_HORARIO = 120;
const MAX_CONTACTO = 200;
const MAX_NOTA_DESTINO = 300;
const MAX_UNIDAD = 20;
const MAX_CANTIDAD = 999999;
const MAX_ENLAZADO = 64;

// Fila completa del almacén (forma interna; la proyección pública la recorta).
interface FilaPunto {
  id: string;
  tipo: string;
  modalidad: string;
  nombre: string | null;
  lat: number;
  lng: number;
  coordenadas_nivel: string;
  ciudad: string | null;
  direccion: string | null;
  descripcion: string;
  items: string;
  destino: string | null;
  horario: string | null;
  contacto: string | null;
  estado: string;
  flags: string;
  ediciones: string | null;
  token_hash: string | null;
  enlazado_a: string | null;
  ip_hash: string;
  created_at: string;
  ultima_actualizacion: string;
  fuente: string | null;
  verificado_por: string | null;
  fecha_verificacion: string | null;
  verificacion: string | null;
  // Columnas del seed de catálogos (migración 0002): opcionales, las
  // escriben el seed y el mantenedor; el formulario ciudadano no las usa.
  subtipo: string | null;
  departamento: string | null;
  capacidad: number | null;
  ocupacion: number | null;
  admite_mascotas: number | null;
  servicios: string | null;
  urgencias_24h: number | null;
  recoleccion_periodica: number | null;
  recoleccion_detalle: string | null;
  evidencia_links: string | null;
  imagen_url: string | null;
}

/** Entrada pública: sin ip_hash, token_hash ni ediciones; flags como conteo;
 *  items y destino parseados desde sus columnas JSON. */
type EntradaPublica = Omit<FilaPunto, "flags" | "ediciones" | "token_hash" | "ip_hash" | "items" | "destino"> & {
  flags: number;
  items: unknown;
  destino: unknown;
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const valida = ajv.compile(puntoAyudaSchema as never);

const app = new Hono<Bindings>();

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const sha256Hex = async (s: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Token de edición: 24 bytes aleatorios en base64url (32 caracteres). */
function tokenEdicion(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const ipDe = (c: Context<Bindings>): string => c.req.header("cf-connecting-ip") ?? "local-dev";

/** Valida y normaliza items; lanza { status, mensaje } con el código HTTP. */
function validarItems(itemsRaw: unknown): { tipo: "catalogo" | "personalizado"; id?: string; nombre?: string; cantidad?: number; unidad?: string }[] {
  if (!Array.isArray(itemsRaw)) throw httpError("items debe ser un arreglo", 400);
  if (itemsRaw.length > MAX_ITEMS) throw httpError(`Máximo ${MAX_ITEMS} ítems`, 400);
  const vistos = new Set<string>();
  const items: { tipo: "catalogo" | "personalizado"; id?: string; nombre?: string; cantidad?: number; unidad?: string }[] = [];
  for (const raw of itemsRaw) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const tipo = String(item.tipo ?? "");
    const salida: { tipo: "catalogo" | "personalizado"; id?: string; nombre?: string; cantidad?: number; unidad?: string } = { tipo: tipo as "catalogo" | "personalizado" };
    let clave = "";
    if (tipo === "catalogo") {
      const id = String(item.id ?? "");
      if (!ITEMS.includes(id)) throw httpError(`ítem de catálogo inválido: ${id}`, 400);
      salida.id = id;
      clave = `c:${id}`;
    } else if (tipo === "personalizado") {
      const nombre = String(item.nombre ?? "").trim();
      if (nombre.length < 2 || nombre.length > 80) throw httpError("nombre personalizado debe tener entre 2 y 80 caracteres", 400);
      if (/[\u0000-\u001f\u007f]/.test(nombre)) throw httpError("nombre personalizado inválido", 400);
      salida.nombre = nombre;
      clave = `p:${nombre.toLowerCase()}`;
    } else {
      throw httpError("tipo de ítem debe ser catalogo o personalizado", 400);
    }
    if (vistos.has(clave)) throw httpError("ítems duplicados", 400);
    vistos.add(clave);
    if (item.cantidad !== undefined) {
      const cantidad = item.cantidad;
      if (typeof cantidad !== "number" || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_CANTIDAD) {
        throw httpError("cantidad debe ser un entero entre 0 y 999999", 400);
      }
      salida.cantidad = cantidad;
    }
    if (item.unidad !== undefined) {
      const unidad = String(item.unidad ?? "").trim().slice(0, MAX_UNIDAD);
      if (unidad.length > 0) salida.unidad = unidad;
    }
    items.push(salida);
  }
  return items;
}

function httpError(mensaje: string, status: number): Error & { status: number } {
  const e = new Error(mensaje) as Error & { status: number };
  e.status = status;
  return e;
}

function manejarError(c: Context<Bindings>, e: unknown): Response {
  if (e instanceof Error && "status" in e && typeof (e as { status: unknown }).status === "number") {
    return c.json({ error: e.message }, (e as { status: number }).status as 400 | 403 | 404 | 409 | 429 | 503);
  }
  throw e;
}

/** SELECT de todas las columnas por id (null si no existe). */
async function filaPorId(c: Context<Bindings>, id: string): Promise<FilaPunto | null> {
  const res = await c.env.ENLACE_SISMO_DB.prepare("SELECT * FROM puntos_ayuda WHERE id = ?").bind(id).first<FilaPunto>();
  return res ?? null;
}

/** Columnas opcionales del seed de catálogos, normalizadas a la forma del
 *  schema (booleanos 0/1 de SQLite → boolean; arreglos JSON → arreglo).
 *  Se omite la clave si la columna es NULL (el schema no admite null). */
function extrasDe(f: FilaPunto): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const agregar = (clave: string, valor: unknown) => {
    if (valor !== null && valor !== undefined) extras[clave] = valor;
  };
  agregar("subtipo", f.subtipo);
  agregar("departamento", f.departamento);
  agregar("capacidad", f.capacidad);
  agregar("ocupacion", f.ocupacion);
  if (f.admite_mascotas !== null) agregar("admite_mascotas", f.admite_mascotas === 1);
  if (f.servicios) {
    try {
      const arr = JSON.parse(f.servicios);
      if (Array.isArray(arr)) agregar("servicios", arr);
    } catch {
      // respaldo defensivo
    }
  }
  if (f.urgencias_24h !== null) agregar("urgencias_24h", f.urgencias_24h === 1);
  if (f.recoleccion_periodica !== null) agregar("recoleccion_periodica", f.recoleccion_periodica === 1);
  agregar("recoleccion_detalle", f.recoleccion_detalle);
  if (f.evidencia_links) {
    try {
      const arr = JSON.parse(f.evidencia_links);
      if (Array.isArray(arr)) agregar("evidencia_links", arr);
    } catch {
      // respaldo defensivo (incluye el literal 'null' de seeds viejos)
    }
  }
  agregar("imagen_url", f.imagen_url);
  return extras;
}

/** Reconstruye la forma interna de la entrada desde una fila (para Ajv). */
function filaAEntrada(f: FilaPunto): Record<string, unknown> {
  const entrada: Record<string, unknown> = {
    id: f.id,
    tipo: f.tipo,
    modalidad: f.modalidad,
    lat: f.lat,
    lng: f.lng,
    coordenadas_nivel: f.coordenadas_nivel,
    descripcion: f.descripcion,
    items: JSON.parse(f.items),
    estado: f.estado,
    flags: JSON.parse(f.flags),
    ip_hash: f.ip_hash,
    created_at: f.created_at,
    ultima_actualizacion: f.ultima_actualizacion,
  };
  const opcionales: Array<[string, string | null]> = [
    ["nombre", f.nombre], ["ciudad", f.ciudad], ["direccion", f.direccion],
    ["horario", f.horario], ["contacto", f.contacto], ["enlazado_a", f.enlazado_a],
    ["fuente", f.fuente], ["verificado_por", f.verificado_por],
    ["fecha_verificacion", f.fecha_verificacion], ["verificacion", f.verificacion],
  ];
  for (const [k, v] of opcionales) {
    if (v) entrada[k] = v;
  }
  for (const [k, v] of Object.entries(extrasDe(f))) {
    entrada[k] = v;
  }
  if (f.destino) {
    try {
      entrada.destino = JSON.parse(f.destino);
    } catch {
      // destino corrupto: la base lo protege con json_valid; respaldo defensivo.
    }
  }
  if (f.ediciones) {
    try {
      entrada.ediciones = JSON.parse(f.ediciones);
    } catch {
      // respaldo defensivo
    }
  }
  if (f.token_hash) entrada.token_hash = f.token_hash;
  return entrada;
}

/** Proyección pública de una fila (sin IPs; flags como conteo; items/destino
 *  parseados; claves opcionales sin valor OMITIDAS — el snapshot no debe
 *  llevar nulls que rompan la validación del schema en CI). */
function aPublico(f: FilaPunto): EntradaPublica {
  let conteoFlags = 0;
  try {
    const arr = JSON.parse(f.flags);
    if (Array.isArray(arr)) conteoFlags = arr.length;
  } catch {
    // La base lo protege con json_valid; el conteo 0 es solo respaldo defensivo.
  }
  let items: unknown = [];
  try {
    const parsed = JSON.parse(f.items);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // items inválidos: arreglo vacío (respaldo defensivo).
  }
  let destino: unknown = null;
  if (f.destino) {
    try {
      destino = JSON.parse(f.destino);
    } catch {
      destino = null;
    }
  }
  const { flags: _flags, ediciones: _ediciones, token_hash: _token_hash, ip_hash: _ip_hash, items: _items, ...resto } = f;
  const salida: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null && v !== undefined)),
    ...extrasDe(f),
    items,
    flags: conteoFlags,
  };
  if (destino !== null) salida.destino = destino;
  return salida as unknown as EntradaPublica;
}

// ---------- API público de lectura (proyección sin IPs, CORS abierto) ----------
app.get("/", async (c) => {
  const ciudad = c.req.query("ciudad");
  const tipo = c.req.query("tipo");
  const modalidad = c.req.query("modalidad");
  const item = c.req.query("item");
  const estado = c.req.query("estado");

  const where: string[] = [];
  const binds: string[] = [];
  // Por defecto solo visibles: cerrado/falso no se muestran; 3+ flags ocultan.
  if (estado) {
    if (![...ESTADOS_ADMIN, "sin-confirmar"].includes(estado)) {
      return c.json({ error: "estado inválido" }, 400);
    }
    where.push("estado = ?");
    binds.push(estado);
  } else {
    where.push("estado NOT IN ('cerrado','falso')");
    where.push("json_array_length(flags) < 3");
  }
  if (ciudad) {
    where.push("ciudad = ?");
    binds.push(ciudad);
  }
  if (tipo) {
    if (!TIPOS.includes(tipo)) return c.json({ error: "tipo inválido" }, 400);
    where.push("tipo = ?");
    binds.push(tipo);
  }
  if (modalidad) {
    if (!MODALIDADES.includes(modalidad)) return c.json({ error: "modalidad inválida" }, 400);
    where.push("modalidad = ?");
    binds.push(modalidad);
  }
  if (item) {
    // Filtro por ítem de catálogo sobre la columna JSON items.
    where.push("EXISTS (SELECT 1 FROM json_each(items) je WHERE json_extract(je.value, '$.id') = ?)");
    binds.push(item);
  }

  const sql = `SELECT * FROM puntos_ayuda WHERE ${where.join(" AND ")} ORDER BY ultima_actualizacion DESC`;
  const { results } = await c.env.ENLACE_SISMO_DB.prepare(sql).bind(...binds).all<FilaPunto>();
  // CORS abierto: datos públicos para terceros (los writes conservan el CORS restringido).
  c.header("Access-Control-Allow-Origin", "*");
  return c.json(results.map(aPublico));
});

app.get("/:id", async (c) => {
  // Misma visibilidad que la lista: un punto cerrado/falso o con 3+ flags no
  // se sirve por id (los datos no visibles no se exponen por URL directa).
  const res = await c.env.ENLACE_SISMO_DB.prepare(
    "SELECT * FROM puntos_ayuda WHERE id = ? AND estado NOT IN ('cerrado','falso') AND json_array_length(flags) < 3"
  ).bind(c.req.param("id")).first<FilaPunto>();
  if (!res) return c.json({ error: "Punto no encontrado" }, 404);
  c.header("Access-Control-Allow-Origin", "*");
  return c.json(aPublico(res));
});

// ---------- Crear punto de ayuda (ciudadano) ----------
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);
  // Honeypot: si el bot llenó "website", responder 200 silencioso.
  if (body.website) return c.json({ ok: true });
  if (!(await rateLimit(c, "rl:ayuda", 5))) {
    return c.json({ error: "Demasiados reportes. Intenta en una hora." }, 429);
  }

  const tipo = String(body.tipo ?? "");
  if (!TIPOS.includes(tipo)) return c.json({ error: "tipo inválido" }, 400);
  const modalidad = String(body.modalidad ?? "");
  if (!MODALIDADES.includes(modalidad)) return c.json({ error: "modalidad inválida" }, 400);

  const coordenadasNivel = String(body.coordenadas_nivel ?? "");
  if (!["premisa", "via", "barrio"].includes(coordenadasNivel)) {
    return c.json({ error: "coordenadas_nivel debe ser premisa, via o barrio" }, 400);
  }

  const latRaw = body.lat;
  const lngRaw = body.lng;
  if (typeof latRaw !== "number" || !Number.isFinite(latRaw) || latRaw < -90 || latRaw > 90) {
    return c.json({ error: "lat debe ser un número entre -90 y 90" }, 400);
  }
  if (typeof lngRaw !== "number" || !Number.isFinite(lngRaw) || lngRaw < -180 || lngRaw > 180) {
    return c.json({ error: "lng debe ser un número entre -180 y 180" }, 400);
  }

  let items: ReturnType<typeof validarItems>;
  try {
    items = validarItems(body.items);
  } catch (e) {
    return manejarError(c, e);
  }

  const descripcion = String(body.descripcion ?? "").trim();
  if (descripcion.length < 3) {
    return c.json({ error: "descripcion debe tener mínimo 3 caracteres" }, 400);
  }
  const nombre = body.nombre ? String(body.nombre).trim().slice(0, MAX_NOMBRE) : undefined;
  const horario = body.horario ? String(body.horario).trim().slice(0, MAX_HORARIO) : undefined;
  const contacto = body.contacto ? String(body.contacto).trim().slice(0, MAX_CONTACTO) : undefined;

  // Destino de transporte (solo informativo; lo valida el schema).
  let destino: { transporta: boolean; ciudades?: string[]; nota?: string } | undefined;
  if (body.destino !== undefined) {
    const d = body.destino as Record<string, unknown>;
    if (typeof d !== "object" || d === null || typeof d.transporta !== "boolean") {
      return c.json({ error: "destino.transporta debe ser true o false" }, 400);
    }
    const ciudades = Array.isArray(d.ciudades)
      ? d.ciudades.map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, MAX_CIUDADES_DESTINO)
      : [];
    if (ciudades.length > MAX_CIUDADES_DESTINO) {
      return c.json({ error: `Máximo ${MAX_CIUDADES_DESTINO} ciudades de destino` }, 400);
    }
    for (const cd of ciudades) {
      if (cd.length < 2) return c.json({ error: "ciudades de destino inválidas" }, 400);
    }
    destino = { transporta: d.transporta, ciudades };
    if (d.nota !== undefined) destino.nota = String(d.nota).trim().slice(0, MAX_NOTA_DESTINO) || undefined;
  }

  const ip = ipDe(c);
  const ipHash = await hashIp(ip);
  const ahora = new Date().toISOString();
  const token = tokenEdicion();
  const id = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const entrada: Record<string, unknown> = {
    id,
    tipo,
    modalidad,
    lat: latRaw,
    lng: lngRaw,
    coordenadas_nivel: coordenadasNivel,
    descripcion: descripcion.slice(0, MAX_DESCRIPCION),
    items,
    estado: "sin-confirmar",
    flags: [],
    ediciones: [],
    token_hash: await sha256Hex(token),
    ip_hash: ipHash,
    created_at: ahora,
    ultima_actualizacion: ahora,
  };
  if (nombre) entrada.nombre = nombre;
  if (horario) entrada.horario = horario;
  if (contacto) entrada.contacto = contacto;
  if (destino) entrada.destino = destino;

  // Reverse geocode con fallback: lat/lng son la fuente de verdad. La
  // dirección del reportante (si la envió) tiene prioridad.
  const rev = await reverseGeocode(c, latRaw, lngRaw);
  const direccion = body.direccion ? String(body.direccion).trim().slice(0, 300) : rev.direccion;
  if (direccion) entrada.direccion = direccion;
  if (rev.ciudad) {
    const ciudad = normalizarCiudad(rev.ciudad);
    if (ciudad) entrada.ciudad = ciudad;
  }

  if (!valida(entrada)) {
    const err = valida.errors?.[0];
    return c.json(
      { error: `Entrada inválida: ${err?.instancePath ?? "/"} ${err?.message ?? "desconocido"}` },
      400
    );
  }

  try {
    await c.env.ENLACE_SISMO_DB.prepare(
      `INSERT INTO puntos_ayuda (
        id, tipo, modalidad, nombre, lat, lng, coordenadas_nivel, ciudad, direccion,
        descripcion, items, destino, horario, contacto, estado, flags, ediciones,
        token_hash, enlazado_a, ip_hash, created_at, ultima_actualizacion,
        fuente, verificado_por, fecha_verificacion, verificacion
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        entrada.id, entrada.tipo, entrada.modalidad, entrada.nombre ?? null, entrada.lat, entrada.lng,
        entrada.coordenadas_nivel, entrada.ciudad ?? null, entrada.direccion ?? null,
        entrada.descripcion, JSON.stringify(entrada.items), entrada.destino ? JSON.stringify(entrada.destino) : null,
        entrada.horario ?? null, entrada.contacto ?? null, entrada.estado,
        JSON.stringify(entrada.flags), JSON.stringify(entrada.ediciones),
        entrada.token_hash, entrada.enlazado_a ?? null, entrada.ip_hash,
        entrada.created_at, entrada.ultima_actualizacion,
        entrada.fuente ?? null, entrada.verificado_por ?? null, entrada.fecha_verificacion ?? null,
        entrada.verificacion ?? null
      )
      .run();
  } catch (e) {
    console.error("enlace-sismo: error al insertar punto de ayuda", e);
    return c.json({ error: "No se pudo guardar el punto" }, 503);
  }
  return c.json({ ok: true, id, token_edicion: token }, 201);
});

// ---------- Actualizar / cerrar (autor por token o IP) ----------
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);
  // Honeypot
  if (body.website) return c.json({ ok: true });
  if (!(await rateLimit(c, "rl:ayuda-act", 10))) {
    return c.json({ error: "Demasiadas actualizaciones. Espera un momento." }, 429);
  }

  const fila = await filaPorId(c, id);
  if (!fila) return c.json({ error: "Punto no encontrado" }, 404);
  if (!ESTADOS_ACTIVOS.includes(fila.estado)) {
    return c.json({ error: "Este punto ya no está activo" }, 409);
  }

  // Autorización: token de edición (primario) o la misma IP que creó el punto.
  const ipHash = await hashIp(ipDe(c));
  const tokenOk = typeof body.token === "string" && body.token.length > 0 && fila.token_hash
    ? (await sha256Hex(body.token)) === fila.token_hash
    : false;
  if (!tokenOk && ipHash !== fila.ip_hash) {
    return c.json({ error: "No autorizado: este punto no es tuyo" }, 403);
  }

  // Campos editables: items, nombre, descripcion, contacto, horario, destino
  // y el cierre propio (estado: "cerrado").
  // candidata = fila reconstruida + cambios (para la validación Ajv final);
  // sqlSets/sqlBinds = UPDATE con los mismos valores serializados a SQL.
  const candidata = filaAEntrada(fila);
  const sqlSets: string[] = [];
  const sqlBinds: (string | number | null)[] = [];
  const setCampo = (columna: string, valorInterno: unknown, valorSql: string | number | null) => {
    if (valorInterno === null || valorInterno === undefined) {
      delete candidata[columna]; // el schema no admite null: la clave se omite
    } else {
      candidata[columna] = valorInterno;
    }
    sqlSets.push(`${columna} = ?`);
    sqlBinds.push(valorSql);
  };

  if (body.items !== undefined) {
    let items: ReturnType<typeof validarItems>;
    try {
      items = validarItems(body.items);
    } catch (e) {
      return manejarError(c, e);
    }
    setCampo("items", items, JSON.stringify(items));
  }
  if (body.nombre !== undefined) {
    const nombre = body.nombre ? String(body.nombre).trim().slice(0, MAX_NOMBRE) : null;
    setCampo("nombre", nombre, nombre);
  }
  if (body.descripcion !== undefined) {
    const descripcion = String(body.descripcion ?? "").trim();
    if (descripcion.length < 3) return c.json({ error: "descripcion debe tener mínimo 3 caracteres" }, 400);
    setCampo("descripcion", descripcion.slice(0, MAX_DESCRIPCION), descripcion.slice(0, MAX_DESCRIPCION));
  }
  if (body.contacto !== undefined) {
    const contacto = body.contacto ? String(body.contacto).trim().slice(0, MAX_CONTACTO) : null;
    setCampo("contacto", contacto, contacto);
  }
  if (body.horario !== undefined) {
    const horario = body.horario ? String(body.horario).trim().slice(0, MAX_HORARIO) : null;
    setCampo("horario", horario, horario);
  }
  if (body.destino !== undefined) {
    const d = body.destino as Record<string, unknown> | null;
    if (d === null) {
      setCampo("destino", null, null);
    } else {
      if (typeof d !== "object" || typeof d.transporta !== "boolean") {
        return c.json({ error: "destino.transporta debe ser true o false" }, 400);
      }
      const ciudades = Array.isArray(d.ciudades)
        ? d.ciudades.map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, MAX_CIUDADES_DESTINO)
        : [];
      for (const cd of ciudades) {
        if (cd.length < 2) return c.json({ error: "ciudades de destino inválidas" }, 400);
      }
      const destino: Record<string, unknown> = { transporta: d.transporta, ciudades };
      if (d.nota !== undefined) destino.nota = String(d.nota).trim().slice(0, MAX_NOTA_DESTINO) || undefined;
      setCampo("destino", destino, JSON.stringify(destino));
    }
  }

  let nuevoEstado: string | null = null;
  if (body.estado !== undefined) {
    if (body.estado !== "cerrado") {
      return c.json({ error: "El autor solo puede cerrar su punto (estado: cerrado)" }, 400);
    }
    nuevoEstado = "cerrado";
  }

  if (sqlSets.length === 0 && !nuevoEstado) {
    return c.json({ error: "No se enviaron campos para actualizar" }, 400);
  }

  const ediciones = JSON.parse(fila.ediciones ?? "[]") as { ip_hash: string; created_at: string }[];
  ediciones.push({ ip_hash: ipHash, created_at: new Date().toISOString() });
  const ultima = new Date().toISOString();
  setCampo("ediciones", ediciones, JSON.stringify(ediciones));
  setCampo("ultima_actualizacion", ultima, ultima);
  if (nuevoEstado) setCampo("estado", nuevoEstado, nuevoEstado);

  // Cada escritura valida la entrada completa con Ajv (contrato único): el
  // PATCH reconstruye la fila con los cambios y la valida antes del UPDATE
  // (nombre ≥ 3, ciudades ≥ 2, items, destino, etc. — mismo criterio que el POST).
  if (!valida(candidata)) {
    const err = valida.errors?.[0];
    return c.json(
      { error: `Entrada inválida: ${err?.instancePath ?? "/"} ${err?.message ?? "desconocido"}` },
      400
    );
  }

  try {
    await c.env.ENLACE_SISMO_DB.prepare(
      `UPDATE puntos_ayuda SET ${sqlSets.join(", ")} WHERE id = ?`
    ).bind(...sqlBinds, id).run();
  } catch (e) {
    console.error("enlace-sismo: error al actualizar punto de ayuda", e);
    return c.json({ error: "No se pudo actualizar el punto" }, 503);
  }
  return c.json({ ok: true });
});

// ---------- Reportar punto falso (1 por IP; 3+ flags lo ocultan) ----------
app.post("/:id/flag", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const detalle = String(body.detalle ?? "").trim();
  if (detalle.length < 3) {
    return c.json({ error: "detalle es obligatorio (mínimo 3 caracteres)" }, 400);
  }
  if (!(await rateLimit(c, "rl:ayuda-flag", 20))) {
    return c.json({ error: "Demasiados reportes. Espera un momento." }, 429);
  }

  const fila = await filaPorId(c, id);
  if (!fila) return c.json({ error: "Punto no encontrado" }, 404);
  if (!ESTADOS_ACTIVOS.includes(fila.estado)) {
    return c.json({ error: "Este punto ya no está activo" }, 409);
  }

  const ipHash = await hashIp(ipDe(c));
  const flags = JSON.parse(fila.flags) as { detalle: string; ip_hash: string; created_at: string }[];
  if (flags.some((f) => f.ip_hash === ipHash)) {
    return c.json({ error: "Ya reportaste este punto" }, 409);
  }
  const flag = {
    detalle: detalle.slice(0, MAX_DETALLE_FLAG),
    ip_hash: ipHash,
    created_at: new Date().toISOString(),
  };

  try {
    // Append atómico con json_insert: dos flags concurrentes no se pisan.
    await c.env.ENLACE_SISMO_DB.prepare(
      "UPDATE puntos_ayuda SET flags = json_insert(flags, '$[#]', json(?)) WHERE id = ?"
    ).bind(JSON.stringify(flag), id).run();
  } catch (e) {
    console.error("enlace-sismo: error al flaggear punto de ayuda", e);
    return c.json({ error: "No se pudo guardar el reporte" }, 503);
  }
  return c.json({ ok: true });
});

// ---------- Estado y verificación (admin): confirmado / cerrado / falso /
// promovido; al promover se persisten fuente, verificado_por,
// fecha_verificacion y verificacion (regla de oro: la fuente es obligatoria) ----------
app.post("/:id/estado", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token || token !== c.env.ADMIN_TOKEN) return c.json({ error: "No autorizado" }, 401);

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const estado = String(body.estado ?? "");
  if (!ESTADOS_ADMIN.includes(estado)) return c.json({ error: "estado inválido" }, 400);

  const fila = await filaPorId(c, id);
  if (!fila) return c.json({ error: "Punto no encontrado" }, 404);

  // Campos de verificación (opcionales; se persisten solo si vienen en el body).
  const enlazado = body.enlazado_a !== undefined
    ? String(body.enlazado_a).trim().slice(0, MAX_ENLAZADO) || null
    : fila.enlazado_a;
  const fuente = body.fuente !== undefined
    ? String(body.fuente).trim().slice(0, 500) || null
    : fila.fuente;
  const verificadoPor = body.verificado_por !== undefined
    ? String(body.verificado_por).trim().slice(0, 120) || null
    : fila.verificado_por;
  const fechaVerificacion = body.fecha_verificacion !== undefined
    ? String(body.fecha_verificacion).trim() || null
    : fila.fecha_verificacion;
  const verificacion = body.verificacion !== undefined
    ? String(body.verificacion) || null
    : fila.verificacion;

  if (verificacion !== null && !["oficial", "confirmado", "sin-confirmar"].includes(verificacion)) {
    return c.json({ error: "verificacion debe ser oficial, confirmado o sin-confirmar" }, 400);
  }
  if (fechaVerificacion !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fechaVerificacion)) {
    return c.json({ error: "fecha_verificacion debe ser YYYY-MM-DD" }, 400);
  }
  if (fuente !== null && !/^https?:\/\//.test(fuente)) {
    return c.json({ error: "fuente debe ser una URL http(s)" }, 400);
  }
  // Regla de oro: la promoción exige fuente verificable (mismo criterio del CI).
  if (estado === "promovido" && !fuente) {
    return c.json({ error: "fuente es obligatoria al promover un punto" }, 400);
  }

  try {
    await c.env.ENLACE_SISMO_DB.prepare(
      "UPDATE puntos_ayuda SET estado = ?, enlazado_a = ?, fuente = ?, verificado_por = ?, fecha_verificacion = ?, verificacion = ? WHERE id = ?"
    ).bind(estado, enlazado, fuente, verificadoPor, fechaVerificacion, verificacion, id).run();
  } catch (e) {
    console.error("enlace-sismo: error al cambiar estado de punto de ayuda", e);
    return c.json({ error: "No se pudo cambiar el estado" }, 503);
  }
  return c.json({ ok: true });
});

export default app;
