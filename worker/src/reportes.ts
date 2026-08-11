import { Hono } from "hono";
import { rateLimit, type Bindings } from "./index";

const app = new Hono<Bindings>();

app.post("/", async (c) => {
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

export default app;
