import { Hono } from "hono";
import { rateLimit, type Bindings } from "./index";

const app = new Hono<Bindings>();

app.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, titulo, contenido, fuente, prioridad, created_at FROM alertas ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json(results);
});

app.post("/", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token || token !== c.env.ADMIN_TOKEN) return c.json({ error: "No autorizado" }, 401);

  if (!(await rateLimit(c, "rl:alertas", 10))) {
    return c.json({ error: "Demasiadas alertas. Espera un momento." }, 429);
  }

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

export default app;
