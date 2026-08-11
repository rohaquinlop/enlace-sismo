#!/usr/bin/env node
/**
 * Lee publicaciones de X/Twitter sin necesidad de cuenta ni screenshots.
 * Fuentes: api.fxtwitter.com (JSON completo) + oEmbed público de Twitter.
 *
 * Uso:
 *   node scripts/leer-redes.mjs <URL de X>          # texto + media del post
 *   node scripts/leer-redes.mjs @handle             # últimos tweets del usuario
 *   node scripts/leer-redes.mjs <URL> --descargar   # además baja las fotos a capturas/redes/
 *
 * La salida es evidencia SIN VERIFICAR: el mantenedor decide si el post es la
 * fuente oficial antes de usarlo en data/*.json.
 * Si X falla (API caída), el flujo alternativo es: screenshot en capturas/ + URL en .txt.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "Mozilla/5.0 (enlace-sismo; lectura de anuncios oficiales)" };

async function porId(id) {
  const r = await fetch(`https://api.fxtwitter.com/status/${id}`, { headers: UA, signal: AbortSignal.timeout(20000) });
  const d = await r.json();
  if (!d.tweet) throw new Error(d.message || "tweet no encontrado");
  return d.tweet;
}

async function porUsuario(handle) {
  const r = await fetch(`https://api.fxtwitter.com/user/${handle.replace(/^@/, "")}`, { headers: UA, signal: AbortSignal.timeout(20000) });
  const d = await r.json();
  if (!d.user) throw new Error(d.message || "usuario no encontrado");
  return d;
}

function formatearPost(t) {
  const lineas = [];
  lineas.push(`@${t.author.screen_name} — ${t.author.name}`);
  lineas.push(`fecha: ${new Date(t.created_at).toISOString().slice(0, 16)} UTC · id: ${t.id}`);
  lineas.push(`URL: ${t.url}`);
  lineas.push("TEXTO:");
  lineas.push(t.text);
  if (t.media?.all?.length) {
    lineas.push(`MEDIA (${t.media.all.length}):`);
    for (const m of t.media.all) lineas.push(`  ${m.type}: ${m.url}`);
  }
  return lineas.join("\n");
}

const arg = process.argv[2];
if (!arg) { console.error("uso: node scripts/leer-redes.mjs <URL|@handle> [--descargar]"); process.exit(1); }
const descargar = process.argv.includes("--descargar");

try {
  if (arg.startsWith("@")) {
    const d = await porUsuario(arg);
    console.log(`== @${d.user.screen_name} (${d.user.name}) — ${d.user.tweets ?? "?"} tweets en caché ==`);
    for (const t of (d.tweets ?? []).slice(0, 10)) {
      console.log(`\n--- ${new Date(t.created_at).toISOString().slice(0, 10)} | ${t.id}`);
      console.log(t.text.replace(/\n+/g, " ").slice(0, 250));
      if (descargar && t.media?.all) await Promise.all(
        t.media.all.filter((m) => m.type === "photo").map(async (m, i) => {
          const ext = m.url.includes("?") ? ".jpg" : ".jpg";
          mkdirSync("capturas/redes", { recursive: true });
          const res = await fetch(m.url, { headers: UA, signal: AbortSignal.timeout(30000) });
          const buf = Buffer.from(await res.arrayBuffer());
          const f = join("capturas/redes", `${t.id}-${i}${ext}`);
          writeFileSync(f, buf);
          console.log(`  ↓ foto: ${f}`);
        })
      );
      await sleep(400);
    }
  } else {
    const m = arg.match(/status\/(\d+)/);
    if (!m) throw new Error("URL no reconocida — debe contener /status/<id>");
    const t = await porId(m[1]);
    console.log(formatearPost(t));
    if (descargar && t.media?.all) {
      mkdirSync("capturas/redes", { recursive: true });
      for (const md of t.media.all.filter((x) => x.type === "photo")) {
        const res = await fetch(md.url, { headers: UA, signal: AbortSignal.timeout(30000) });
        const f = join("capturas/redes", `${t.id}-${t.author.screen_name}.jpg`);
        writeFileSync(f, Buffer.from(await res.arrayBuffer()));
        console.log(`↓ foto: ${f}`);
      }
    }
  }
} catch (e) {
  console.error(`FALLO: ${e.message}`);
  console.error("Alternativa: captura de pantalla en capturas/ + URL del post en un .txt junto a la imagen.");
  process.exit(1);
}
