import { Hono, type Context } from "hono";
import { rateLimit, type Bindings } from "./index";

const app = new Hono<Bindings>();

interface SugerenciaSaludBody {
  nombre: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  lat?: number;
  lng?: number;
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

  // Honeypot: si el bot llenó "website", devolver 200 silencioso.
  if (body.website) return c.json({ ok: true });

  // Rate limit: 5 por IP por hora.
  if (!(await rateLimit(c, "rl:salud", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const { nombre, ciudad, departamento, direccion, lat, lng, tipo, estado, urgencias_24h, contacto, fuente } =
    body as SugerenciaSaludBody;

  // Validación de campos obligatorios.
  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat != null && (typeof lat !== "number" || lat < -90 || lat > 90)) return c.json({ error: "lat debe estar entre -90 y 90" }, 400);
  if (lng != null && (typeof lng !== "number" || lng < -180 || lng > 180)) return c.json({ error: "lng debe estar entre -180 y 180" }, 400);

  const TIPOS = ["hospital", "clinica", "punto-primeros-auxilios", "puesto-vacunacion"];
  if (!tipo || !TIPOS.includes(tipo)) return c.json({ error: "tipo inválido" }, 400);

  const ESTADOS = ["operativo", "limitado", "cerrado", "sin-confirmar"];
  if (estado && !ESTADOS.includes(estado)) return c.json({ error: "estado inválido" }, 400);
  if (!fuente || !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  // Sanitización con caps.
  const sNombre = String(nombre).slice(0, 200);
  const sCiudad = String(ciudad).slice(0, 80);
  const sDepto = String(departamento).slice(0, 80);
  const sDir = String(direccion).slice(0, 300);
  const sContacto = contacto ? String(contacto).slice(0, 200) : undefined;
  const sFuente = String(fuente).slice(0, 500);
  const sEstado = estado && ESTADOS.includes(estado) ? estado : "sin-confirmar";
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  // Construir issue body con markdown formateado.
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
    `| **Latitud** | ${lat ?? "no proporcionada"} |`,
    `| **Longitud** | ${lng ?? "no proporcionada"} |`,
    `| **Tipo** | ${tipo} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Urgencias 24h** | ${urgencias_24h ? "Sí" : "No"} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fuente** | [${sFuente}](${sFuente}) |`,
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
  lat?: number;
  lng?: number;
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

  // Honeypot: si el bot llenó "website", devolver 200 silencioso.
  if (body.website) return c.json({ ok: true });

  // Rate limit: 5 por IP por hora.
  if (!(await rateLimit(c, "rl:albergues", 5))) {
    return c.json({ error: "Demasiadas sugerencias. Intenta en una hora." }, 429);
  }

  const { nombre, ciudad, departamento, direccion, lat, lng, capacidad, ocupacion, admite_mascotas, servicios, estado, contacto, fuente } =
    body as SugerenciaAlbergueBody;

  // Validación de campos obligatorios.
  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat != null && (typeof lat !== "number" || lat < -90 || lat > 90)) return c.json({ error: "lat debe estar entre -90 y 90" }, 400);
  if (lng != null && (typeof lng !== "number" || lng < -180 || lng > 180)) return c.json({ error: "lng debe estar entre -180 y 180" }, 400);
  if (capacidad != null && (typeof capacidad !== "number" || capacidad < 1 || !Number.isInteger(capacidad))) return c.json({ error: "capacidad debe ser un entero mayor a 0" }, 400);
  if (ocupacion != null && (typeof ocupacion !== "number" || ocupacion < 0 || !Number.isInteger(ocupacion))) return c.json({ error: "ocupación debe ser un entero mayor o igual a 0" }, 400);
  if (servicios != null && !Array.isArray(servicios)) return c.json({ error: "servicios debe ser un arreglo" }, 400);

  const ESTADOS = ["abierto", "cerrado", "sin-confirmar"];
  if (estado && !ESTADOS.includes(estado)) return c.json({ error: "estado inválido" }, 400);
  if (!fuente || !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  // Sanitización con caps.
  const sNombre = String(nombre).slice(0, 200);
  const sCiudad = String(ciudad).slice(0, 80);
  const sDepto = String(departamento).slice(0, 80);
  const sDir = String(direccion).slice(0, 300);
  const sContacto = contacto ? String(contacto).slice(0, 200) : undefined;
  const sFuente = String(fuente).slice(0, 500);
  const sEstado = estado && ESTADOS.includes(estado) ? estado : "sin-confirmar";
  const sServicios = servicios ? servicios.map((s) => String(s).slice(0, 100)).slice(0, 20) : [];
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const ahora = new Date().toISOString();

  // Construir issue body con markdown formateado.
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
    `| **Latitud** | ${lat ?? "no proporcionada"} |`,
    `| **Longitud** | ${lng ?? "no proporcionada"} |`,
    `| **Capacidad** | ${capacidad ?? "no proporcionada"} |`,
    `| **Ocupación** | ${ocupacion ?? "no proporcionada"} |`,
    `| **Admite mascotas** | ${admite_mascotas == null ? "no indicado" : admite_mascotas ? "Sí" : "No"} |`,
    `| **Servicios** | ${sServicios.length ? sServicios.join(", ") : "no indicados"} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fuente** | [${sFuente}](${sFuente}) |`,
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
  lat?: number;
  lng?: number;
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
    nombre, ciudad, departamento, direccion, lat, lng, tipo,
    horario, necesidades, detalles, estado, contacto, fecha_limite,
    evidencia_links, imagen_url, fuente,
  } = body as SugerenciaAcopioBody;

  if (!nombre || String(nombre).length < 3) return c.json({ error: "nombre es obligatorio (mínimo 3 caracteres)" }, 400);
  if (!ciudad || String(ciudad).length < 2) return c.json({ error: "ciudad es obligatoria (mínimo 2 caracteres)" }, 400);
  if (!departamento || String(departamento).length < 2) return c.json({ error: "departamento es obligatorio (mínimo 2 caracteres)" }, 400);
  if (!direccion || String(direccion).length < 5) return c.json({ error: "dirección es obligatoria (mínimo 5 caracteres)" }, 400);
  if (lat != null && (typeof lat !== "number" || lat < -90 || lat > 90)) return c.json({ error: "lat debe estar entre -90 y 90" }, 400);
  if (lng != null && (typeof lng !== "number" || lng < -180 || lng > 180)) return c.json({ error: "lng debe estar entre -180 y 180" }, 400);
  if (fuente && !/^https?:\/\//.test(fuente)) return c.json({ error: "fuente debe ser una URL válida" }, 400);

  const sNombre = String(nombre).slice(0, 200);
  const sCiudad = String(ciudad).slice(0, 80);
  const sDepto = String(departamento).slice(0, 80);
  const sDir = String(direccion).slice(0, 300);
  const sContacto = contacto ? String(contacto).slice(0, 200) : undefined;
  const sHorario = horario ? String(horario).slice(0, 200) : undefined;
  const sDetalles = detalles ? String(detalles).slice(0, 1000) : undefined;
  const sFuente = fuente ? String(fuente).slice(0, 500) : undefined;
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
    ? evidencia_links.map((l) => `[${l}](${l})`).join(", ")
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
    `| **Latitud** | ${lat ?? "no proporcionada"} |`,
    `| **Longitud** | ${lng ?? "no proporcionada"} |`,
    `| **Tipo** | ${sTipo} |`,
    `| **Estado** | ${sEstado} |`,
    `| **Horario** | ${sHorario || "no especificado"} |`,
    `| **Necesidades** | ${necesidadesStr} |`,
    `| **Detalles** | ${sDetalles || "no proporcionados"} |`,
    `| **Contacto** | ${sContacto || "no proporcionado"} |`,
    `| **Fecha límite** | ${fecha_limite || "no especificada"} |`,
    `| **Evidencia** | ${evidenciaStr} |`,
    `| **Imagen** | ${imagen_url ? `[Ver imagen](${imagen_url})` : "no proporcionada"} |`,
    `| **Fuente** | ${sFuente ? `[${sFuente}](${sFuente})` : "no proporcionada"} |`,
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

export default app;
