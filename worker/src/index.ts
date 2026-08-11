import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import sugerencias from "./sugerencias";
import alertas from "./alertas";
import reportes from "./reportes";
import upload from "./upload";

type Env = {
  DB: D1Database;
  KV: KVNamespace;
  IMAGENES: R2Bucket;
  ADMIN_TOKEN: string;
  PUBLIC_ORIGIN: string;
  // PAT con scope "issues:write" — crear issues para sugerencias públicas.
  // Configurar como secreto del Worker: wrangler secret put GITHUB_TOKEN
  GITHUB_TOKEN: string;
};

export type Bindings = { Bindings: Env };

const app = new Hono<Bindings>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      const allowed = ["https://enlacesismo.com", "http://localhost:4321", "http://localhost:8787"];
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

app.route("/api/alertas", alertas);
app.route("/api/reportes", reportes);
app.route("/api/upload", upload);
app.route("/api/imagen", upload);
app.route("/api/sugerencias", sugerencias);

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
