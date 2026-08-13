import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import upload from "./upload";
import puntos from "./puntos";
import ayuda from "./ayuda";
import geocodificar from "./geocodificar";
import datos from "./datos";

type Env = {
  KV: KVNamespace;
  IMAGENES: R2Bucket;
  ADMIN_TOKEN: string;
  PUBLIC_ORIGIN: string;
  // Base de datos de los puntos de ayuda (D1): migración 0001_puntos-ayuda.
  ENLACE_SISMO_DB: D1Database;
  // Un solo fine-grained PAT sobre el repo: commit del registro en vivo de
  // puntos de rescate (github.ts → web/public/datos/reportes-puntos.json) y
  // subida del rate limit de lectura de catálogos (datos.ts). El flujo de
  // sugerencias por issues se retiró (cambio catalogos-comunitarios): los
  // catálogos de lugares entran por /api/ayuda + moderación. Configurar como
  // secreto del Worker: wrangler secret put GITHUB_TOKEN. Documentado en AGENTS.md.
  GITHUB_TOKEN: string;
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
        "https://enlace-sismo.pages.dev",
        "http://localhost:4321",
        "http://localhost:8787",
        "http://127.0.0.1:4321",
        "http://127.0.0.1:8787",
      ];
      return allowed.includes(origin) ? origin : "https://enlacesismo.com";
    },
    allowMethods: ["GET", "POST", "PATCH"],
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

app.get("/api/health", (c) => c.json({ ok: true, servicio: "enlace-sismo-api", v: "cors-fix" }));

app.route("/api/upload", upload);
app.route("/api/imagen", upload);

// ---------- Puntos de rescate (registro en vivo, GitHub como almacén) ----------
app.route("/api/puntos", puntos);

// ---------- Puntos de ayuda (registro en vivo, D1 + API público) ----------
app.route("/api/ayuda", ayuda);

// ---------- Geocodificación para el formulario de reporte ----------
app.route("/api/geocodificar", geocodificar);

// ---------- Lectura de catálogos y registro en vivo (GitHub como almacén) ----------
app.route("/api/datos", datos);

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
