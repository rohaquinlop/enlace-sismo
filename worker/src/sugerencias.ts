import { Hono, type Context } from "hono";
import { rateLimit, type Bindings } from "./index";

const app = new Hono<Bindings>();

// Valores de usuario dentro de la tabla Markdown del issue: escapar pipes y
// saltos de línea para no romper filas ni secciones (GitHub no sanea el
// Markdown de la tabla, solo el HTML).
const md = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();


interface SugerenciaSaludBody {
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel: "premisa" | "via" | "barrio";
  tipo: "hospital" | "clinica" | "punto-primeros-auxilios" | "puesto-vacunacion";
  estado: "operativo" | "limitado" | "cerrado" | "sin-confirmar";
  urgencias_24h?: boolean;
  contacto?: string;
  fuente: string;
  website?: string;
}

app.post("/salud", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  if (body.website) return c.json({ ok: true });

  if (!(await rateLimit(c, "rl:salud", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const { nombre, ciudad, departamento, direccion, lat, lng, coordenadas_nivel, tipo, estado, urgencias_24h, contacto, fuente } =
    body as SugerenciaSaludBody;

  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat == null || typeof lat !== "number" || lat < -90 || lat > 90) return c.json({ error: "lat es obligatoria (entre -90 y 90)" }, 400);
  if (lng == null || typeof lng !== "number" || lng < -180 || lng > 180) return c.json({ error: "lng es obligatoria (entre -180 y 180)" }, 400);
  const NIVELES = ["premisa", "via", "barrio"];
  if (!coordenadas_nivel || !NIVELES.includes(coordenadas_nivel)) return c.json({ error: "coordenadas_nivel es obligatorio (premisa/via/barrio)" }, 400);

  const TIPOS = ["hospital", "clinica", "punto-primeros-auxilios", "puesto-vacunacion"];
  if (!tipo || !TIPOS.includes(tipo)) return c.json({ error: "tipo inválido" }, 400);

  const ESTADOS = ["operativo", "limitado", "cerrado", "sin-confirmar"];
  if (estado && !ESTADOS.includes(estado)) return c.json({ error: "estado inválido" }, 400);
  if (!fuente || !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  const sNombre = md(String(nombre).slice(0, 200));
  const sCiudad = md(String(ciudad).slice(0, 80));
  const sDepto = md(String(departamento).slice(0, 80));
  const sDir = md(String(direccion).slice(0, 300));
  const sContacto = contacto ? md(String(contacto).slice(0, 200)) : undefined;
  const sFuente = md(String(fuente).slice(0, 500));
  const sEstado = estado && ESTADOS.includes(estado) ? estado : "sin-confirmar";
  const sNivel = String(coordenadas_nivel);
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  const issueBody = [
    `## Sugerencia de centro de salud`,
    ``,
    `> **${sNombre}** — ${sCiudad}, ${sDepto}`,
    ``,
    `### Datos del centro`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Nombre** | ${sNombre} |`,
    `| **Ciudad** | ${sCiudad} |`,
    `| **Departamento** | ${sDepto} |`,
    `| **Dirección** | ${sDir} |`,
    `| **Latitud** | ${lat} |`,
    `| **Longitud** | ${lng} |`,
    `| **Nivel de precisión** | ${sNivel} |`,
    `| **Tipo** | ${tipo} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Urgencias 24h** | ${urgencias_24h ? "Sí" : "No"} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fuente** | [${sFuente}](<${sFuente}>) |`,
    ``,
    `---`,
    `*Enviado por: ${ip} — ${ahora}*`,
    ``,
    `> Este centro será publicado como **sin confirmar** hasta que un mantenedor verifique la fuente.`,
  ].join("\n");

  const issueTitle = `[salud] ${sNombre} — ${sCiudad}`;

  try {
    const ghRes = await fetch("https://api.github.com/repos/rohaquinlop/enlace-sismo/issues", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "enlace-sismo/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["sugerencia-salud", "sin-verificar"],
      }),
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.text().catch(() => "sin detalle");
      console.error("GitHub API error:", ghRes.status, ghErr);
      return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
    }

    const ghData = (await ghRes.json()) as { html_url: string };
    return c.json({ ok: true, issue_url: ghData.html_url }, 201);
  } catch (err) {
    console.error("Error al crear issue:", err);
    return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
  }
});

// ---------- Albergues ----------

interface SugerenciaAlbergueBody {
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel: "premisa" | "via" | "barrio";
  capacidad?: number;
  ocupacion?: number;
  admite_mascotas?: boolean;
  servicios?: string[];
  estado: "abierto" | "cerrado" | "sin-confirmar";
  contacto?: string;
  fuente: string;
  website?: string;
}

app.post("/albergues", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  if (body.website) return c.json({ ok: true });

  if (!(await rateLimit(c, "rl:albergues", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const { nombre, ciudad, departamento, direccion, lat, lng, coordenadas_nivel, capacidad, ocupacion, admite_mascotas, servicios, estado, contacto, fuente } =
    body as SugerenciaAlbergueBody;

  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat == null || typeof lat !== "number" || lat < -90 || lat > 90) return c.json({ error: "lat es obligatoria (entre -90 y 90)" }, 400);
  if (lng == null || typeof lng !== "number" || lng < -180 || lng > 180) return c.json({ error: "lng es obligatoria (entre -180 y 180)" }, 400);
  const NIVELES = ["premisa", "via", "barrio"];
  if (!coordenadas_nivel || !NIVELES.includes(coordenadas_nivel)) return c.json({ error: "coordenadas_nivel es obligatorio (premisa/via/barrio)" }, 400);
  if (capacidad != null && (typeof capacidad !== "number" || capacidad < 1 || !Number.isInteger(capacidad))) return c.json({ error: "capacidad debe ser un entero mayor a 0" }, 400);
  if (ocupacion != null && (typeof ocupacion !== "number" || ocupacion < 0 || !Number.isInteger(ocupacion))) return c.json({ error: "ocupación debe ser un entero mayor o igual a 0" }, 400);
  if (servicios != null && !Array.isArray(servicios)) return c.json({ error: "servicios debe ser un arreglo" }, 400);

  const ESTADOS = ["abierto", "cerrado", "sin-confirmar"];
  if (estado && !ESTADOS.includes(estado)) return c.json({ error: "estado inválido" }, 400);
  if (!fuente || !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  const sNombre = md(String(nombre).slice(0, 200));
  const sCiudad = md(String(ciudad).slice(0, 80));
  const sDepto = md(String(departamento).slice(0, 80));
  const sDir = md(String(direccion).slice(0, 300));
  const sContacto = contacto ? md(String(contacto).slice(0, 200)) : undefined;
  const sFuente = md(String(fuente).slice(0, 500));
  const sEstado = estado && ESTADOS.includes(estado) ? estado : "sin-confirmar";
  const sNivel = String(coordenadas_nivel);
  const sServicios = servicios ? servicios.map((s) => md(String(s).slice(0, 100))).slice(0, 20) : [];
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  const issueBody = [
    `## Sugerencia de albergue`,
    ``,
    `> **${sNombre}** — ${sCiudad}, ${sDepto}`,
    ``,
    `### Datos del albergue`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Nombre** | ${sNombre} |`,
    `| **Ciudad** | ${sCiudad} |`,
    `| **Departamento** | ${sDepto} |`,
    `| **Dirección** | ${sDir} |`,
    `| **Latitud** | ${lat} |`,
    `| **Longitud** | ${lng} |`,
    `| **Nivel de precisión** | ${sNivel} |`,
    `| **Capacidad** | ${capacidad ?? "no proporcionada"} |`,
    `| **Ocupación** | ${ocupacion ?? "no proporcionada"} |`,
    `| **Admite mascotas** | ${admite_mascotas == null ? "no indicado" : admite_mascotas ? "Sí" : "No"} |`,
    `| **Servicios** | ${sServicios.length ? sServicios.join(", ") : "no indicados"} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fuente** | [${sFuente}](<${sFuente}>) |`,
    ``,
    `---`,
    `*Enviado por: ${ip} — ${ahora}*`,
    ``,
    `> Este albergue será publicado como **sin confirmar** hasta que un mantenedor verifique la fuente.`,
  ].join("\n");

  const issueTitle = `[albergue] ${sNombre} — ${sCiudad}`;

  try {
    const ghRes = await fetch("https://api.github.com/repos/rohaquinlop/enlace-sismo/issues", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "enlace-sismo/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["sugerencia-albergue", "sin-verificar"],
      }),
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.text().catch(() => "sin detalle");
      console.error("GitHub API error:", ghRes.status, ghErr);
      return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
    }

    const ghData = (await ghRes.json()) as { html_url: string };
    return c.json({ ok: true, issue_url: ghData.html_url }, 201);
  } catch (err) {
    console.error("Error al crear issue:", err);
    return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
  }
});

// ---------- Sugerencias de puntos de acopio ----------

interface SugerenciaAcopioBody {
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel: "premisa" | "via" | "barrio";
  tipo?: "oficial-comunal" | "oficial-gobierno" | "no-oficial";
  horario?: string;
  necesidades?: string[];
  detalles?: string;
  estado?: "abierto" | "cerrado" | "sin-confirmar";
  contacto?: string;
  fecha_limite?: string;
  evidencia_links?: string[];
  imagen_url?: string;
  fuente?: string;
  website?: string;
}

app.post("/acopio", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  if (body.website) return c.json({ ok: true });

  if (!(await rateLimit(c, "rl:acopio", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const {
    nombre, ciudad, departamento, direccion, lat, lng, coordenadas_nivel, tipo,
    horario, necesidades, detalles, estado, contacto, fecha_limite,
    evidencia_links, imagen_url, fuente,
  } = body as SugerenciaAcopioBody;

  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat == null || typeof lat !== "number" || lat < -90 || lat > 90) return c.json({ error: "lat es obligatoria (entre -90 y 90)" }, 400);
  if (lng == null || typeof lng !== "number" || lng < -180 || lng > 180) return c.json({ error: "lng es obligatoria (entre -180 y 180)" }, 400);
  const NIVELES = ["premisa", "via", "barrio"];
  if (!coordenadas_nivel || !NIVELES.includes(coordenadas_nivel)) return c.json({ error: "coordenadas_nivel es obligatorio (premisa/via/barrio)" }, 400);
  if (fuente && !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  const sNombre = md(String(nombre).slice(0, 200));
  const sCiudad = md(String(ciudad).slice(0, 80));
  const sDepto = md(String(departamento).slice(0, 80));
  const sDir = md(String(direccion).slice(0, 300));
  const sContacto = contacto ? md(String(contacto).slice(0, 200)) : undefined;
  const sNivel = String(coordenadas_nivel);
  const sHorario = horario ? md(String(horario).slice(0, 200)) : undefined;
  const sDetalles = detalles ? md(String(detalles).slice(0, 1000)) : undefined;
  const sFuente = fuente ? md(String(fuente).slice(0, 500)) : undefined;
  const sEstado = estado || "sin-confirmar";
  const sTipo = tipo || "no-oficial";
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  const NecesidadesLabel: Record<string, string> = {
    "alimentos-no-perecederos": "Alimentos no perecederos",
    agua: "Agua", ropa: "Ropa", medicamentos: "Medicamentos",
    "elementos-aseo": "Elementos de aseo", cobijas: "Cobijas",
    colchonetas: "Colchonetas", "alimentos-bebe": "Alimentos para bebés",
    mascotas: "Mascotas", herramientas: "Herramientas", voluntarios: "Voluntarios",
  };

  const necesidadesStr = necesidades?.length
    ? necesidades.map((n) => NecesidadesLabel[n] ?? n).join(", ")
    : "no especificadas";

  const evidenciaStr = evidencia_links?.length
    ? evidencia_links.map((l) => `[${l}](<${l}>)`).join(", ")
    : "no proporcionada";

  const issueBody = [
    `## Sugerencia de punto de acopio`,
    ``,
    `> **${sNombre}** — ${sCiudad}, ${sDepto}`,
    ``,
    `### Datos del acopio`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Nombre** | ${sNombre} |`,
    `| **Ciudad** | ${sCiudad} |`,
    `| **Departamento** | ${sDepto} |`,
    `| **Dirección** | ${sDir} |`,
    `| **Latitud** | ${lat} |`,
    `| **Longitud** | ${lng} |`,
    `| **Nivel de precisión** | ${sNivel} |`,
    `| **Tipo** | ${sTipo} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Horario** | ${sHorario || "no especificado"} |`,
    `| **Necesidades** | ${necesidadesStr} |`,
    `| **Detalles** | ${sDetalles || "no proporcionados"} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fecha límite** | ${fecha_limite || "no especificada"} |`,
    `| **Evidencia** | ${evidenciaStr} |`,
    `| **Imagen** | ${imagen_url ? `[Ver imagen](${imagen_url})` : "no proporcionada"} |`,
    `| **Fuente** | ${sFuente ? `[${sFuente}](<${sFuente}>)` : "no proporcionada"} |`,
    ``,
    `---`,
    `*Enviado por: ${ip} — ${ahora}*`,
    ``,
    `> Este acopio será publicado como **sin confirmar** hasta que un mantenedor verifique la fuente.`,
  ].join("\n");

  const issueTitle = `[acopio] ${sNombre} — ${sCiudad}`;

  try {
    const ghRes = await fetch("https://api.github.com/repos/rohaquinlop/enlace-sismo/issues", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "enlace-sismo/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["sugerencia-acopio", "sin-verificar"],
      }),
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.text().catch(() => "sin detalle");
      console.error("GitHub API error:", ghRes.status, ghErr);
      return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
    }

    const ghData = (await ghRes.json()) as { html_url: string };
    return c.json({ ok: true, issue_url: ghData.html_url }, 201);
  } catch (err) {
    console.error("Error al crear issue:", err);
    return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
  }
});

// ---------- Sugerencias de jornada de donación de sangre ----------

interface SugerenciaJornadaSangreBody {
  organizador: string;
  punto: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat: number;
  lng: number;
  coordenadas_nivel: "premisa" | "via" | "barrio";
  fecha_inicio: string;
  fecha_fin?: string;
  horario: string;
  grupos?: string[];
  estado: "activa" | "finalizada" | "sin-confirmar";
  contacto?: string;
  fuente: string;
  website?: string;
}

app.post("/donacion-sangre", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  if (body.website) return c.json({ ok: true });

  if (!(await rateLimit(c, "rl:donacion-sangre", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const { organizador, punto, ciudad, departamento, direccion, lat, lng, coordenadas_nivel, fecha_inicio, fecha_fin, horario, grupos, estado, contacto, fuente } =
    body as SugerenciaJornadaSangreBody;

  if (!organizador || String(organizador).length < 3) return c.json({ error: "organizador es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!punto || String(punto).length < 3) return c.json({ error: "punto es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat == null || typeof lat !== "number" || lat < -90 || lat > 90) return c.json({ error: "lat es obligatoria (entre -90 y 90)" }, 400);
  if (lng == null || typeof lng !== "number" || lng < -180 || lng > 180) return c.json({ error: "lng es obligatoria (entre -180 y 180)" }, 400);
  const NIVELES = ["premisa", "via", "barrio"];
  if (!coordenadas_nivel || !NIVELES.includes(coordenadas_nivel)) return c.json({ error: "coordenadas_nivel es obligatorio (premisa/via/barrio)" }, 400);
  if (!fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) return c.json({ error: "fecha_inicio es obligatoria (formato YYYY-MM-DD)" }, 400);
  if (fecha_fin && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) return c.json({ error: "fecha_fin debe tener formato YYYY-MM-DD" }, 400);
  if (!horario || String(horario).length < 3) return c.json({ error: "horario es obligatorio (mínimo 3 caracteres)" }, 400);
  if (grupos != null && !Array.isArray(grupos)) return c.json({ error: "grupos debe ser un arreglo" }, 400);

  const ESTADOS = ["activa", "finalizada", "sin-confirmar"];
  if (estado && !ESTADOS.includes(estado)) return c.json({ error: "estado inválido" }, 400);
  if (!fuente || !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  const sOrganizador = md(String(organizador).slice(0, 200));
  const sPunto = md(String(punto).slice(0, 200));
  const sCiudad = md(String(ciudad).slice(0, 80));
  const sDepto = md(String(departamento).slice(0, 80));
  const sDir = md(String(direccion).slice(0, 300));
  const sHorario = md(String(horario).slice(0, 200));
  const sContacto = contacto ? md(String(contacto).slice(0, 200)) : undefined;
  const sFuente = md(String(fuente).slice(0, 500));
  const sEstado = estado && ESTADOS.includes(estado) ? estado : "sin-confirmar";
  const sNivel = String(coordenadas_nivel);
  const sGrupos = grupos ? grupos.map((g) => md(String(g).slice(0, 20))).slice(0, 10) : [];
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  const fechas = fecha_fin ? `${fecha_inicio} a ${fecha_fin}` : `desde ${fecha_inicio}`;

  const issueBody = [
    `## Sugerencia de jornada de donación de sangre`,
    ``,
    `> **${sPunto}** — ${sCiudad}, ${sDepto}`,
    ``,
    `### Datos de la jornada`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Organizador** | ${sOrganizador} |`,
    `| **Punto de donación** | ${sPunto} |`,
    `| **Ciudad** | ${sCiudad} |`,
    `| **Departamento** | ${sDepto} |`,
    `| **Dirección** | ${sDir} |`,
    `| **Latitud** | ${lat} |`,
    `| **Longitud** | ${lng} |`,
    `| **Nivel de precisión** | ${sNivel} |`,
    `| **Fechas** | ${fechas} |`,
    `| **Horario** | ${sHorario} |`,
    `| **Grupos solicitados** | ${sGrupos.length ? sGrupos.join(", ") : "todos"} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fuente** | [${sFuente}](<${sFuente}>) |`,
    ``,
    `---`,
    `*Enviado por: ${ip} — ${ahora}*`,
    ``,
    `> Esta jornada será publicada como **sin confirmar** hasta que un mantenedor verifique la fuente.`,
  ].join("\n");

  const issueTitle = `[donacion-sangre] ${sPunto} — ${sCiudad}`;

  try {
    const ghRes = await fetch("https://api.github.com/repos/rohaquinlop/enlace-sismo/issues", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "enlace-sismo/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["sugerencia-donacion-sangre", "sin-verificar"],
      }),
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.text().catch(() => "sin detalle");
      console.error("GitHub API error:", ghRes.status, ghErr);
      return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
    }

    const ghData = (await ghRes.json()) as { html_url: string };
    return c.json({ ok: true, issue_url: ghData.html_url }, 201);
  } catch (err) {
    console.error("Error al crear issue:", err);
    return c.json({ error: "No se pudo crear el reporte. Intenta más tarde." }, 502);
  }
});

export default app;
