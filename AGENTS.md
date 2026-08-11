# Enlace Sismo

> Plataforma open-source de información verificada para el sismo M7.4 del 10 de agosto de 2026 en Colombia: acopios, albergues, donación de sangre, centros de salud, personas desaparecidas, zonas afectadas y canales oficiales de ayuda.

## Regla de oro (no negociable)

**Ningún dato se publica sin fuente verificable.** Cada entrada en `data/*.json` debe incluir `fuente`, `verificado_por` y `fecha_verificacion`. `npm run validate:data` corre en cada PR y bloquea el merge si falta alguno. Nunca inventes datos, coordenadas ni métricas. Usa `"verificacion": "sin-confirmar"` cuando no estés seguro.

## Tech Stack

- **Monorepo:** npm workspaces (`web`, `worker`)
- **Web:** Astro 5 (static SSG) + MapLibre GL + TypeScript
- **API:** Hono 4 en Cloudflare Workers
- **Registro en vivo (puntos de rescate):** GitHub como almacén — el worker commitea `web/public/datos/reportes-puntos.json` (JSON en el repo, visible y contribuible por PR)
- **Datos dinámicos (legado):** Cloudflare D1 (alertas, reportes de errores) + KV (rate limits + caché de geocodificación)
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
│   ├── puntos-rescate.json  # Catálogo promovido de puntos verificados (regla de oro; vacío hasta el primer PR)
│   ├── evento.json          # Boletín oficial SGC (evento en curso)
│   └── schema/              # JSON Schemas (draft 2020-12) por catálogo + reporte-punto.schema.json (registro en vivo)
├── scripts/
│   ├── validate-data.mjs    # Validación con Ajv + reglas de seguridad
│   ├── verificar-coordenadas.mjs  # Doble geocodificación (Google embed + ArcGIS) contra data/*.json
│   ├── leer-redes.mjs       # Lectura de posts de X (texto + fotos) vía fxtwitter/oEmbed
│   └── geocodificar.mjs     # Geocodificador Nominatim (1 req/s, borrador)
├── capturas/                # Intake de redes sociales (GITIGNORADA, nunca se publica; README con el flujo)
├── web/                     # Frontend Astro
│   ├── src/pages/           # index (dashboard mapa-primero), acopios, albergues,
│   │                        # donar-sangre, salud (+ sugerir-centro-salud), desaparecidos
│   │                        # (referencia a ColombiaTeBusca), ayuda, alertas, contactos,
│   │                        # reportar (formulario de puntos de rescate)
│   │                        # (NOTA: /mapa fue eliminado → 301 a /#mapa)
│   ├── src/components/      # Map, MapLegend (tira de chips), DatosEvento (barra
│   │                        # de estado), IndiceSecciones, ZonasLista, CatalogCard,
│   │                        # JornadaSangreCard, StatusBadge
│   ├── src/lib/             # catalogs.ts, zonas.ts, geo.ts (haversine),
│   │                        # color.ts (oklch→hex para MapLibre), api.ts,
│   │                        # necesidades.ts, puntos-rescate.ts, ciudades.ts
│   ├── src/styles/global.css
│   ├── public/              # sw.js (PWA offline, cache v4), _redirects
│   └── public/datos/        # reportes-puntos.json — REGISTRO EN VIVO (lo commitea el worker)
├── worker/                  # API Hono
│   ├── src/index.ts         # alertas, reportes + rate limits
│   ├── src/puntos.ts        # Puntos de rescate (registro en vivo): crear/confirmar/flag/estado
│   ├── src/github.ts        # Escritura del registro en vivo (GitHub como almacén, retry 409)
│   ├── src/geocodificar.ts  # Nominatim forward/reverse con caché KV
│   ├── src/geo.ts           # Haversine (copia de web/src/lib/geo.ts)
│   └── migrations/          # 001_init.sql, 002_eliminar_desaparecidos.sql
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
cd web && npx astro check     # typecheck del frontend (el build NO typecheckea)
cd worker && npx tsc --noEmit # typecheck del API
```

### Despliegue (requiere cuenta Cloudflare)
```bash
# Una vez: crear D1 y KV, copiar ids a worker/wrangler.toml
cd worker && npx wrangler d1 migrations apply enlace-sismo --local|--remote
# Secretos del worker: ADMIN_TOKEN (alertas oficiales) y GITHUB_TOKEN
# (un solo fine-grained PAT sobre el repo: issues:write + contents:write —
# crea issues de sugerencias y commitea el registro en vivo de puntos de
# rescate web/public/datos/reportes-puntos.json; rotación sugerida: 1 año)
cd worker && npx wrangler secret put GITHUB_TOKEN
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
- `web/src/components/Map.astro` — mapa MapLibre progresivo: capas por intensidad Mercalli, anillo del epicentro (rAF + IntersectionObserver), "Cerca de mí", popups con estilo del sistema y texto escapado (`escapar()`), sincronización lista↔mapa por `CustomEvent` (`enlace:mapa:volar-zona|zona-activa|posicion|reiniciar|ciudad-reportada`), deep-link `/?ciudad=<id>#mapa`, capa de jornadas de sangre (token `--color-sangre`), capa de puntos de rescate (token `--color-rescate`) con filtro por ciudad, marcador neutral agrupado de ciudades reportadas (sin intensidad); sin WebGL o con CDN bloqueado, el contenido base (lista) queda visible; nunca pantalla en blanco
- `web/src/pages/reportar.astro` — formulario de reporte de puntos de rescate: 3 vías de ubicación (geolocalización, mapa con pin arrastrable, búsqueda estilo Google Maps con fallback directo a Nominatim), necesidades en chips, dedupe "ya reportado" a ≤150 m, `coordenadas_nivel` (premisa/via/barrio), health check del API y aviso de servidor caído
- `web/src/lib/ciudades.ts` — agrupa puntos activos por ciudad (centroide) y fusiona el select con dedupe normalizado (sin acentos/caja)
- `web/public/datos/reportes-puntos.json` — registro en vivo de puntos de rescate; lo commitea el worker; se valida en CI contra `data/schema/reporte-punto.schema.json`; los contribuidores lo corrigen/archivan por PR
- `web/src/lib/color.ts` — conversión oklch→hex (MapLibre no soporta oklch)
- `web/src/pages/index.astro` — dashboard mapa-primero: barra de estado superior, rail derecho con pestañas Zonas · Secciones · Rescates (tabs accesibles: roving tabindex; sin JS ambos paneles visibles) y tira de leyenda (una sola instancia en el DOM); `.dash` base = contenido en flujo, `.con-mapa` = superposición; ancla `id="mapa"`; script de tabs con sync a `enlace:mapa:zona-activa|posicion|ciudad-reportada`; panel Rescates (SSG) con agregación de necesidades y confirmaciones; refresco en runtime del registro en vivo
- `web/src/components/DatosEvento.astro` — barra de estado (lectura SGC + distancia + badges de verificación + reporte); único momento oscuro por página
- `web/src/components/MapLegend.astro` — tira de chips: capas (checkboxes reales visualmente ocultos), chip "Rescates (N)", select de ciudad, chip "Cerca de mí" (8 estados, spinner con `aria-busy`); selectores `.leyenda-tira` usados por `Map.astro` y `ZonasLista.astro`
- `web/src/components/ZonasLista.astro` — filas con dot de intensidad Mercalli real, escala I–XII de referencia, chevron, `aria-pressed`; sección "Ciudades con reportes ciudadanos" (dedupe por nombre normalizado contra el catálogo); el rail filtra por las casillas de la tira y ordena por distancia con "Cerca de mí"
- `web/public/_redirects` — `/mapa` → `/#mapa` (301, Cloudflare Pages)
- `web/public/sw.js` — PWA offline; el `APP_SHELL` NO debe listar páginas borradas (rompe el install)
- `web/src/lib/geo.ts` — haversine + formateo de distancia (build y cliente)
- `worker/src/index.ts` — API; `ADMIN_TOKEN` (secreto) para publicar alertas oficiales; `GITHUB_TOKEN` (un solo fine-grained PAT: `issues:write` + `contents:write`) crea issues de sugerencias y commitea `web/public/datos/reportes-puntos.json`; `GITHUB_REPO` opcional (env, solo deploys desde fork)
- `CONTRIBUTING.md` — protocolo completo de verificación por PRs

## Conventions

- **Los datos entran por PRs** al repo: `data/*.json` → CI valida → mantenedor revisa contra la fuente → merge → deploy automático
- **Cambios grandes vía `.sdd/`** (spec-driven): `/sdd:propose` → `/sdd:apply` → `/sdd:archive`; las specs archivadas viven en `.sdd/specs/`
- **Zonas ↔ filtro de ciudad comparten estado**: clic en una fila de zona filtra los puntos de esa ciudad y sincroniza el select; el select resalta la fila y vuela; el epicentro vuelve a "Ciudad: Todas"; el select incluye la unión de ciudades con puntos, zonas afectadas y ciudades de reportes (dedupe normalizado)
- **El único momento oscuro por página** es la barra de estado del evento (graphite); no añadir otras superficies oscuras sin tocar `design.md`
- **Fuentes**: `fuente` apunta a la ficha oficial (p. ej. SGC); una URL de prensa que la cita puede ir en `fuente_secundaria`
- **Zonas sin `intensidad`** en `zonas-afectadas.json` se dibujan neutrales etiquetadas "Sin reporte" — nunca estimar intensidad sin fuente
- **Enlaces "Cómo llegar"** (Google Maps `dir/?api=1&destination=lat,lng`) en popups y tarjetas: no eliminar
- **Cuentas bancarias / enlaces de pago:** solo con `"verificacion": "oficial"` (publicados por la entidad) y 2 aprobaciones de mantenedores
- **Desaparecidos:** el registro se referencia a ColombiaTeBusca (https://colombiatebusca.com); no hay registro propio ni API de reportes en este proyecto
- **Estados operativos:** `abierto | cerrado | sin-confirmar` (acopios/albergues), `operativo | limitado | cerrado | sin-confirmar` (salud), `activa | finalizada | sin-confirmar` (jornadas de sangre), `sin-confirmar | confirmado | en-curso | resuelto | falso | promovido` (registro en vivo de rescates)
- **Registro en vivo (puntos de rescate):** los reportes entran por `/reportar` → el worker valida (honeypot, rate limits, enums, `coordenadas_nivel`) y commitea a `web/public/datos/reportes-puntos.json` (GitHub como almacén, retry ante 409, validación Ajv por entrada). Confirmaciones con cercanía ≤1 km — peso ORIENTATIVO (la posición la declara el cliente): el estado `confirmado` real lo fija un mantenedor. 1 confirmación y 1 flag por IP por punto; 3+ flags ocultan el punto; degradación 72 h sin reconfirmación (calculada en cliente, el archivo conserva todo)
- **Promoción de puntos:** mantenedor verifica contra fuente → copia a `data/puntos-rescate.json` con `fuente`/`verificado_por`/`fecha_verificacion` y `reporte_id` → PR → CI → merge → admin marca la entrada `promovido`
- **Ciudades reportadas:** el reporte guarda `ciudad` derivada del geocoder (normalizada: "Cali ciudad" → "Cali"); las ciudades sin catálogo aparecen en el select, en el mapa como marcador neutral ("Sin reporte de intensidad" — nunca estimar Mercalli sin fuente) y en la sección "Ciudades con reportes ciudadanos" del panel Zonas, con dedupe por nombre normalizado (sin acentos/caja); la ciudad pasa a zona SGC por PR con fuente oficial
- **El filtro de ciudad aplica también a los puntos de rescate** (cada reporte lleva su ciudad; sin ciudad se oculta bajo filtro activo); el chip "Rescates" controla la capa
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
- **Commitear `.sdd/`** (salvo pedido explícito) ni `.dev.vars` (secretos locales: `GITHUB_TOKEN` de desarrollo)
- **Editar `web/public/datos/reportes-puntos.json` a mano** sin validar contra `reporte-punto.schema.json` (el CI lo bloquea; el worker valida antes de cada commit)
