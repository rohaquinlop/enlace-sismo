# Enlace Sismo

> Plataforma open-source de información verificada para el sismo M7.4 del 10 de agosto de 2026 en Colombia: acopios, albergues, centros de salud, personas desaparecidas, zonas afectadas y canales oficiales de ayuda.

## Regla de oro (no negociable)

**Ningún dato se publica sin fuente verificable.** Cada entrada en `data/*.json` debe incluir `fuente`, `verificado_por` y `fecha_verificacion`. `npm run validate:data` corre en cada PR y bloquea el merge si falta alguno. Nunca inventes datos, coordenadas ni métricas. Usa `"verificacion": "sin-confirmar"` cuando no estés seguro.

## Tech Stack

- **Monorepo:** npm workspaces (`web`, `worker`)
- **Web:** Astro 5 (static SSG) + MapLibre GL + TypeScript
- **API:** Hono 4 en Cloudflare Workers
- **Datos dinámicos:** Cloudflare D1 (SQLite) + KV (rate limits)
- **Despliegue:** Cloudflare Pages (web) + Workers (API), vía GitHub Actions
- **Package Manager:** npm (CI usa `npm ci`; no usar bun)

## Project Structure

```
enlace-sismo/
├── data/                    # Datos verificados (fuente obligatoria)
│   ├── acopios.json         # Puntos de acopio (vía PRs)
│   ├── albergues.json       # Refugios (vía PRs)
│   ├── centros-salud.json   # Red hospitalaria (vía PRs)
│   ├── contactos.json       # Líneas oficiales de emergencia
│   ├── canales-ayuda.json   # Canales de donación/voluntariado
│   ├── zonas-afectadas.json # Epicentro SGC + ciudades (contexto del evento)
│   ├── evento.json          # Boletín oficial SGC (evento en curso)
│   └── schema/              # JSON Schemas (draft 2020-12) por catálogo
├── scripts/
│   └── validate-data.mjs    # Validación con Ajv + reglas de seguridad
├── web/                     # Frontend Astro
│   ├── src/pages/           # index (dashboard), mapa, acopios, albergues,
│   │                        # salud, desaparecidos, ayuda, alertas, contactos
│   ├── src/components/      # Map, MapLegend, DatosEvento, IndiceSecciones,
│   │                        # ZonasLista, CatalogCard, StatusBadge
│   ├── src/lib/             # catalogs.ts, zonas.ts, api.ts
│   ├── src/styles/global.css
│   └── public/sw.js         # PWA offline (cache v2)
├── worker/                  # API Hono
│   ├── src/index.ts         # alertas, desaparecidos, reportes + rate limits
│   └── migrations/001_init.sql
├── tokens.css               # Sistema de diseño Cobalt (fuente única de tokens)
├── design.md                # Sistema de diseño bloqueado (Hallmark)
├── .github/workflows/
│   ├── ci.yml               # Validar datos + build en cada PR
│   └── deploy.yml           # D1 migrations + Pages + Workers en main
└── CONTRIBUTING.md          # Protocolo de verificación por PRs
```

## Commands

### Setup
```bash
npm install
```

### Development
```bash
npm run dev        # web → http://localhost:4321
npm run dev:api    # API → http://localhost:8787 (wrangler dev --local)
```

### Build
```bash
npm run build      # valida datos + build web + dry-run worker
```

### Test / Validación de datos
```bash
npm run validate:data   # Ajv contra data/schema/* + reglas especiales
```

### Despliegue (requiere cuenta Cloudflare)
```bash
# Una vez: crear D1 y KV, copiar ids a worker/wrangler.toml
cd worker && npx wrangler d1 migrations apply enlace-sismo --local|--remote
# Luego: push a main → GitHub Actions despliega
```

## Code Style

- **TypeScript estricto** (`strict: true` en ambos workspaces)
- **Commits:** Conventional Commits (`feat(web): ...`, `fix(worker): ...`) — ver `git log`
- **Español** en todo el contenido de usuario, copy de UI, docs y mensajes
- **Tokens de diseño:** todo color/fuente vía `var(--token)` de `tokens.css` — nunca valores sueltos (oklch/hex) en el CSS de la web
- **Sin emojis como iconos** en la UI (anti-pattern del sistema); etiquetas tipográficas o SVG propio
- Headings romanos (sin itálica), fuente del sistema Cobalt: Space Grotesk + Inter + JetBrains Mono

## Key Files

- `data/schema/verificado.schema.json` — campos obligatorios de toda entrada (`fuente`, `verificado_por`, `fecha_verificacion`, `verificacion`)
- `scripts/validate-data.mjs` — validador; incluye regla de seguridad: cuentas bancarias solo con `estado: oficial`
- `web/src/components/Map.astro` — mapa MapLibre progresivo: sin WebGL o con CDN bloqueado, el contenido base (lista) queda visible; nunca pantalla en blanco
- `web/src/pages/index.astro` — dashboard mapa-primero (`.dash` base = contenido en flujo; `.con-mapa` = superposición)
- `worker/src/index.ts` — API; `ADMIN_TOKEN` (secreto) para publicar alertas oficiales
- `CONTRIBUTING.md` — protocolo completo de verificación por PRs

## Conventions

- **Los datos entran por PRs** al repo: `data/*.json` → CI valida → mantenedor revisa contra la fuente → merge → deploy automático
- **Cuentas bancarias / enlaces de pago:** solo con `"verificacion": "oficial"` (publicados por la entidad) y 2 aprobaciones de mantenedores
- **Desaparecidos:** prohibido publicar números de documento; menores requieren autorización de familiar
- **Estados operativos:** `abierto | cerrado | sin-confirmar` (acopios/albergues), `operativo | limitado | cerrado | sin-confirmar` (salud)
- **Etiquetas de verificación:** `oficial` (entidad oficial) · `confirmado` (2+ revisores) · `sin-confirmar` (cautela)
- El mapa es mejora progresiva: el contenido siempre se lee primero; nunca romper el fallback a lista

## Anti-Patterns

- **Inventar datos** (acopios, coordenadas, métricas, testimonios) — es un proyecto humanitario; la desinformación mata
- **Publicar fuentes no oficiales** como si fueran oficiales (cadenas de WhatsApp, cuentas personales)
- **Dejar el mapa como única vía de acceso** a los datos — el fallback a lista es obligatorio
- **`git add .` / `git add -A`** — agrupar commits por preocupación lógica
- **Commitear `bun.lock`** — el proyecto usa npm (hay `package-lock.json`)
- **Valores de color/fuente sueltos** fuera de `tokens.css` en el frontend
