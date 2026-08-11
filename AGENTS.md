# Enlace Sismo

> Plataforma open-source de información verificada para el sismo M7.4 del 10 de agosto de 2026 en Colombia: acopios, albergues, donación de sangre, centros de salud, personas desaparecidas, zonas afectadas y canales oficiales de ayuda.

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
│   ├── acopios.json         # 36 puntos de acopio verificados (18 oficiales)
│   ├── albergues.json       # 6 refugios de Pereira (oficiales)
│   ├── donacion-sangre.json # Jornadas de donación de sangre (fechas + horario + grupos)
│   ├── centros-salud.json   # Red hospitalaria: 7 hospitales verificados (OSM + portales), estado sin-confirmar
│   ├── contactos.json       # Líneas oficiales de emergencia
│   ├── canales-ayuda.json   # Canales de donación/voluntariado
│   ├── zonas-afectadas.json # Epicentro SGC + ciudades; `intensidad` Mercalli opcional SOLO con fuente
│   ├── evento.json          # Boletín oficial SGC (evento en curso)
│   └── schema/              # JSON Schemas (draft 2020-12) por catálogo
├── scripts/
│   ├── validate-data.mjs    # Validación con Ajv + reglas de seguridad
│   ├── verificar-coordenadas.mjs  # Doble geocodificación (Google embed + ArcGIS) contra data/*.json
│   ├── leer-redes.mjs       # Lectura de posts de X (texto + fotos) vía fxtwitter/oEmbed
│   └── geocodificar.mjs     # Geocodificador Nominatim (1 req/s, borrador)
├── capturas/                # Intake de redes sociales (GITIGNORADA, nunca se publica; README con el flujo)
├── web/                     # Frontend Astro
│   ├── src/pages/           # index (dashboard mapa-primero), acopios, albergues,
│   │                        # donar-sangre, salud (+ sugerir-centro-salud), desaparecidos
│   │                        # (referencia a ColombiaTeBusca), ayuda, alertas, contactos
│   │                        # (NOTA: /mapa fue eliminado → 301 a /#mapa)
│   ├── src/components/      # Map, MapLegend (tira de chips), DatosEvento (barra
│   │                        # de estado), IndiceSecciones, ZonasLista, CatalogCard,
│   │                        # JornadaSangreCard, StatusBadge
│   ├── src/lib/             # catalogs.ts, zonas.ts, geo.ts (haversine),
│   │                        # color.ts (oklch→hex para MapLibre), api.ts
│   ├── src/styles/global.css
│   └── public/              # sw.js (PWA offline, cache v3), _redirects
├── worker/                  # API Hono
│   ├── src/index.ts         # alertas, reportes + rate limits
│   └── migrations/001_init.sql
├── .sdd/                   # Cambios spec-driven
│   ├── changes/             # Activos (propose → apply)
│   ├── archive/             # Completados (proposal + design + tasks como registro)
│   └── specs/               # Specs autoritativas por capacidad (Given/When/Then)
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
- **MapLibre no acepta `oklch()`:** el mapa convierte tokens con `web/src/lib/color.ts` (oklch→hex en runtime); `tokens.css` sigue siendo la única fuente de color
- **Sin emojis como iconos** en la UI (anti-pattern del sistema); etiquetas tipográficas o SVG propio
- Headings romanos (sin itálica), fuente del sistema Cobalt: Space Grotesk + Inter + JetBrains Mono

## Key Files

- `design.md` — sistema de diseño bloqueado (modern-minimal · Cobalt · Workbench); leer antes de tocar UI; solo él y `tokens.css` definen color/tipografía
- `data/schema/verificado.schema.json` — campos obligatorios de toda entrada (`fuente`, `verificado_por`, `fecha_verificacion`, `verificacion`); `fuente_secundaria` opcional (URL adicional que respalda el dato)
- `data/schema/jornada-sangre.schema.json` — jornadas de donación: `fecha_inicio` obligatoria, `fecha_fin` opcional, `horario`, `grupos`, `estado: activa|finalizada|sin-confirmar`
- `scripts/validate-data.mjs` — validador; incluye regla de seguridad: cuentas bancarias solo con `estado: oficial`
- `scripts/verificar-coordenadas.mjs` — verifica `lat/lng` de `data/*.json` contra Google Maps embed (el MISMO geocoder de los enlaces "Cómo llegar") + ArcGIS; veredicto CONFIRMADA (<150 m) / DISCREPANCIA / SIN-GEOCODIFICAR; correrlo antes de publicar coordenadas nuevas
- `scripts/leer-redes.mjs` — lee posts de X (fxtwitter + oEmbed) con texto, fecha, autor y fotos; `--descargar` baja las fotos a `capturas/redes/` para OCR (Swift/Vision local); Instagram/Facebook/WhatsApp requieren screenshot + URL en `capturas/`
- `web/src/pages/donar-sangre.astro` — jornadas de donación con filtro por ciudad; tarjeta `JornadaSangreCard` con fechas ("11 ago → 12 ago"), horario, grupos y "Cómo llegar"
- `web/src/components/Map.astro` — mapa MapLibre progresivo: capas por intensidad Mercalli, anillo del epicentro (rAF + IntersectionObserver), "Cerca de mí", popups con estilo del sistema y texto escapado (`escapar()`), sincronización lista↔mapa por `CustomEvent` (`enlace:mapa:volar-zona|zona-activa|posicion|reiniciar`), deep-link `/?ciudad=<id>#mapa`, capa de jornadas de sangre (token `--color-sangre`); sin WebGL o con CDN bloqueado, el contenido base (lista) queda visible; nunca pantalla en blanco
- `web/src/lib/geo.ts` — haversine + formateo de distancia (build y cliente)
- `web/src/lib/color.ts` — conversión oklch→hex (MapLibre no soporta oklch)
- `web/src/pages/index.astro` — dashboard mapa-primero: barra de estado superior, rail derecho con pestañas Zonas · Secciones (tabs accesibles: roving tabindex; sin JS ambos paneles visibles) y tira de leyenda (una sola instancia en el DOM); `.dash` base = contenido en flujo, `.con-mapa` = superposición; ancla `id="mapa"`; script de tabs con sync a `enlace:mapa:zona-activa|posicion`
- `web/src/components/DatosEvento.astro` — barra de estado (lectura SGC + distancia + badges de verificación + reporte); único momento oscuro por página
- `web/src/components/MapLegend.astro` — tira de chips: capas (checkboxes reales visualmente ocultos), select de ciudad, chip "Cerca de mí" (8 estados, spinner con `aria-busy`); selectores `.leyenda-tira` usados por `Map.astro` y `ZonasLista.astro`
- `web/src/components/ZonasLista.astro` — filas con dot de intensidad Mercalli real, escala I–XII de referencia, chevron, `aria-pressed`; el rail filtra por las casillas de la tira y ordena por distancia con "Cerca de mí"
- `web/public/_redirects` — `/mapa` → `/#mapa` (301, Cloudflare Pages)
- `web/public/sw.js` — PWA offline; el `APP_SHELL` NO debe listar páginas borradas (rompe el install)
- `worker/src/index.ts` — API; `ADMIN_TOKEN` (secreto) para publicar alertas oficiales
- `CONTRIBUTING.md` — protocolo completo de verificación por PRs

## Conventions

- **Los datos entran por PRs** al repo: `data/*.json` → CI valida → mantenedor revisa contra la fuente → merge → deploy automático
- **Cambios grandes vía `.sdd/`** (spec-driven): `/sdd:propose` → `/sdd:apply` → `/sdd:archive`; las specs archivadas viven en `.sdd/specs/`
- **Zonas ↔ filtro de ciudad comparten estado**: clic en una fila de zona filtra los puntos de esa ciudad y sincroniza el select; el select resalta la fila y vuela; el epicentro vuelve a "Ciudad: Todas"; el select incluye la unión de ciudades con puntos y zonas afectadas
- **El único momento oscuro por página** es la barra de estado del evento (graphite); no añadir otras superficies oscuras sin tocar `design.md`
- **Fuentes**: `fuente` apunta a la ficha oficial (p. ej. SGC); una URL de prensa que la cita puede ir en `fuente_secundaria`
- **Zonas sin `intensidad`** en `zonas-afectadas.json` se dibujan neutrales etiquetadas "Sin reporte" — nunca estimar intensidad sin fuente
- **Enlaces "Cómo llegar"** (Google Maps `dir/?api=1&destination=lat,lng`) en popups y tarjetas: no eliminar
- **Cuentas bancarias / enlaces de pago:** solo con `"verificacion": "oficial"` (publicados por la entidad) y 2 aprobaciones de mantenedores
- **Desaparecidos:** el registro se referencia a ColombiaTeBusca (https://colombiatebusca.com); no hay registro propio ni API de reportes en este proyecto
- **Estados operativos:** `abierto | cerrado | sin-confirmar` (acopios/albergues), `operativo | limitado | cerrado | sin-confirmar` (salud), `activa | finalizada | sin-confirmar` (jornadas de sangre)
- **Coordenadas:** toda entrada lleva `coordenadas_nivel` (`premisa` = edificio/POI · `via` = calle · `barrio` = centroide); antes de publicar una coordenada nueva, correr `scripts/verificar-coordenadas.mjs` y publicar solo donde coinciden ≥2 fuentes independientes (Google embed + ArcGIS + POI OSM); un pin equivocado es peor que ningún pin
- **Redes sociales:** los posts oficiales de X se leen con `scripts/leer-redes.mjs`; Instagram/Facebook/WhatsApp requieren screenshot en `capturas/` con la URL en un `.txt`; las cuentas personales NO son fuente publicable (el gráfico oficial que difunden sí, verificado contra el original)
- **Etiquetas de verificación:** `oficial` (entidad oficial) · `confirmado` (2+ revisores) · `sin-confirmar` (cautela)
- El mapa es mejora progresiva: el contenido siempre se lee primero; nunca romper el fallback a lista

## Anti-Patterns

- **Inventar datos** (acopios, coordenadas, métricas, testimonios) — es un proyecto humanitario; la desinformación mata
- **Publicar fuentes no oficiales** como si fueran oficiales (cadenas de WhatsApp, cuentas personales)
- **Dejar el mapa como única vía de acceso** a los datos — el fallback a lista es obligatorio
- **`git add .` / `git add -A`** — agrupar commits por preocupación lógica
- **Commitear `bun.lock`** — el proyecto usa npm (hay `package-lock.json`)
- **Valores de color/fuente sueltos** fuera de `tokens.css` en el frontend
