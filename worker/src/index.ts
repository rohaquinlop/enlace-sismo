import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import sugerencias from "./sugerencias";
import puntos from "./puntos";
import geocodificar from "./geocodificar";

type Env = {
  DB: D1Database;
  KV: KVNamespace;
  ADMIN_TOKEN: string;
  PUBLIC_ORIGIN: string;
  GITHUB_TOKEN: string;
  // PAT con scope contents:write — commitea el registro en vivo de puntos de
  // rescate (web/public/datos/reportes-puntos.json). Documentado en AGENTS.md.
  GITHUB_BOT_TOKEN: string;
  // Repo destino del registro (solo para deploys desde fork; default abajo).
  GITHUB_REPO?: string;
};

export type Bindings = { Bindings: Env };

const app = new Hono<Bindings>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      const allowed = [
        "https://enlacesismo.com",
        "http://localhost:4321",
        "http://localhost:8787",
        "http://127.0.0.1:4321",
        "http://127.0.0.1:8787",
      ];
      return allowed.includes(origin) ? origin : "https://enlacesismo.com";
    },
    allowMethods: ["GET", "POST"],
  })
);

export async function rateLimit(c: Context<Bindings>, key: string, max: number): Promise<boolean> {
  const ip = c.req.header("cf-connecting-ip") ?? "local-dev";
  const isLocal = ip === "local-dev";
  const effectiveMax = isLocal ? 50 : max;
  const bucket = `${key}:${ip}:${new Date().toISOString().slice(0, 13)}`;
  const count = Number((await c.env.KV.get(bucket)) ?? "0");
  if (count >= effectiveMax) return false;
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

// ---------- Sugerencias ----------
app.route("/api/sugerencias", sugerencias);

// ---------- Puntos de rescate (registro en vivo) ----------
app.route("/api/puntos", puntos);

// ---------- Geocodificación para el formulario de reporte ----------
app.route("/api/geocodificar", geocodificar);

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
