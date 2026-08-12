#!/usr/bin/env node
/**
 * Valida los datos de la plataforma antes de cada merge (CI).
 * Regla de oro: TODO dato debe tener fuente verificable (fuente, verificado_por, fecha_verificacion).
 * Sin esos campos, el PR queda bloqueado.
 *
 * Uso: node scripts/validate-data.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const schemaDir = join(dataDir, "schema");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

// Carga el esquema base compartido (verificado.schema.json)
const baseSchema = JSON.parse(readFileSync(join(schemaDir, "verificado.schema.json"), "utf8"));
ajv.addSchema(baseSchema);

const CATALOGOS = [
  { file: "acopios.json", schema: "acopio.schema.json", key: "acopios" },
  { file: "albergues.json", schema: "albergue.schema.json", key: "albergues" },
  { file: "centros-salud.json", schema: "centro-salud.schema.json", key: "centros" },
  { file: "donacion-sangre.json", schema: "jornada-sangre.schema.json", key: "jornadas" },
  { file: "contactos.json", schema: "contacto.schema.json", key: null },
  { file: "canales-ayuda.json", schema: "canal-ayuda.schema.json", key: null },
  { file: "zonas-afectadas.json", schema: "zonas.schema.json", key: null },
];

let errors = 0;
let totalEntries = 0;

function fail(msg) {
  errors++;
  console.error(`  ✗ ${msg}`);
}

for (const cat of CATALOGOS) {
  const file = join(dataDir, cat.file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`${cat.file}: JSON inválido — ${e.message}`);
    continue;
  }

  const entries = cat.key ? (doc[cat.key] ?? []) : doc;
  if (!Array.isArray(entries)) {
    fail(`${cat.file}: debe contener un arreglo${cat.key ? ` en "${cat.key}"` : ""}`);
    continue;
  }

  const validate = ajv.compile(
    JSON.parse(readFileSync(join(schemaDir, cat.schema), "utf8"))
  );

  const ids = new Set();
  for (const [i, entry] of entries.entries()) {
    totalEntries++;
    const label = `#${i + 1} (${entry.id ?? "sin id"})`;
    if (!validate(entry)) {
      for (const err of validate.errors ?? []) {
        fail(`${cat.file} ${label}: ${err.instancePath || "/"} ${err.message}`);
      }
    }
    if (entry.id) {
      if (ids.has(entry.id)) fail(`${cat.file} ${label}: id duplicado "${entry.id}"`);
      ids.add(entry.id);
    }
    // Coordenadas: si una existe, la otra también
    if (entry.lat !== undefined && entry.lng === undefined)
      fail(`${cat.file} ${label}: lat sin lng`);
    if (entry.lng !== undefined && entry.lat === undefined)
      fail(`${cat.file} ${label}: lng sin lat`);
  }

  // Regla de seguridad: cuentas bancarias solo con verificación oficial
  if (cat.file === "canales-ayuda.json") {
    for (const entry of entries) {
      if (entry.cuenta_bancaria && entry.estado !== "oficial") {
        fail(`canales-ayuda.json (${entry.id}): cuenta bancaria requiere estado "oficial"`);
      }
    }
  }
}

// Registro en vivo de puntos de rescate (reportes ciudadanos, sin regla de oro).
// Lo commitea el worker con token de bot; los contribuidores lo corrigen,
// marcan resuelto o archivan entradas por PR. El CI lo protege con su schema.
{
  const livePath = join(root, "web", "public", "datos", "reportes-puntos.json");
  let doc = null;
  try {
    doc = JSON.parse(readFileSync(livePath, "utf8"));
  } catch (e) {
    fail(`reportes-puntos.json (en vivo): JSON inválido — ${e.message}`);
  }
  if (doc !== null) {
    if (!Array.isArray(doc)) {
      fail("reportes-puntos.json (en vivo): debe ser un arreglo de reportes");
    } else {
      const validateLive = ajv.compile(
        JSON.parse(readFileSync(join(schemaDir, "reporte-punto.schema.json"), "utf8"))
      );
      const ids = new Set();
      for (const [i, entry] of doc.entries()) {
        totalEntries++;
        const label = `#${i + 1} (${entry.id ?? "sin id"})`;
        if (!validateLive(entry)) {
          for (const err of validateLive.errors ?? []) {
            fail(`reportes-puntos.json (en vivo) ${label}: ${err.instancePath || "/"} ${err.message}`);
          }
        }
        if (entry.id) {
          if (ids.has(entry.id)) fail(`reportes-puntos.json (en vivo) ${label}: id duplicado "${entry.id}"`);
          ids.add(entry.id);
        }
      }
    }
  }
}

// Evento (información oficial del SGC) — valida que tenga fuente
try {
  const evento = JSON.parse(readFileSync(join(dataDir, "evento.json"), "utf8"));
  for (const field of ["fuente", "fuente_url", "verificado_por", "fecha_verificacion"]) {
    if (!evento[field]) fail(`evento.json: falta campo obligatorio "${field}"`);
  }
} catch (e) {
  fail(`evento.json: JSON inválido — ${e.message}`);
}

console.log(`Datos validados: ${totalEntries} entradas en ${CATALOGOS.length} catálogos.`);
if (errors > 0) {
  console.error(`\n${errors} error(es). El merge queda BLOQUEADO hasta corregirlos.`);
  process.exit(1);
}
console.log("✓ Todos los datos cumplen la regla de verificación (fuente real obligatoria).");
