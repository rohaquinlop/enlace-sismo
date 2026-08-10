import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

type Env = {
  DB: D1Database;
  KV: KVNamespace;
  ADMIN_TOKEN: string;
  PUBLIC_ORIGIN: string;
};

type Bindings = { Bindings: Env };

const app = new Hono<Bindings>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      const allowed = ["https://enlacesismo.app", "http://localhost:4321", "http://localhost:8787"];
      return allowed.includes(origin) ? origin : "https://enlacesismo.app";
    },
    allowMethods: ["GET", "POST"],
  })
);

// Límite de escrituras por IP: 5 reportes de desaparecidos / hora.
async function rateLimit(c: Context<Bindings>, key: string, max: number): Promise<boolean> {
  const ip = c.req.header("cf-connecting-ip") ?? "anon";
  const bucket = `${key}:${ip}:${new Date().toISOString().slice(0, 13)}`;
  const count = Number((await c.env.KV.get(bucket)) ?? "0");
  if (count >= max) return false;
  await c.env.KV.put(bucket, String(count + 1), { expirationTtl: 3600 });
  return true;
}

app.get("/api/health", (c) => c.json({ ok: true, servicio: "enlace-sismo-api" }));

// ---------- Alertas oficiales ----------
app.get("/api/alertas", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, titulo, contenido, fuente, prioridad, created_at FROM alertas ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json(results);
});

app.post("/api/alertas", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token || token !== c.env.ADMIN_TOKEN) return c.json({ error: "No autorizado" }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const { titulo, contenido, fuente, prioridad = "normal", creado_por = "admin" } = body;
  if (!titulo || !contenido || !fuente) {
    return c.json({ error: "titulo, contenido y fuente son obligatorios" }, 400);
  }
  if (!/^https?:\/\//.test(fuente)) {
    return c.json({ error: "la fuente debe ser una URL oficial" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT INTO alertas (titulo, contenido, fuente, prioridad, creado_por) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(String(titulo).slice(0, 200), String(contenido).slice(0, 2000), fuente, String(prioridad).slice(0, 20), String(creado_por).slice(0, 80))
    .run();
  return c.json({ ok: true });
});

// ---------- Personas desaparecidas ----------
app.get("/api/desaparecidos", async (c) => {
  const estado = c.req.query("estado") ?? "buscando";
  const { results } = await c.env.DB.prepare(
    "SELECT id, nombre, edad, ciudad, lugar, fecha, descripcion, estado, created_at FROM desaparecidos WHERE estado = ? ORDER BY created_at DESC LIMIT 200"
  )
    .bind(estado)
    .all();
  return c.json(results);
});

app.post("/api/desaparecidos", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const { nombre, edad, ciudad, lugar, fecha, descripcion, contacto } = body;
  if (!nombre || !ciudad || !contacto) {
    return c.json({ error: "nombre, ciudad y contacto son obligatorios" }, 400);
  }
  if (!(await rateLimit(c, "rl:desaparecidos", 5))) {
    return c.json({ error: "Demasiados reportes desde esta conexión. Espera una hora." }, 429);
  }

  const info = await c.env.DB.prepare(
    "INSERT INTO desaparecidos (nombre, edad, ciudad, lugar, fecha, descripcion, contacto) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      String(nombre).slice(0, 120),
      edad ? Number(edad) : null,
      String(ciudad).slice(0, 80),
      lugar ? String(lugar).slice(0, 200) : null,
      fecha ? String(fecha).slice(0, 10) : null,
      descripcion ? String(descripcion).slice(0, 500) : null,
      String(contacto).slice(0, 120)
    )
    .run();
  return c.json({ ok: true, id: info.meta.last_row_id });
});

// ---------- Reportes de datos incorrectos ----------
app.post("/api/reportes", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "JSON inválido" }, 400);

  const { tipo, ref_id, detalle } = body;
  if (!tipo || !detalle) return c.json({ error: "tipo y detalle son obligatorios" }, 400);
  if (!(await rateLimit(c, "rl:reportes", 20))) {
    return c.json({ error: "Demasiados reportes. Espera un momento." }, 429);
  }

  await c.env.DB.prepare("INSERT INTO reportes (tipo, ref_id, detalle) VALUES (?, ?, ?)")
    .bind(String(tipo).slice(0, 40), ref_id ? String(ref_id).slice(0, 80) : null, String(detalle).slice(0, 1000))
    .run();
  return c.json({ ok: true });
});

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
