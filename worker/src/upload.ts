import { Hono } from "hono";
import type { Bindings } from "./index";

const app = new Hono<Bindings>();

app.post("/", async (c) => {
  try {
    const contentType = c.req.header("content-type") ?? "";
    const fileName = c.req.header("x-file-name") ?? "imagen.jpg";

    let fileBuffer: ArrayBuffer;
    let fileType: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      // workers-types declara get() como string | null; en runtime es File.
      const file = formData.get("imagen") as unknown as File | null;
      if (!file || !(file instanceof File)) return c.json({ error: "No se envió imagen" }, 400);
      fileBuffer = await file.arrayBuffer();
      fileType = file.type;
    } else {
      fileBuffer = await c.req.arrayBuffer();
      fileType = contentType;
    }

    if (fileBuffer.byteLength > 5 * 1024 * 1024) {
      return c.json({ error: "La imagen no puede superar 5MB" }, 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(fileType)) {
      return c.json({ error: `Formato no permitido: ${fileType}` }, 400);
    }

    const ext = fileName.split(".").pop() ?? "jpg";
    const key = `acopios/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await c.env.IMAGENES.put(key, fileBuffer, {
      httpMetadata: { contentType: fileType },
    });

    const origin = c.env.PUBLIC_ORIGIN || new URL(c.req.url).origin;
    const publicUrl = `${origin}/api/imagen/${key}`;
    return c.json({ ok: true, url: publicUrl, key });
  } catch (err) {
    console.error("Error en upload:", err);
    return c.json({ error: "Error interno al subir imagen" }, 500);
  }
});

app.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  if (!key || key.includes("..")) return c.json({ error: "Key inválida" }, 400);
  const obj = await c.env.IMAGENES.get(key);
  if (!obj) return c.json({ error: "No encontrada" }, 404);
  return new Response(obj.body, {
    headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream" },
  });
});

export default app;
