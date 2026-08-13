# Enlace Sismo

> Plataforma open-source de información verificada para el sismo M7.4 del 10 de agosto de 2026 en Colombia: acopios, albergues, donación de sangre, centros de salud, personas desaparecidas, zonas afectadas y canales oficiales de ayuda.

## Regla de oro (no negociable)

**Ningún dato se publica sin fuente verificable.** Cada entrada en `data/*.json` debe incluir `fuente`, `verificado_por` y `fecha_verificacion`. `npm run validate:data` corre en cada PR y bloquea el merge si falta alguno. Nunca inventes datos, coordenadas ni métricas. Usa `"verificacion": "sin-confirmar"` cuando no estés seguro.

## Tech Stack

- **Monorepo:** npm workspaces (`web`, `worker`)
- **Web:** Astro 5 (static SSG) + MapLibre GL + TypeScript
- **API:** Hono 4 en Cloudflare Workers
- **Registro en vivo de rescates (backend conservado):** GitHub como almacén — el worker commitea `web/public/datos/reportes-puntos.json`; la lectura es vía `GET /api/datos/registro` (worker + KV, write-through al commitear). El front ya no muestra rescates (fase superada); los endpoints se conservan para reutilización futura
- **Puntos de ayuda (fase de coordinación):** base de datos D1 (SQLite en Cloudflare) — tabla `puntos_ayuda`; escrituras del worker con validación Ajv contra `data/schema/punto-ayuda.schema.json`; lectura pública vía `GET /api/ayuda` (filtros, proyección sin IPs, CORS abierto); snapshot SSG `web/public/datos/reportes-ayuda.json` generado por el deploy
- **Datos dinámicos:** Cloudflare KV (rate limits + caché de geocodificación + caché de catálogos)
- **Despliegue:** Cloudflare Pages (web) + Workers (API), vía GitHub Actions
- **Package Manager:** npm (CI usa `npm ci`; no usar bun)

## Project Structure

```
enlace-sismo/
├── data/                    # Datos verificados (fuente obligatoria)
│   ├── acopios.json         # 36 puntos de acopio verificados (18 oficiales)
│   ├── albergues.json       # 6 refugios de Pereira (oficiales; `tipo: albergue|refugio` obligatorio)
│   ├── donacion-sangre.json # Jornadas de donación de sangre (fechas + horario + grupos)
│   ├── centros-salud.json   # Red hospitalaria: 7 hospitales verificados (OSM + portales), estado sin-confirmar
│   ├── contactos.json       # Líneas oficiales de emergencia
│   ├── canales-ayuda.json   # Canales de donación/voluntariado
│   ├── zonas-afectadas.json # Epicentro SGC + ciudades; `intensidad` Mercalli opcional SOLO con fuente
│   ├── evento.json          # Boletín oficial SGC (evento en curso)
│   └── schema/              # JSON Schemas (draft 2020-12) por catálogo + reporte-punto.schema.json (rescates) + punto-ayuda.schema.json (puntos de ayuda, D1)
├── scripts/
│   ├── validate-data.mjs    # Validación con Ajv + reglas de seguridad
│   ├── verificar-coordenadas.mjs  # Doble geocodificación (Google embed + ArcGIS) contra data/*.json
│   ├── leer-redes.mjs       # Lectura de posts de X (texto + fotos) vía fxtwitter/oEmbed
│   └── geocodificar.mjs     # Geocodificador Nominatim (1 req/s, borrador)
├── capturas/                # Intake de redes sociales (GITIGNORADA, nunca se publica; README con el flujo)
├── web/                     # Frontend Astro
│   ├── src/pages/           # index (dashboard mapa-primero), acopios, albergues,
│   │                        # donar-sangre, salud (+ sugerir-centro-salud), desaparecidos
│   │                        # (referencia a ColombiaTeBusca), ayuda, contactos,
│   │                        # reportar (formulario de puntos de ayuda)
│   │                        # (NOTA: /mapa fue eliminado → 301 a /#mapa; la página
│   │                        # actualizar-reporte fue eliminada → edición en /reportar?editar=<id>)
│   ├── src/components/      # Map, MapLegend (tira de chips), DatosEvento (barra
│   │                        # de estado), IndiceSecciones, ZonasLista, CatalogCard,
│   │                        # JornadaSangreCard, StatusBadge, Breadcrumb (pantallas
│   │                        # secundarias), UbicacionPicker, ModalResultado (modal
│   │                        # éxito/error compartido; lógica en lib/modal-resultado.ts)
│   ├── src/lib/             # catalogs.ts, zonas.ts, geo.ts (haversine),
│   │                        # color.ts (oklch→hex para MapLibre), api.ts,
│   │                        # items-ayuda.ts (catálogo de ítems), puntos-ayuda.ts
│   │                        # (tipos, visibilidad, cobertura), ciudades.ts,
│   │                        # verificacion.ts (badge oficial/confirmado/sin-confirmar,
│   │                        # fuente única SSG+runtime), modal-resultado.ts
│   │                        # datos.ts (fetchCatalogo, fetchPuntosAyuda, refresco SWR),
│   │                        # render-catalogos.ts
│   ├── src/styles/global.css
│   ├── public/              # sw.js (PWA offline, cache v5), _redirects
│   └── public/datos/        # reportes-puntos.json (registro de rescates, lo
│                            # commitea el worker; backend conservado) +
│                            # reportes-ayuda.json (SNAPSHOT del registro de
│                            # ayuda, lo genera el deploy desde el API; los
│                            # datos viven en D1)
├── worker/                  # API Hono
│   ├── src/index.ts         # Router Hono: sugerencias, upload (R2), puntos
│   │                        # (rescates, conservado), ayuda (D1), geocodificar,
│   │                        # datos + rate limits
│   ├── src/datos.ts         # Lectura de catálogos: GET /api/datos/:catalogo (GitHub raw + Ajv + KV)
│   ├── src/puntos.ts        # Puntos de rescate (registro en vivo, GitHub): crear/confirmar/flag/estado — SIN UI, conservado
│   ├── src/ayuda.ts         # Puntos de ayuda (D1): POST/PATCH(cerrar)/flag/estado + GET /api/ayuda público
│   ├── src/github.ts        # Escritura del registro de rescates (GitHub como almacén, retry 409, write-through KV)
│   ├── src/geocodificar.ts  # Nominatim forward/reverse con caché KV
│   ├── src/geo.ts           # Haversine (copia de web/src/lib/geo.ts)
│   └── migrations/          # Migraciones D1 (0001_puntos-ayuda.sql)
├── .sdd/                   # Cambios spec-driven
│   ├── changes/             # Activos (propose → apply)
│   ├── archive/             # Completados (proposal + design + tasks como registro)
│   └── specs/               # Specs autoritativas por capacidad (Given/When/Then)
├── tokens.css               # Sistema de diseño Cobalt (fuente única de tokens)
├── design.md                # Sistema de diseño bloqueado (Hallmark)
├── .github/workflows/
│   ├── ci.yml               # Validar datos + build en cada PR
│   └── deploy.yml           # Pages + Workers en main
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
# Una vez: crear el KV, copiar el id a worker/wrangler.toml
cd worker && npx wrangler kv namespace create ENLACE_SISMO
# Una vez: crear la base D1 de puntos de ayuda y copiar database_id a worker/wrangler.toml
cd worker && npx wrangler d1 create enlace-sismo
# Migraciones D1: en dev se aplican con --local; en prod las aplica el deploy
cd worker && npx wrangler d1 migrations apply enlace-sismo --local
# Secretos del worker: ADMIN_TOKEN (moderación de puntos de ayuda y rescates)
# y GITHUB_TOKEN (un solo fine-grained PAT sobre el repo: issues:write +
# contents:write — crea issues de sugerencias y commitea el registro de
# rescates web/public/datos/reportes-puntos.json; rotación sugerida: 1 año).
# Los puntos de ayuda NO usan GITHUB_TOKEN: viven en D1.
cd worker && npx wrangler secret put GITHUB_TOKEN
# Luego: push a main con cambios de código → GitHub Actions despliega
# (aplica migraciones D1, publica worker + web y regenera el snapshot de
# reportes-ayuda.json). Los cambios SOLO de datos (data/** sin data/schema/**,
# o web/public/datos/**) NO despliegan: el API sirve los catálogos en vivo
# desde el repo (GET /api/datos/:catalogo, caché KV 60 s) y el snapshot de
# ayuda lo regenera el propio deploy. Para refrescar el baseline SSG
# (no-JS/SEO/offline) dispara el workflow Deploy manualmente (workflow_dispatch).
```

## Code Style

- **TypeScript estricto** (`strict: true` en ambos workspaces)
- **Commits:** Conventional Commits (`feat(web): ...`, `fix(worker): ...`) — ver `git log`
- **Español** en todo el contenido de usuario, copy de UI, docs y mensajes
- **Tokens de diseño:** todo color/fuente vía `var(--token)` de `tokens.css` — nunca valores sueltos (oklch/hex) en el CSS de la web
- **MapLibre no acepta `oklch()`:** el mapa convierte tokens con `web/src/lib/color.ts` (oklch→hex en runtime); `tokens.css` sigue siendo la única fuente de color
- **Sin emojis como iconos** en la UI (anti-pattern del sistema); etiquetas tipográficas o SVG propio
- Headings romanos (sin itálica), una sola familia: Inter (jerarquía por tamaño/peso/spacing); sentence case en toda la UI (sin mayúsculas sostenidas en títulos, botones, estados, badges o tags)

## Key Files

- `design.md` — sistema de diseño bloqueado (modern-minimal · Cobalt · Workbench); leer antes de tocar UI; solo él y `tokens.css` definen color/tipografía; una familia (Inter), sentence case, radios 8 px en badges/chips/botones, `.aviso.warning` amarillo para avisos de fuente oficial
- `data/schema/verificado.schema.json` — campos obligatorios de toda entrada (`fuente`, `verificado_por`, `fecha_verificacion`, `verificacion`); `fuente_secundaria` opcional (URL adicional que respalda el dato)
- `data/schema/jornada-sangre.schema.json` — jornadas de donación: `fecha_inicio` obligatoria, `fecha_fin` opcional, `horario`, `grupos`, `estado: activa|finalizada|sin-confirmar`
- `data/schema/punto-ayuda.schema.json` — contrato de un punto de ayuda (D1): `tipo` (acopio/albergue/hospital/otro), `modalidad` (necesita/recolecta/ambos), `items` (catálogo o personalizados con `cantidad`/`unidad` opcionales), `destino` (transporta/ciudades/nota), `estado`, `enlazado_a`; `flags` admite arreglo (almacén) o entero (proyección pública del API)
- `scripts/validate-data.mjs` — validador; incluye regla de seguridad: cuentas bancarias solo con `estado: oficial`
- `scripts/verificar-coordenadas.mjs` — verifica `lat/lng` de `data/*.json` contra Google Maps embed (el MISMO geocoder de los enlaces "Cómo llegar") + ArcGIS; veredicto CONFIRMADA (<150 m) / DISCREPANCIA / SIN-GEOCODIFICAR; correrlo antes de publicar coordenadas nuevas
- `scripts/leer-redes.mjs` — lee posts de X (fxtwitter + oEmbed) con texto, fecha, autor y fotos; `--descargar` baja las fotos a `capturas/redes/` para OCR (Swift/Vision local); Instagram/Facebook/WhatsApp requieren screenshot + URL en `capturas/`
- `web/src/pages/donar-sangre.astro` — jornadas de donación con filtro por ciudad; tarjeta `JornadaSangreCard` con fechas ("11 ago → 12 ago"), horario, grupos y "Cómo llegar"
- `web/src/components/Map.astro` — mapa MapLibre progresivo: capas por intensidad Mercalli, anillo del epicentro (rAF + IntersectionObserver), "Cerca de mí", popups con estilo del sistema y texto escapado (`escapar()`), sincronización lista↔mapa por `CustomEvent` (`enlace:mapa:volar-zona|zona-activa|posicion|reiniciar|ciudad-reportada|volar-ayuda|punto-ayuda-activo`), deep-link `/?ciudad=<id>#mapa`, capa de jornadas de sangre (token `--color-sangre`), capa de puntos de ayuda (token `--color-ayuda`) con filtro por ciudad; el clic en un punto de ayuda abre el popup Y sincroniza el panel Ayuda (pestaña + tarjeta resaltada); marcador neutral agrupado de ciudades reportadas (sin intensidad); en modo app mide nav + barra de evento por ResizeObserver (`--nav-h-real`/`--barra-h-real` en el contenedor) para posicionar barra, rail y control de zoom; sin WebGL o con CDN bloqueado, el contenido base (lista) queda visible; nunca pantalla en blanco
- `web/src/pages/reportar.astro` — formulario de puntos de ayuda: tipo (acopio/albergue/hospital/otro), modalidad (necesita/recolecta/ambos), nombre del lugar, 3 vías de ubicación (geolocalización, mapa con pin arrastrable, búsqueda estilo Google Maps con fallback directo a Nominatim), ítems del catálogo + agregador de ítem personalizado (nombre + `cantidad`/`unidad` opcionales; nota "solo alimentos no perecederos"), destino de transporte (checkbox + ciudades + nota, solo recolecta/ambos), horario, contacto, dedupe "ya reportado" a ≤150 m, aviso suave contra catálogos oficiales (ciudad+nombre normalizados), `coordenadas_nivel` (premisa/via/barrio), health check del API y aviso de servidor caído; modo edición `/reportar?editar=<id>` (token en localStorage `enlace-ayuda:tokens`); breadcrumb "Puntos de ayuda / Reportar necesidad u oferta", aviso warning "Antes de enviar" y modal de éxito con destino + Compartir (el cierre con Escape/overlay no navega; solo el botón Cerrar lleva al mapa)
- `web/src/lib/ciudades.ts` — agrupa puntos de ayuda visibles por ciudad (centroide) y fusiona el select con dedupe normalizado (sin acentos/caja)
- `web/src/lib/items-ayuda.ts` — catálogo de ítems (21 ítems; el alimento es SOLO `alimentos-no-perecederos`, mismo id que los acopios verificados), `TIPOS_AYUDA`, `MODALIDADES`, `ESTADOS_AYUDA`, etiquetas y `PrecisionPin`; espejo de la whitelist del worker (`worker/src/ayuda.ts`)
- `web/src/lib/puntos-ayuda.ts` — `PuntoAyuda` (proyección pública), `puntoAyudaVisible` (estado + flags; SIN degradación por antigüedad), `coberturaDeItems` (ofertas en vivo + acopios oficiales por ciudad normalizada), `lineaCobertura`, `actualizadoHace`
- `web/public/datos/reportes-puntos.json` — registro de rescates (backend conservado; lo commitea el worker; validado en CI contra `reporte-punto.schema.json`; el front NO lo consume)
- `web/public/datos/reportes-ayuda.json` — SNAPSHOT de puntos de ayuda (proyección del API público); lo genera el deploy; validado en CI contra `punto-ayuda.schema.json`; NO se edita por PR (los datos viven en D1)
- `web/src/lib/color.ts` — conversión oklch→hex (MapLibre no soporta oklch)
- `web/src/pages/index.astro` — dashboard mapa-primero: en modo app (`.con-mapa`) el mapa llena el viewport (100dvh) y todo lo demás flota encima: nav translúcido que en móvil es una píldora colapsable (marca + toggle que despliega secciones y CTA; dropdown, no desplaza la barra), barra de evento como tarjeta graphite bajo el nav (cap 42rem en desktop), rail derecho con pestañas Zonas · Ayuda (tabs accesibles: roving tabindex; sin JS ambos paneles visibles) y tira de leyenda en la base (una sola instancia en el DOM); sin footer en modo mapa; `.dash` base = contenido en flujo (fallback sin mapa); ancla `id="mapa"`; script de tabs con sync a `enlace:mapa:zona-activa|posicion|ciudad-reportada`; panel Ayuda con filas como cards (badge de verificación Oficial/Confirmado/Sin confirmar, rol necesita/recolecta/ambos, chips de ítems, línea de destino "Lleva a: …", cobertura "Cubierto por N punto(s) en tu ciudad", flags visibles, "actualizado hace X", acciones "Cómo llegar" + "Reportar punto falso" + "Actualizar"/"Cerrar punto" gated por token) y CTA "Reportar una necesidad u oferta" como barra sticky al inicio; diálogo de acción (flag/cerrar) con detalle; filtro por zona: la fila activa (SGC o ciudad reportada) filtra el panel y salta a la pestaña Ayuda, el marcador/select del mapa solo filtra sin cambiar de pestaña; refresco en runtime de catálogos, zonas, evento y puntos de ayuda (poll 60 s + visibilitychange; SWR sobre SSG, evento `enlace:mapa:datos-frescos` al mapa; si el API cae, los puntos se cargan del snapshot estático y el filtro sigue funcionando)
- `web/src/components/DatosEvento.astro` — barra de estado (lectura SGC + distancia + badges de verificación + reporte); único momento oscuro por página
- `web/src/components/MapLegend.astro` — tira de chips: capas (checkboxes reales visualmente ocultos), chip "Ayuda (N)", select de ciudad, chip "Cerca de mí" (8 estados, spinner con `aria-busy`); selectores `.leyenda-tira` usados por `Map.astro` y `ZonasLista.astro`
- `web/src/components/CatalogCard.astro` — card de catálogos (acopios/albergues/salud): badges de estado y verificación en el encabezado (misma línea), badge-tipo Refugio/Albergue (campo `tipo`), sin tipo repetido en salud, datos de decisión en negrilla (`card-dato`); el espejo runtime vive en `render-catalogos.ts`
- `web/src/components/ZonasLista.astro` — filas de zonas como cards (borde del sistema, radio 8 px, nombre a ancho completo y meta en línea propia, sin salto de palabra), dot de intensidad Mercalli real, escala I–XII de referencia, chevron, `aria-pressed`; sección "Ciudades con reportes ciudadanos" (dedupe por nombre normalizado contra el catálogo); el rail filtra por las casillas de la tira y ordena por distancia con "Cerca de mí"; el clic en una fila filtra el panel Ayuda y salta a su pestaña
- `web/public/_redirects` — `/mapa` → `/#mapa` (301, Cloudflare Pages)
- `web/public/sw.js` — PWA offline; el `APP_SHELL` NO debe listar páginas borradas (rompe el install)
- `web/src/lib/geo.ts` — haversine + formateo de distancia (build y cliente)
- `worker/src/index.ts` — API; binding D1 `ENLACE_SISMO_DB`; `ADMIN_TOKEN` (secreto) para moderación de puntos (`POST /api/puntos/:id/estado` y `POST /api/ayuda/:id/estado`); `GITHUB_TOKEN` (un solo fine-grained PAT: `issues:write` + `contents:write`) crea issues de sugerencias y commitea `web/public/datos/reportes-puntos.json`; `GITHUB_REPO` opcional (env, solo deploys desde fork); `/api/datos/:catalogo` (en `src/datos.ts`) sirve los catálogos desde el repo con validación Ajv y caché KV (fresco 60 s, stale 6 h)
- `worker/src/ayuda.ts` — router de puntos de ayuda (D1): `POST /api/ayuda` (honeypot, rate limit 5/h, validación Ajv, `token_edicion` + `token_hash`), `PATCH /api/ayuda/:id` (autor por token o IP; admite auto-cierre `cerrado`), `POST /api/ayuda/:id/flag` (1 por IP; 3+ ocultan), `POST /api/ayuda/:id/estado` (admin; `enlazado_a` opcional) y API público `GET /api/ayuda` + `/:id` (filtros `ciudad`/`tipo`/`modalidad`/`item`/`estado`; proyección SIN `ip_hash`/`token_hash`/`ediciones`; `flags` como conteo; CORS `*` en GET)
- `CONTRIBUTING.md` — protocolo completo de verificación por PRs

## Conventions

- **Los datos entran por PRs** al repo: `data/*.json` → CI valida → mantenedor revisa contra la fuente → merge → deploy automático
- **Cambios grandes vía `.sdd/`** (spec-driven): `/sdd:propose` → `/sdd:apply` → `/sdd:archive`; las specs archivadas viven en `.sdd/specs/`
- **Zonas ↔ filtro de ciudad comparten estado**: clic en una fila de zona filtra los puntos de ayuda de esa ciudad y sincroniza el select; la fila activa además filtra el panel Ayuda y salta a la pestaña Ayuda (el marcador/select del mapa solo filtra, sin cambiar de pestaña); el select resalta la fila y vuela; el epicentro vuelve a "Ciudad: Todas"; el select incluye la unión de ciudades con puntos, zonas afectadas y ciudades de reportes (dedupe normalizado)
- **El único momento oscuro por página** es la barra de estado del evento (graphite); no añadir otras superficies oscuras sin tocar `design.md`
- **Fuentes**: `fuente` apunta a la ficha oficial (p. ej. SGC); una URL de prensa que la cita puede ir en `fuente_secundaria`
- **Zonas sin `intensidad`** en `zonas-afectadas.json` se dibujan neutrales etiquetadas "Sin reporte" — nunca estimar intensidad sin fuente
- **Enlaces "Cómo llegar"** (Google Maps `dir/?api=1&destination=lat,lng`) en popups y tarjetas: no eliminar
- **Cuentas bancarias / enlaces de pago:** solo con `"verificacion": "oficial"` (publicados por la entidad) y 2 aprobaciones de mantenedores
- **Desaparecidos:** el registro se referencia a ColombiaTeBusca (https://colombiatebusca.com); no hay registro propio ni API de reportes en este proyecto
- **Ingresos hospitalarios: prohibidos.** No hay registro de pacientes en ningún formato (nombres, iniciales, hospital, fecha/hora). Los nombres de pacientes son datos sensibles (Ley 1581/2012); un paciente inconsciente no puede consentir y su familia no siempre es localizable. No existe fuente pública verificable por paciente, así que la regla de oro no se puede cumplir. Los PR que propongan esta funcionalidad se rechazan; derivar a ColombiaTeBusca
- **Estados operativos:** `abierto | cerrado | sin-confirmar` (acopios/albergues), `operativo | limitado | cerrado | sin-confirmar` (salud), `activa | finalizada | sin-confirmar` (jornadas de sangre), `sin-confirmar | confirmado | en-curso | resuelto | falso | promovido` (registro de rescates, backend conservado), `sin-confirmar | confirmado | cerrado | falso | promovido` (puntos de ayuda, D1)
- **Registro en vivo de rescates (backend conservado, sin UI):** los endpoints (`POST /api/puntos`, confirmar, flag, estado) y `web/public/datos/reportes-puntos.json` siguen operativos para reutilización futura; el front ya no los consume (la fase de rescate se superó a las 72 h y las zonas de rescate necesitan silencio). No reincorporar la UI sin una decisión de producto
- **Puntos de ayuda (registro en vivo, D1):** los reportes entran por `/reportar` → el worker valida (honeypot, rate limits, enums, ítems con whitelist + personalizados, `coordenadas_nivel`) y persiste en la tabla `puntos_ayuda` con Ajv contra `punto-ayuda.schema.json`. El autor recibe un `token_edicion` al crear (hash en la entrada; respaldo por IP) y con él puede editar y cerrar su punto (`PATCH /api/ayuda/:id` con `estado: cerrado`). 1 flag por IP; 3+ flags ocultan el punto. SIN degradación por antigüedad: la vigencia la renueva el autor al actualizar y la cierra él o el mantenedor. La validación comunitaria es visible: botón "Reportar punto falso" en cada tarjeta y conteo de flags
- **Promoción de puntos de ayuda:** el `promovido` NO oculta el punto (a diferencia de rescates): un punto verificado sigue útil hasta cerrarse; el mantenedor agrega `fuente`/`verificado_por`/`fecha_verificacion`/`verificacion` vía `POST /api/ayuda/:id/estado` (admin) y puede fijar `enlazado_a` (id de la entrada del catálogo oficial); el autor sigue editando su punto
- **Ciudades reportadas:** el reporte guarda `ciudad` derivada del geocoder (normalizada: "Cali ciudad" → "Cali"); las ciudades sin catálogo aparecen en el select, en el mapa como marcador neutral ("Sin reporte de intensidad" — nunca estimar Mercalli sin fuente) y en la sección "Ciudades con reportes ciudadanos" del panel Zonas, con dedupe por nombre normalizado (sin acentos/caja); la ciudad pasa a zona SGC por PR con fuente oficial
- **El filtro de ciudad aplica también a los puntos de ayuda** (cada punto lleva su ciudad; sin ciudad se oculta bajo filtro activo); el chip "Ayuda" controla la capa
- **Alimento solo no perecedero:** en los puntos de ayuda la única categoría de alimento es `alimentos-no-perecederos` (misma id que los acopios verificados); el transporte entre ciudades lejanas exige durabilidad — nunca ofrecer comida perecedera como categoría
- **Ítems como forma estándar:** `items` es un arreglo de `{ tipo: catalogo|personalizado, id?/nombre?, cantidad?, unidad? }`; los personalizados reemplazan al texto libre y no participan de la cobertura automática (la cobertura matchea por id de catálogo + ciudad normalizada, incluyendo acopios oficiales)
- **Coordenadas:** toda entrada lleva `coordenadas_nivel` (`premisa` = edificio/POI · `via` = calle · `barrio` = centroide); antes de publicar una coordenada nueva, correr `scripts/verificar-coordenadas.mjs` y publicar solo donde coinciden ≥2 fuentes independientes (Google embed + ArcGIS + POI OSM); un pin equivocado es peor que ningún pin
- **Redes sociales:** los posts oficiales de X se leen con `scripts/leer-redes.mjs`; Instagram/Facebook/WhatsApp requieren screenshot en `capturas/` con la URL en un `.txt`; las cuentas personales NO son fuente publicable (el gráfico oficial que difunden sí, verificado contra el original)
- **Etiquetas de verificación:** `oficial` (entidad oficial) · `confirmado` (2+ revisores) · `sin-confirmar` (cautela)
- El mapa es mejora progresiva: el contenido siempre se lee primero; nunca romper el fallback a lista

## Anti-Patterns

- **Inventar datos** (acopios, coordenadas, métricas, testimonios) — es un proyecto humanitario; la desinformación mata
- **Publicar datos personales de pacientes hospitalizados** (nombre, hospital, fecha/hora de ingreso) — dato sensible sin consentimiento posible; ver convención de ingresos hospitalarios
- **Publicar fuentes no oficiales** como si fueran oficiales (cadenas de WhatsApp, cuentas personales)
- **Dejar el mapa como única vía de acceso** a los datos — el fallback a lista es obligatorio
- **`git add .` / `git add -A`** — agrupar commits por preocupación lógica
- **Commitear `bun.lock`** — el proyecto usa npm (hay `package-lock.json`)
- **Valores de color/fuente sueltos** fuera de `tokens.css` en el frontend
- **Commitear `.sdd/`** (salvo pedido explícito) ni `.dev.vars` (secretos locales: `GITHUB_TOKEN` de desarrollo)
- **Editar `web/public/datos/reportes-puntos.json` a mano** sin validar contra `reporte-punto.schema.json` (el CI lo bloquea; el worker valida antes de cada commit)
- **Editar `web/public/datos/reportes-ayuda.json` por PR** — es un snapshot GENERADO por el deploy (fetch a `GET /api/ayuda`); los datos viven en D1 y se moderan por el API (flag/estado), no por PR
