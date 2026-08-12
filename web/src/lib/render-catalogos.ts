// Renderizadores client-side que espejan el markup SSG de los catálogos
// (desacoplar-datos-deploy): el refresco runtime re-renderiza las listas con
// datos frescos del API. Mantener en sync con los componentes Astro:
// CatalogCard, JornadaSangreCard, StatusBadge y ZonasLista.
import type { Acopio, Albergue, CentroSalud, JornadaSangre, CanalAyuda } from "./catalogs";
import type { Zona } from "./zonas";
import type { CiudadReportada } from "./ciudades";
import { haversineKm, formatearDistancia } from "./geo";

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
};

export function badgeHTML(estado: string): string {
  const info = BADGES[estado] ?? { texto: estado, clase: "badge-sin-confirmar" };
  return `<span class="badge ${info.clase}">${escapar(info.texto)}</span>`;
}

// ---------- Espejo de CatalogCard.astro ----------
const TIPOS_CARD: Record<string, string> = {
  acopio: "Punto de acopio",
  albergue: "Albergue",
  salud: "Centro de salud",
};
const NECESIDADES: Record<string, string> = {
  "alimentos-no-perecederos": "Alimentos no perecederos",
  agua: "Agua",
  ropa: "Ropa",
  medicamentos: "Medicamentos",
  "elementos-aseo": "Elementos de aseo",
  cobijas: "Cobijas",
  colchonetas: "Colchonetas",
  "alimentos-bebe": "Alimentos para bebés",
  mascotas: "Mascotas",
  herramientas: "Herramientas",
  voluntarios: "Voluntarios",
};
const TIPO_ACOPIO: Record<string, string> = {
  "oficial-comunal": "Oficial comunal",
  "oficial-gobierno": "Oficial gobierno",
  "no-oficial": "No oficial",
};
const TIPO_ALBERGUE: Record<string, string> = {
  albergue: "Albergue",
  refugio: "Refugio",
};

export function cardHTML(tipo: "acopio" | "albergue" | "salud", e: Acopio | Albergue | CentroSalud): string {
  const tipoAcopio =
    tipo === "acopio" && "tipo" in e && e.tipo
      ? `<p class="card-tipo-acopio">${escapar(TIPO_ACOPIO[e.tipo] ?? e.tipo)}</p>`
      : "";
  const tipoAlbergue =
    tipo === "albergue" && "tipo" in e && e.tipo && TIPO_ALBERGUE[e.tipo]
      ? `<p class="card-tipo"><span class="badge badge-tipo">${escapar(TIPO_ALBERGUE[e.tipo])}</span></p>`
      : "";
  const horario =
    "horario" in e && e.horario ? `<p class="card-dato"><strong>Horario:</strong> ${escapar(e.horario)}</p>` : "";
  const necesidades =
    "necesidades" in e && e.necesidades && e.necesidades.length > 0
      ? `<div class="chips">${e.necesidades
          .map((n) => `<span class="chip">${escapar(NECESIDADES[n] ?? n)}</span>`)
          .join("")}</div>`
      : "";
  const detalles = "detalles" in e && e.detalles ? `<p class="card-detalles">${escapar(e.detalles)}</p>` : "";
  const fechaLimite =
    "fecha_limite" in e && e.fecha_limite
      ? `<p class="card-dato"><strong>Recolección hasta:</strong> ${escapar(e.fecha_limite)}</p>`
      : "";
  const capacidad =
    "capacidad" in e && e.capacidad
      ? `<p class="card-dato"><strong>Capacidad:</strong> ${e.capacidad} personas</p>`
      : "";
  const urgencias =
    "urgencias_24h" in e
      ? `<p class="card-dato"><strong>${e.urgencias_24h ? "Urgencias 24 horas" : "Sin urgencias 24 horas"}</strong></p>`
      : "";
  const contacto =
    "contacto" in e && e.contacto ? `<p class="card-dato"><strong>Contacto:</strong> ${escapar(e.contacto)}</p>` : "";
  const imagen =
    "imagen_url" in e && e.imagen_url
      ? `<a href="${escapar(e.imagen_url)}" target="_blank" rel="noopener" class="card-imagen-link">Ver imagen</a>`
      : "";
  const evidencia =
    "evidencia_links" in e && e.evidencia_links && e.evidencia_links.length > 0
      ? `<div class="card-evidencia"><span>Evidencia:</span>${e.evidencia_links
          .map((l, i) => `<a href="${escapar(l)}" target="_blank" rel="noopener">[${i + 1}]</a>`)
          .join("")}</div>`
      : "";
  return (
    `<article class="card" id="${escapar(e.id)}">` +
    `<div class="card-head"><h3>${escapar(e.nombre)}</h3><span class="card-badges">${badgeHTML(e.estado)}${badgeHTML(e.verificacion)}</span></div>` +
    `${tipo === "acopio" ? `<p class="card-tipo">${TIPOS_CARD[tipo]}</p>` : ""}` +
    tipoAcopio +
    tipoAlbergue +
    `<p class="card-dir">${escapar(e.direccion)}</p>` +
    `<p class="card-ciudad">${escapar(e.ciudad)}, ${escapar(e.departamento)} · ` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}" target="_blank" rel="noopener">Cómo llegar</a></p>` +
    `<div class="card-body">${horario}${necesidades}${detalles}${fechaLimite}${capacidad}${urgencias}${contacto}${imagen}${evidencia}</div>` +
    `<p class="card-fuente">Fuente: ` +
    `<a href="${escapar(e.fuente)}" target="_blank" rel="noopener">${escapar(e.fuente)}</a></p>` +
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

// ---------- Páginas de catálogos (espejo de acopios/albergues/salud/donar-sangre) ----------
const FILTROS_CIUDAD = (ciudades: string[]) =>
  `<div class="filtros"><div class="filtros-controls">` +
  `<label for="filtro-ciudad">Filtrar por ciudad:</label>` +
  `<select id="filtro-ciudad"><option value="">Todas</option>` +
  ciudades.map((c) => `<option value="${escapar(c)}">${escapar(c)}</option>`).join("") +
  `</select>`;

export function renderAcopiosPagina(items: Acopio[]): string {
  if (items.length === 0) {
    return VACIO(
      "Aún no hay puntos de acopio verificados",
      "Los acopios oficiales están siendo confirmados por alcaldías y UNGRD. Este es un proyecto open-source: si tienes un dato verificado, súbelo y publícalo.",
      `<a class="btn btn-primary" href="/acopios/sugerir-acopio">Sugerir un punto de acopio</a>` +
        `<a class="btn" href="https://github.com/rohaquinlop/enlace-sismo/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" style="margin-top:var(--space-xs)">Agregar un acopio (guía)</a>`
    );
  }
  const ciudades = agrupar(items).map((g) => g.ciudad);
  return (
    FILTROS_CIUDAD(ciudades) +
    `<label class="filtro-check"><input type="checkbox" id="filtro-oficiales" /> Puntos de acopio oficiales</label>` +
    `</div>` +
    `<a class="btn btn-primary" href="/acopios/sugerir-acopio">Sugerir un punto de acopio</a></div>` +
    gruposHTML(items, (e) => cardHTML("acopio", e), {
      cardItemAttrs: (e) => ` data-verificacion="${escapar(e.verificacion ?? "")}"`,
    })
  );
}

export function renderAlberguesPagina(items: Albergue[]): string {
  if (items.length === 0) {
    return VACIO(
      "Aún no hay albergues verificados",
      "Los albergues oficiales están siendo confirmados por alcaldías y UNGRD. ¿Tienes un dato verificado? Súbelo al repositorio.",
      `<a class="btn btn-primary" href="/albergues/sugerir-albergue">Sugerir un albergue</a>`
    );
  }
  return (
    FILTROS_CIUDAD(agrupar(items).map((g) => g.ciudad)) +
    `</div>` +
    `<a class="btn btn-primary" href="/albergues/sugerir-albergue">Sugerir un albergue</a></div>` +
    gruposHTML(items, (e) => cardHTML("albergue", e))
  );
}

export function renderSaludPagina(items: CentroSalud[]): string {
  if (items.length === 0) {
    return VACIO(
      "Aún no hay centros de salud verificados",
      "Se está confirmando el estado de la red hospitalaria con las secretarías de salud. ¿Tienes un dato verificado? Súbelo al repositorio.",
      `<a class="btn btn-primary" href="/salud/sugerir-centro-salud">Sugerir un centro de salud</a>` +
        `<a class="btn" href="https://github.com/rohaquinlop/enlace-sismo/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" style="margin-top:var(--space-xs)">Agregar un centro (guía)</a>`
    );
  }
  return (
    FILTROS_CIUDAD(agrupar(items).map((g) => g.ciudad)) +
    `</div>` +
    `<a class="btn btn-primary" href="/salud/sugerir-centro-salud">Sugerir un centro de salud</a></div>` +
    gruposHTML(items, (e) => cardHTML("salud", e))
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
    `<h3>Zonas afectadas</h3>` +
    `<span class="zonas-count" aria-label="${filas.length} zonas afectadas">${filas.length}</span></div>` +
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
