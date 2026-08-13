// Renderizadores client-side que espejan el markup SSG (desacoplar-datos-
// deploy): el refresco runtime re-renderiza las listas con datos frescos del
// API. Los catálogos de lugares comparten UNA función con el SSG de las
// páginas (renderCatalogoPagina/cardPuntoAyudaHTML). Mantener en sync con:
// JornadaSangreCard, StatusBadge y ZonasLista.
import type { JornadaSangre, CanalAyuda } from "./catalogs";
import type { Zona } from "./zonas";
import type { CiudadReportada } from "./ciudades";
import type { PuntoAyuda } from "./puntos-ayuda";
import { etiquetaTipo, etiquetaModalidadCorta, etiquetaItemAyuda, ESTADOS_AYUDA, etiquetaPrecision } from "./items-ayuda";
import { estadoVerificacion, etiquetaVerificacion } from "./verificacion";
import { haversineKm, formatearDistancia } from "./geo";
import { actualizadoHace } from "./puntos-ayuda";

export const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

// ---------- Espejo de StatusBadge.astro ----------
const BADGES: Record<string, { texto: string; clase: string }> = {
  abierto: { texto: "Abierto", clase: "badge-confirmado" },
  activa: { texto: "Activa", clase: "badge-confirmado" },
  finalizada: { texto: "Finalizada", clase: "badge-cerrado" },
  operativo: { texto: "Operativo", clase: "badge-confirmado" },
  limitado: { texto: "Limitado", clase: "badge-limitado" },
  cerrado: { texto: "Cerrado", clase: "badge-cerrado" },
  oficial: { texto: "Oficial", clase: "badge-oficial" },
  confirmado: { texto: "Confirmado", clase: "badge-confirmado" },
  "sin-confirmar": { texto: "Sin confirmar", clase: "badge-sin-confirmar" },
  promovido: { texto: "Promovido", clase: "badge-confirmado" },
};

export function badgeHTML(estado: string): string {
  const info = BADGES[estado] ?? { texto: estado, clase: "badge-sin-confirmar" };
  return `<span class="badge ${info.clase}">${escapar(info.texto)}</span>`;
}

// ---------- Render unificado de catálogos (PuntoAyuda) ----------
// Los catálogos de lugares (acopios, albergues, centros de salud) son vistas
// del registro unificado de puntos de ayuda (D1): misma tarjeta en el SSG y
// en el refresco runtime (una sola fuente de markup — render-catalogos).

const CLASES_VERIF: Record<string, string> = {
  oficial: "badge-oficial",
  confirmado: "badge-confirmado",
  "sin-confirmar": "badge-sin-confirmar",
};

/** Badges de una entrada del registro: UN badge de verificación en color +
 *  el estado de moderación como texto apagado SOLO cuando aporta (espejo del
 *  panel Ayuda). Un punto sin-confirmar no repite "Sin confirmar" dos veces. */
export function badgesPuntoAyudaHTML(p: PuntoAyuda): string {
  const v = estadoVerificacion(p);
  const estado = ESTADOS_AYUDA[p.estado] ?? p.estado;
  const estadoHtml =
    estado !== etiquetaVerificacion(p) ? `<span class="ayuda-estado">${escapar(estado)}</span>` : "";
  return `<span class="badge ${CLASES_VERIF[v] ?? "badge-sin-confirmar"}">${escapar(etiquetaVerificacion(p))}</span>${estadoHtml}`;
}

/** Etiqueta del sub-tipo para tarjetas ("refugio" → "Refugio", "clinica" → "Clínica"). */
const ETIQUETAS_SUBTIPO: Record<string, string> = {
  refugio: "Refugio",
  albergue: "Albergue",
  clinica: "Clínica",
  hospital: "Hospital",
  "punto-primeros-auxilios": "Punto de primeros auxilios",
  "puesto-vacunacion": "Puesto de vacunación",
};

// Espejo de la síntesis determinista del seed (worker/src/seed-catalogos.ts
// — mantener en sync): esas descripciones no se renderizan en la card (el
// pie de fuente ya comunica el origen; solo el texto del autor aporta).
const DESCRIPCION_SEED = new Set([
  "Punto de acopio verificado — ver fuente.",
  "Albergue verificado — ver fuente.",
  "Refugio verificado — ver fuente.",
  "Centro de salud verificado — ver fuente.",
]);

/** Tarjeta de una entrada del registro (espejo del panel Ayuda del dashboard). */
export function cardPuntoAyudaHTML(p: PuntoAyuda): string {
  // El tipo se muestra UNA sola vez: badge del sub-tipo si existe (Refugio,
  // Clínica), texto del tipo en su ausencia (convención de CatalogCard).
  const tipoLinea =
    p.subtipo && p.subtipo !== p.tipo
      ? `<p class="card-tipo"><span class="badge badge-tipo">${escapar(ETIQUETAS_SUBTIPO[p.subtipo] ?? p.subtipo)}</span></p>`
      : `<p class="card-tipo">${escapar(etiquetaTipo(p.tipo))}</p>`;
  // Rol (modalidad) + precisión del pin en su propia línea: la meta de la
  // card queda corta (ciudad · Cómo llegar) y no rompe a 320 px.
  const rol = `${escapar(etiquetaModalidadCorta(p.modalidad))}${p.coordenadas_nivel ? ` · ${escapar(etiquetaPrecision(p.coordenadas_nivel))}` : ""}`;
  const horario = p.horario ? `<p class="card-dato"><strong>Horario:</strong> ${escapar(p.horario)}</p>` : "";
  const chips =
    p.items.length > 0
      ? `<div class="chips">${p.items.map((i) => `<span class="chip">${escapar(etiquetaItemAyuda(i))}</span>`).join("")}</div>`
      : "";
  const destino = p.destino
    ? `<p class="card-dato"><strong>${p.destino.transporta && p.destino.ciudades.length > 0 ? `Lleva a: ${escapar(p.destino.ciudades.join(", "))}` : "Entrega solo en este punto"}</strong></p>`
    : "";
  const capacidad =
    p.capacidad != null
      ? `<p class="card-dato"><strong>Capacidad:</strong> ${p.capacidad} personas${p.ocupacion != null ? ` · ocupación ${p.ocupacion}` : ""}</p>`
      : "";
  const urgencias =
    p.urgencias_24h !== undefined
      ? `<p class="card-dato"><strong>${p.urgencias_24h ? "Urgencias 24 horas" : "Sin urgencias 24 horas"}</strong></p>`
      : "";
  const mascotas =
    p.admite_mascotas !== undefined
      ? `<p class="card-dato"><strong>${p.admite_mascotas ? "Admite mascotas" : "No admite mascotas"}</strong></p>`
      : "";
  const servicios =
    p.servicios && p.servicios.length > 0
      ? `<p class="card-dato"><strong>Servicios:</strong> ${escapar(p.servicios.join(", "))}</p>`
      : "";
  const contacto = p.contacto ? `<p class="card-dato"><strong>Contacto:</strong> ${escapar(p.contacto)}</p>` : "";
  const evidencia =
    p.evidencia_links && p.evidencia_links.length > 0
      ? `<div class="card-evidencia"><span>Evidencia:</span>${p.evidencia_links
          .map((l, i) => `<a href="${escapar(l)}" target="_blank" rel="noopener">[${i + 1}]</a>`)
          .join("")}</div>`
      : "";
  const recoleccion =
    p.recoleccion_periodica !== undefined
      ? `<p class="card-dato"><strong>${p.recoleccion_periodica ? "Recolección periódica" : "Sin recolección periódica"}</strong>${p.recoleccion_detalle ? ` · ${escapar(p.recoleccion_detalle)}` : ""}</p>`
      : "";
  const imagen =
    p.imagen_url
      ? `<a href="${escapar(p.imagen_url)}" target="_blank" rel="noopener" class="card-imagen-link">Ver imagen</a>`
      : "";
  const flags = p.flags > 0 ? `<p class="card-dato">${p.flags} reporte(s) de falso</p>` : "";
  const actualizado = actualizadoHace(p)
    ? `<p class="card-dato">Actualizado ${escapar(actualizadoHace(p))}</p>`
    : "";
  // La descripción determinista del seed (espejo de worker/src/seed-
  // catalogos.ts — mantener en sync) no se renderiza: el pie de fuente ya
  // comunica el origen; solo la descripción escrita por un autor aporta.
  const descripcion =
    p.descripcion && !DESCRIPCION_SEED.has(p.descripcion)
      ? `<p class="card-detalles">${escapar(p.descripcion)}</p>`
      : "";
  return (
    `<article class="card" id="${escapar(p.id)}">` +
    `<div class="card-head"><h3>${escapar(p.nombre ?? etiquetaTipo(p.tipo))}</h3><span class="card-badges">${badgesPuntoAyudaHTML(p)}</span></div>` +
    tipoLinea +
    `<p class="card-dir">${escapar(p.direccion ?? "")}</p>` +
    `<p class="card-ciudad">${escapar(p.ciudad ?? "")}${p.departamento ? `, ${escapar(p.departamento)}` : ""} · ` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">Cómo llegar</a></p>` +
    `<div class="card-body">${rol ? `<p class="card-dato"><strong>${rol}</strong></p>` : ""}${horario}${chips}${destino}${capacidad}${urgencias}${mascotas}${servicios}` +
    `${descripcion}${recoleccion}${imagen}${contacto}${evidencia}${flags}${actualizado}</div>` +
    `${p.fuente ? `<p class="card-fuente">Fuente: <a href="${escapar(p.fuente)}" target="_blank" rel="noopener">${escapar(p.fuente)}</a></p>` : ""}` +
    `</article>`
  );
}

// ---------- Espejo de JornadaSangreCard.astro ----------
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtDia = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
};

export function cardJornadaHTML(j: JornadaSangre): string {
  const fechas = j.fecha_fin ? `${fmtDia(j.fecha_inicio)} – ${fmtDia(j.fecha_fin)}` : `Desde ${fmtDia(j.fecha_inicio)}`;
  const grupos =
    j.grupos && j.grupos.length > 0
      ? `<div class="chips">${j.grupos
          .map((g) => `<span class="chip">${g === "todos" ? "Todos los grupos" : `Grupo ${escapar(g)}`}</span>`)
          .join("")}</div>`
      : "";
  const contacto = j.contacto ? `<p class="card-dato"><strong>Contacto:</strong> ${escapar(j.contacto)}</p>` : "";
  return (
    `<article class="card">` +
    `<div class="card-head"><h3>${escapar(j.punto)}</h3><span class="card-badges">${badgeHTML(j.estado)}${badgeHTML(j.verificacion)}</span></div>` +
    `<p class="card-tipo">Donación de sangre · ${escapar(j.organizador)}</p>` +
    `<p class="card-dir">${escapar(j.direccion)}</p>` +
    `<p class="card-ciudad">${escapar(j.ciudad)}, ${escapar(j.departamento)} · ` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}" target="_blank" rel="noopener">Cómo llegar</a></p>` +
    `<p class="card-dato"><strong>${escapar(fechas)}</strong> · ${escapar(j.horario)}</p>` +
    grupos +
    contacto +
    `<p class="card-fuente">Fuente: ` +
    `<a href="${escapar(j.fuente)}" target="_blank" rel="noopener">${escapar(j.fuente)}</a></p>` +
    `</article>`
  );
}

// ---------- Agrupación por ciudad (espejo de agruparPorCiudad en catalogs.ts) ----------
function agrupar<T extends { ciudad: string; lat: number; lng: number }>(items: T[]) {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    if (!grupos.has(item.ciudad)) grupos.set(item.ciudad, []);
    grupos.get(item.ciudad)!.push(item);
  }
  return Array.from(grupos.entries())
    .map(([ciudad, items]) => ({
      ciudad,
      items,
      lat: items.reduce((s, i) => s + i.lat, 0) / items.length,
      lng: items.reduce((s, i) => s + i.lng, 0) / items.length,
    }))
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad));
}

interface GrupoOpts {
  /** Atributos extra del .card-item (p. ej. data-verificacion en acopios). */
  cardItemAttrs?: (e: { ciudad: string; verificacion?: string }) => string;
}

function gruposHTML<T extends { ciudad: string; lat: number; lng: number }>(
  items: T[],
  card: (e: T) => string,
  opts: GrupoOpts = {}
): string {
  return agrupar(items)
    .map(
      (g) =>
        `<section class="ciudad-grupo" data-ciudad="${escapar(g.ciudad)}" data-lat="${g.lat}" data-lng="${g.lng}">` +
        `<h2 class="ciudad-titulo">${escapar(g.ciudad)}</h2>` +
        `<div class="grid">` +
        g.items
          .map(
            (e) =>
              `<div class="card-item" data-ciudad="${escapar(e.ciudad)}"${opts.cardItemAttrs ? opts.cardItemAttrs(e) : ""}>${card(e)}</div>`
          )
          .join("") +
        `</div></section>`
    )
    .join("");
}

const VACIO = (titulo: string, texto: string, cta?: string) =>
  `<div class="vacio"><h3>${titulo}</h3><p>${texto}</p>${cta ?? ""}</div>`;

// ---------- Páginas de catálogos unificadas (espejo de acopios/albergues/salud) ----------
// Los catálogos de lugares viven en el registro de puntos de ayuda: la página
// filtra el snapshot/régimen por tipo y renderiza la misma tarjeta del panel.

const VACIOS: Record<string, { titulo: string; texto: string }> = {
  acopio: {
    titulo: "Aún no hay puntos de acopio",
    texto: "Los acopios los publica la comunidad y los confirma el equipo con fuente. Si conoces uno, repórtalo con ubicación e ítems.",
  },
  albergue: {
    titulo: "Aún no hay albergues ni refugios",
    texto: "Los albergues los publica la comunidad y los confirma el equipo con fuente. Si conoces uno, repórtalo con ubicación y capacidad.",
  },
  hospital: {
    titulo: "Aún no hay centros de salud",
    texto: "Los centros de salud los publica la comunidad y los confirma el equipo con fuente. Si conoces uno, repórtalo con ubicación.",
  },
};

const CTA_REPORTAR = `<a class="btn btn-primary" href="/reportar">Reportar una necesidad u oferta</a>`;

/** Agrupa las entradas del registro por ciudad (mismo patrón que las páginas). */
function agruparPuntos(puntos: PuntoAyuda[]) {
  const grupos = new Map<string, PuntoAyuda[]>();
  for (const p of puntos) {
    const ciudad = p.ciudad ?? "";
    if (!grupos.has(ciudad)) grupos.set(ciudad, []);
    grupos.get(ciudad)!.push(p);
  }
  return Array.from(grupos.entries())
    .map(([ciudad, items]) => ({
      ciudad,
      items: [...items].sort((a, b) => (a.nombre ?? a.id).localeCompare(b.nombre ?? b.id, "es")),
      lat: items.reduce((s, i) => s + i.lat, 0) / items.length,
      lng: items.reduce((s, i) => s + i.lng, 0) / items.length,
    }))
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es"));
}

/** Contenido completo de /acopios, /albergues y /salud (SSG y refresco runtime). */
export function renderCatalogoPagina(tipo: "acopio" | "albergue" | "hospital", puntos: PuntoAyuda[]): string {
  const v = VACIOS[tipo];
  if (puntos.length === 0) {
    return VACIO(v.titulo, v.texto, CTA_REPORTAR);
  }
  const grupos = agruparPuntos(puntos);
  const filtros =
    `<div class="filtros"><div class="filtros-controls">` +
    `<label for="filtro-ciudad">Filtrar por ciudad:</label>` +
    `<select id="filtro-ciudad"><option value="">Todas</option>` +
    grupos.map((g) => `<option value="${escapar(g.ciudad)}">${escapar(g.ciudad)}</option>`).join("") +
    `</select>` +
    // Los acopios conservan el filtro de oficiales (verificación del dato).
    (tipo === "acopio"
      ? `<label class="filtro-check"><input type="checkbox" id="filtro-oficiales" /> Puntos de acopio oficiales</label>`
      : "") +
    `</div>` +
    CTA_REPORTAR +
    `</div>`;
  return (
    filtros +
    grupos
      .map(
        (g) =>
          `<section class="ciudad-grupo" data-ciudad="${escapar(g.ciudad)}" data-lat="${g.lat}" data-lng="${g.lng}">` +
          `<h2 class="ciudad-titulo">${escapar(g.ciudad)}</h2>` +
          `<div class="grid">` +
          g.items
            .map(
              (p) =>
                `<div class="card-item" data-ciudad="${escapar(g.ciudad)}"${tipo === "acopio" ? ` data-verificacion="${escapar(p.verificacion ?? "")}"` : ""}>${cardPuntoAyudaHTML(p)}</div>`
            )
            .join("") +
          `</div></section>`
      )
      .join("")
  );
}

export function renderSangrePagina(items: JornadaSangre[]): string {
  if (items.length === 0) {
    return VACIO(
      "Aún no hay jornadas de donación verificadas",
      "Las jornadas oficiales están siendo confirmadas por la Cruz Roja y las alcaldías. Este es un proyecto open-source: si tienes un dato verificado, súbelo y publícalo.",
      `<a class="btn btn-primary" href="https://github.com/rohaquinlop/enlace-sismo/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Agregar una jornada (guía)</a>`
    );
  }
  return gruposHTML(items, (e) => cardJornadaHTML(e));
}

// ---------- Página /ayuda (espejo de ayuda.astro) ----------
export interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  descripcion?: string;
  tipo: string;
}

export function renderAyudaPagina(canales: CanalAyuda[], contactos: Contacto[]): string {
  const grid =
    canales.length === 0
      ? ""
      : `<div class="grid">${canales
          .map(
            (c) =>
              `<article class="card">` +
              `<div class="card-head"><h3>${escapar(c.organizacion)}</h3>${badgeHTML(c.estado)}</div>` +
              `${c.descripcion ? `<p>${escapar(c.descripcion)}</p>` : ""}` +
              `${c.como_aportar ? `<p><strong>Cómo aportar:</strong> ${escapar(c.como_aportar)}</p>` : ""}` +
              `<p>${c.sitio ? `<a href="${escapar(c.sitio)}" target="_blank" rel="noopener">Sitio oficial</a>` : ""}` +
              `${c.redes ? ` · <a href="${escapar(c.redes)}" target="_blank" rel="noopener">Redes</a>` : ""}</p>` +
              `${c.cuenta_bancaria ? `<p><strong>Cuenta bancaria oficial:</strong> ${escapar(c.cuenta_bancaria)}</p>` : ""}` +
              `</article>`
          )
          .join("")}</div>`;
  const emergencias = contactos.filter((c) => c.tipo === "emergencia");
  const tabla =
    emergencias.length === 0
      ? ""
      : `<table class="tabla"><thead><tr><th>Servicio</th><th>Número</th><th>Descripción</th></tr></thead><tbody>` +
        emergencias
          .map(
            (c) =>
              `<tr><td data-label="Servicio"><strong>${escapar(c.nombre)}</strong></td>` +
              `<td data-label="Número"><strong>${escapar(c.telefono)}</strong></td>` +
              `<td data-label="Descripción">${c.descripcion ? escapar(c.descripcion) : ""}</td></tr>`
          )
          .join("") +
        `</tbody></table>`;
  return `<h2>Canales verificados</h2>${grid}<h2>Líneas de emergencia</h2>${tabla}`;
}

// ---------- Panel Zonas del dashboard (espejo de ZonasLista.astro) ----------
const ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const claseDot = (z: Zona) =>
  z.tipo === "epicentro" ? "zona-dot-epicentro" : z.intensidad ? `mercalli-${z.intensidad}` : "zona-dot-ciudad";

const metaFila = (z: Zona, km: number) => {
  const intensidad = z.intensidad ? ROMANOS[z.intensidad] : "Sin reporte";
  return km > 0 ? `${intensidad} · a ${formatearDistancia(km)} del epicentro` : intensidad;
};

export function renderZonasListaHTML(zonas: Zona[], ciudadesReportadas: CiudadReportada[], fecha: string): string {
  const epicentro = zonas.find((z) => z.tipo === "epicentro");
  const filas = zonas.map((z) => ({
    z,
    km: epicentro && z.id !== epicentro.id ? haversineKm(z.lat, z.lng, epicentro.lat, epicentro.lng) : 0,
  }));
  const seccionCiudades =
    ciudadesReportadas.length === 0
      ? ""
      : `<div class="zonas-ciudadanas" id="zonas-ciudadanas">` +
        `<div class="zonas-ciudadanas-head"><span class="zonas-ciudadanas-label">Ciudades con reportes ciudadanos</span>` +
        `<span class="zonas-count" aria-label="${ciudadesReportadas.length} ciudades reportadas">${ciudadesReportadas.length}</span></div>` +
        ciudadesReportadas
          .map(
            (c) =>
              `<button type="button" class="dash-row zona-fila zona-fila-ciudadana" data-ciudad-nombre="${escapar(c.nombre)}" aria-pressed="false" title="Ciudad reportada por ciudadanos — sin intensidad hasta verificación oficial">` +
              `<span class="zona-fila-top"><span class="zona-dot zona-dot-ciudad" aria-hidden="true"></span>` +
              `<span class="zona-fila-nombre">${escapar(c.nombre)}</span>` +
              `<span class="dash-row-chevron" aria-hidden="true">›</span></span>` +
              `<span class="zona-fila-meta">${c.puntos.length} punto${c.puntos.length === 1 ? "" : "s"} · sin confirmar</span>` +
              `<span class="zona-fila-linea">Reportada por ciudadanos · sin intensidad (falta fuente oficial)</span>` +
              `</button>`
          )
          .join("") +
        `</div>`;
  return (
    `<div class="dash-index zonas-overlay">` +
    `<div class="zonas-header"><div class="zonas-titulo">` +
    `<h3>Zonas</h3>` +
    `<span class="zonas-count" aria-label="${filas.length} zonas">${filas.length}</span></div>` +
    `<div class="zonas-escala" aria-label="Escala de intensidad Mercalli, de I a XII">` +
    `<span class="zonas-escala-label">Mercalli I–XII</span><span class="mercalli-ref">` +
    ROMANOS.slice(1)
      .map((r, i) => `<span class="punto mercalli-${i + 1}" title="Intensidad ${r}" aria-hidden="true"></span>`)
      .join("") +
    `<span class="punto punto-zona" title="Sin reporte de intensidad" aria-hidden="true"></span>` +
    `</span></div></div>` +
    filas
      .map(
        ({ z, km }) =>
          `<button type="button" class="dash-row zona-fila" data-zona-id="${escapar(z.id)}" data-tipo="${z.tipo}" aria-pressed="false" title="${z.intensidad ? `Intensidad Mercalli ${ROMANOS[z.intensidad]}` : "Sin reporte de intensidad"}">` +
          `<span class="zona-fila-top"><span class="zona-dot ${claseDot(z)}" aria-hidden="true"></span>` +
          `<span class="zona-fila-nombre">${escapar(z.nombre)}</span>` +
          `<span class="dash-row-chevron" aria-hidden="true">›</span></span>` +
          `<span class="zona-fila-meta">${escapar(metaFila(z, km))}</span>` +
          `<span class="zona-fila-linea">${z.detalle ? escapar(z.detalle) : "Sismo sentido"} · ${escapar(fecha)} · SGC</span>` +
          `<span class="dist-usuario" hidden></span>` +
          `</button>`
      )
      .join("") +
    seccionCiudades +
    `</div>`
  );
}
