# Enlace Sismo

> Plataforma open-source de información verificada para el sismo M7.4 del 10 de agosto de 2026 en Colombia: acopios, albergues, donación de sangre, centros de salud, personas desaparecidas, zonas afectadas y canales oficiales de ayuda.

## Modelo comunitario (catalogos-comunitarios)

La plataforma es **full colaborativa**: los catálogos de lugares (acopios, albergues,
centros de salud) y los puntos de ayuda viven en UN solo registro en vivo (D1 + API
público). La comunidad publica, audita y corrige directamente en la plataforma; no hay
cola de revisión por PRs/Issues que retrase un dato útil. El equipo verifica y promueve
con fuente. La corrección también es comunitaria (flags: 3+ ocultan hasta revisión).

## Regla de oro (no negociable)

**Ningún dato se publica sin fuente verificable.** En el registro en vivo la regla la
aplica el mantenedor al promover (`POST /api/ayuda/:id/estado` exige `fuente`); en los
catálogos estáticos del repo (`data/*.json`), `npm run validate:data` corre en cada PR
y bloquea el merge si falta `fuente`, `verificado_por` o `fecha_verificacion`. Nunca
inventes datos, coordenadas ni métricas. Usa `"verificacion": "sin-confirmar"` cuando
no estés seguro.

## Tech Stack

- **Monorepo:** npm workspaces (`web`, `worker`)
- **Web:** Astro 5 (static SSG) + MapLibre GL + TypeScript
- **API:** Hono 4 en Cloudflare Workers
- **Lugares y puntos de ayuda (registro único en vivo):** base de datos D1 (SQLite en
  Cloudflare) — tabla `puntos_ayuda`; escrituras del worker con validación Ajv contra
  `data/schema/punto-ayuda.schema.json`; lectura pública vía `GET /api/ayuda` (filtros,
  proyección sin IPs, CORS abierto); snapshot SSG `web/public/datos/reportes-ayuda.json`
  generado por el deploy; el seed (`worker/src/seed-catalogos.ts`, idempotente)
  siembra las entradas re-verificadas de los catálogos históricos (vaciados el
  2026-08-13 — datos desactualizados retirados; hoy el registro arranca en cero)
- **Registro en vivo de rescates (backend conservado):** GitHub como almacén — el worker commitea `web/public/datos/reportes-puntos.json`; la lectura es vía `GET /api/datos/registro` (worker + KV, write-through al commitear). El front ya no muestra rescates (fase superada); los endpoints se conservan para reutilización futura
- **Datos dinámicos:** Cloudflare KV (rate limits + caché de geocodificación + caché de catálogos)
- **Despliegue:** Cloudflare Pages (web) + Workers (API), vía GitHub Actions
- **Package Manager:** npm (CI usa `npm ci`; no usar bun)

## Project Structure

```
enlace-sismo/
├── data/                    # Catálogos estáticos (fuente obligatoria) + histórico del seed
│   ├── acopios.json         # VACIADO (2026-08-13, datos desactualizados) — insumo del seed
│   ├── albergues.json       # VACIADO (2026-08-13) — insumo del seed
│   ├── centros-salud.json   # VACIADO (2026-08-13) — insumo del seed
│   ├── donacion-sangre.json # Jornadas de donación de sangre (fechas + horario + grupos)
│   ├── contactos.json       # Líneas oficiales de emergencia
│   ├── canales-ayuda.json   # Canales de donación/voluntariado
│   ├── zonas-afectadas.json # Epicentro SGC + ciudades; `intensidad` Mercalli opcional SOLO con fuente
│   ├── evento.json          # Boletín oficial SGC (evento en curso)
│   └── schema/              # JSON Schemas (draft 2020-12) por catálogo + reporte-punto.schema.json (rescates) + punto-ayuda.schema.json (registro único, D1)
├── scripts/
│   ├── validate-data.mjs    # Validación con Ajv + reglas de seguridad (NO valida los 3 históricos)
│   ├── verificar-coordenadas.mjs  # Doble geocodificación (Google embed + ArcGIS) contra data/*.json
│   ├── leer-redes.mjs       # Lectura de posts de X (texto + fotos) vía fxtwitter/oEmbed
│   └── geocodificar.mjs     # Geocodificador Nominatim (1 req/s, borrador)
├── capturas/                # Intake de redes sociales (GITIGNORADA, nunca se publica; README con el flujo)
├── web/                     # Frontend Astro
│   ├── src/pages/           # index (dashboard mapa-primero), acopios, albergues,
│   │                        # donar-sangre, salud, ayuda (canales verificados),
│   │                        # contactos (líneas de emergencia),
│   │                        # reportar (formulario genérico del registro único) y
│   │                        # acopios|albergues|salud/reportar (formularios por tipo:
│   │                        # tipo pre-fijado dentro de cada sección)
│   │                        # (NOTA: /mapa → 301 a /#mapa; las páginas
│   │                        # sugerir-* fueron ELIMINADAS → 301 a la sub-página de
│   │                        # su sección; desaparecidos fue ELIMINADA como sección
│   │                        # → 301 a colombiatebusca.com y solo queda el CTA del
│   │                        # navbar; actualizar-reporte → edición en
│   │                        # /reportar?editar=<id>)
│   ├── src/components/      # Map, MapLegend (tira de chips), DatosEvento (barra
│   │                        # de estado), IndiceSecciones, ZonasLista,
│   │                        # JornadaSangreCard, StatusBadge, Breadcrumb (pantallas
│   │                        # secundarias), UbicacionPicker, ModalResultado (modal
│   │                        # éxito/error compartido; lógica en lib/modal-resultado.ts),
│   │                        # FormularioPuntoAyuda (formulario estándar COMPARTIDO:
│   │                        # /reportar genérico y las sub-páginas por tipo),
│   │                        # ModalPuntoMapa (modal de punto del mapa, reemplaza los
│   │                        # popups), QuickAddAyuda (mini-formulario desde el modal
│   │                        # de punto)
│   │                        # (NOTA: CatalogCard fue reemplazado por el render
│   │                        # unificado en lib/render-catalogos.ts)
│   ├── src/lib/             # catalogs.ts (SOLO jornadas/canales estáticos),
│   │                        # zonas.ts, geo.ts (haversine),
│   │                        # color.ts (oklch→hex para MapLibre), api.ts,
│   │                        # items-ayuda.ts (catálogo de ítems, 23 ítems),
│   │                        # puntos-ayuda.ts (PuntoAyuda, visibilidad, cobertura),
│   │                        # ciudades.ts (agruparCiudades: soloCiudadanos),
│   │                        # verificacion.ts (estadoVerificacion + etiqueta,
│   │                        # fuente única SSG+runtime), modal-resultado.ts
│   │                        # datos.ts (fetchCatalogo, fetchPuntosAyuda, refresco SWR),
│   │                        # render-catalogos.ts (render unificado del registro:
│   │                        # cardPuntoAyudaHTML + renderCatalogoPagina — SSG y
│   │                        # runtime comparten la MISMA función)
│   ├── src/styles/global.css
│   ├── public/              # sw.js (PWA offline, cache v6), _redirects
│   └── public/datos/        # reportes-puntos.json (registro de rescates, lo
│                            # commitea el worker; backend conservado) +
│                            # reportes-ayuda.json (SNAPSHOT del registro único,
│                            # lo genera el deploy desde el API; los datos viven
│                            # en D1)
├── worker/                  # API Hono
│   ├── src/index.ts         # Router Hono: upload (R2), puntos (rescates,
│   │                        # conservado), ayuda (D1, registro único), geocodificar,
│   │                        # datos + rate limits (sugerencias ELIMINADO)
│   ├── src/seed-catalogos.ts # Seed de catálogos → D1 (idempotente; node
│   │                        # --experimental-strip-types; excluido del tsc del worker)
│   ├── src/datos.ts         # Lectura de catálogos ESTÁTICOS: GET /api/datos/:catalogo
│   │                        # (GitHub raw + Ajv + KV) — SIN acopios/albergues/salud
│   ├── src/puntos.ts        # Puntos de rescate (registro en vivo, GitHub): crear/confirmar/flag/estado — SIN UI, conservado
│   ├── src/ayuda.ts         # Registro único (D1): POST/PATCH(cerrar)/flag/estado + GET /api/ayuda público
│   ├── src/github.ts        # Escritura del registro de rescates (GitHub como almacén, retry 409, write-through KV)
│   ├── src/geocodificar.ts  # Nominatim forward/reverse con caché KV
│   ├── src/geo.ts           # Haversine (copia de web/src/lib/geo.ts)
│   └── migrations/          # Migraciones D1 (0001_puntos-ayuda.sql, 0002_catalogos_extra.sql)
├── .sdd/                   # Cambios spec-driven
│   ├── changes/             # Activos (propose → apply)
│   ├── archive/             # Completados (proposal + design + tasks como registro)
│   └── specs/               # Specs autoritativas por capacidad (Given/When/Then)
├── tokens.css               # Sistema de diseño Cobalt (fuente única de tokens)
├── design.md                # Sistema de diseño bloqueado (Hallmark)
├── .github/workflows/
│   ├── ci.yml               # Validar datos + build en cada PR
│   └── deploy.yml           # Pages + Workers en main
└── CONTRIBUTING.md          # Modelo comunitario: reportar + auditar + promover
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
npm run validate:data   # Ajv contra data/schema/* + snapshots + reglas especiales
cd web && npx astro check     # typecheck del frontend (el build NO typecheckea)
cd worker && npx tsc --noEmit # typecheck del API (excluye src/seed-catalogos.ts)
```

### Seed de catálogos al registro D1 (opcional; solo cuando haya datos re-verificados)
```bash
cd worker && npm run seed          # D1 local (idempotente; INSERT OR IGNORE)
cd worker && npm run seed:remote   # D1 remota (requiere auth de wrangler)
cd worker && npm run seed -- --dry-run  # imprime el SQL sin ejecutar
```
Los catálogos históricos se vaciaron el 2026-08-13 (datos desactualizados): el seed
lee lo que haya en los archivos; hoy no inserta nada. Para re-sembrar lugares
re-verificados, restaurar el contenido desde el historial de git y correr el seed.

### Despliegue (requiere cuenta Cloudflare)
```bash
# Una vez: crear el KV, copiar el id a worker/wrangler.toml
cd worker && npx wrangler kv namespace create ENLACE_SISMO
# Una vez: crear la base D1 del registro y copiar database_id a worker/wrangler.toml
cd worker && npx wrangler d1 create enlace-sismo
# Migraciones D1: en dev se aplican con --local; en prod las aplica el deploy
cd worker && npx wrangler d1 migrations apply enlace-sismo --local
# Secretos del worker: ADMIN_TOKEN (moderación del registro y rescates)
# y GITHUB_TOKEN (un solo fine-grained PAT sobre el repo con contents:write —
# commitea el registro de rescates web/public/datos/reportes-puntos.json y sube
# el rate limit de lectura de catálogos; rotación sugerida: 1 año).
# El registro de lugares NO usa GITHUB_TOKEN: vive en D1.
cd worker && npx wrangler secret put GITHUB_TOKEN
# Luego: push a main con cambios de código → GitHub Actions despliega
# (aplica migraciones D1, publica worker + web y regenera el snapshot de
# reportes-ayuda.json). Los cambios SOLO de datos (data/** sin data/schema/**,
# o web/public/datos/**) NO despliegan: el API sirve los catálogos estáticos
# desde el repo (GET /api/datos/:catalogo, caché KV 60 s) y el snapshot de
# ayuda lo regenera el propio deploy. Para refrescar el baseline SSG
# (no-JS/SEO/offline) dispara el workflow Deploy manualmente (workflow_dispatch);
# también es el paso post-seed en prod (el snapshot nuevo incluye los curados).
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
- `data/schema/verificado.schema.json` — campos obligatorios de toda entrada de catálogo estático (`fuente`, `verificado_por`, `fecha_verificacion`, `verificacion`); `fuente_secundaria` opcional (URL adicional que respalda el dato)
- `data/schema/jornada-sangre.schema.json` — jornadas de donación: `fecha_inicio` obligatoria, `fecha_fin` opcional, `horario`, `grupos`, `estado: activa|finalizada|sin-confirmar`
- `data/schema/punto-ayuda.schema.json` — contrato del registro único (D1): `tipo` (acopio/albergue/hospital/otro), `modalidad` (necesita/recolecta/ambos), `items` (catálogo o personalizados con `cantidad`/`unidad` opcionales), `destino` (transporta/ciudades/nota), `estado`, `enlazado_a` (obsoleto, conservado), campos del seed (subtipo, departamento, capacidad, ocupacion, admite_mascotas, servicios, urgencias_24h, recoleccion_periodica, recoleccion_detalle, evidencia_links, imagen_url); `flags` admite arreglo (almacén) o entero (proyección pública); `ip_hash` NO es obligatorio (solo forma interna; la proyección pública lo omite)
- `worker/src/seed-catalogos.ts` — seed idempotente de los catálogos históricos al registro D1: acopios → `recolecta` con items de `necesidades`, albergues/hospitales → `necesita`; todos `promovido` con fuente/verificación originales; `fuente_secundaria` → `evidencia_links`; `ip_hash` sintético `sha256("seed:"+id)`; `subtipo` conserva refugio/clínica; sin autor (token_hash NULL — solo el mantenedor corrige; la comunidad audita con flags)
- `scripts/validate-data.mjs` — validador; NO valida los 3 históricos del seed (acopios/albergues/centros-salud); sí valida catálogos estáticos + snapshot del registro + registro de rescates; regla de seguridad: cuentas bancarias solo con `estado: oficial`
- `scripts/verificar-coordenadas.mjs` — verifica `lat/lng` contra Google Maps embed (el MISMO geocoder de los enlaces "Cómo llegar") + ArcGIS; veredicto CONFIRMADA (<150 m) / DISCREPANCIA / SIN-GEOCODIFICAR; correrlo antes de publicar coordenadas nuevas
- `scripts/leer-redes.mjs` — lee posts de X (fxtwitter + oEmbed) con texto, fecha, autor y fotos; `--descargar` baja las fotos a `capturas/redes/` para OCR (Swift/Vision local); Instagram/Facebook/WhatsApp requieren screenshot + URL en `capturas/`
- `web/src/pages/acopios.astro` / `albergues.astro` / `salud.astro` — páginas de catálogo como VISTAS del registro único: snapshot SSG + refresco por `fetchPuntosAyuda()` (filtro por tipo); el contenido lo renderiza `renderCatalogoPagina` (misma función para SSG y runtime); filtro por ciudad + proximidad; en acopios, filtro "Puntos de acopio oficiales" por `verificacion`; el CTA de reporte lleva a la sub-página del tipo (`/acopios/reportar` etc.)
- `web/src/pages/donar-sangre.astro` — jornadas de donación con filtro por ciudad; tarjeta `JornadaSangreCard` con fechas ("11 ago → 12 ago"), horario, grupos y "Cómo llegar" (catálogo estático, sin cambios)
- `web/src/components/Map.astro` — mapa MapLibre progresivo: capas por intensidad Mercalli, anillo del epicentro (rAF + IntersectionObserver), "Cerca de mí" (en móvil es un botón flotante circular sobre la tira), modal de punto vía `enlace:mapa:modal-punto` (REEMPLAZA los popups; lo renderiza ModalPuntoMapa), sincronización lista↔mapa por `CustomEvent` (`enlace:mapa:volar-zona|zona-activa|posicion|reiniciar|ciudad-reportada|volar-ayuda|punto-ayuda-activo`), deep-link `/?ciudad=<id>#mapa`, capa de jornadas de sangre (token `--color-sangre`), capa de puntos de ayuda (token `--color-ayuda`) que incluye los lugares curados del seed, con filtro por ciudad; el clic en un punto abre el modal Y sincroniza el panel (resaltado + filtro por ciudad, sin saltar de pestaña); segundo clic en la zona activa la deselecciona (toggle) y el chip "Ver todas" (visible solo con filtro activo) devuelve todos los puntos; marcador neutral agrupado de ciudades reportadas (solo reportes ciudadanos — los promovidos no generan ciudades reportadas); en modo app mide nav + barra de evento por ResizeObserver (`--nav-h-real`/`--barra-h-real` en el contenedor) para posicionar barra, rail y control de zoom; sin WebGL o con CDN bloqueado, el contenido base (lista) queda visible; nunca pantalla en blanco
- `web/src/components/FormularioPuntoAyuda.astro` — formulario estándar del registro único COMPARTIDO por `/reportar` (genérico, con selector de tipo y modo edición) y las sub-páginas por tipo (`tipoFijo`: hidden + contexto "Tipo de lugar", modalidad sugerida — acopio → recolecta, albergue/hospital → necesita, siempre cambiable; copy por tipo): tipo, modalidad, nombre, 3 vías de ubicación (geolocalización, mapa con pin arrastrable, búsqueda estilo Google Maps con fallback a Nominatim), ítems del catálogo + agregador de ítem personalizado (ejemplos triviales "leche, galletas, toallas"), destino de transporte (solo recolecta/ambos), horario, contacto, dedupe "ya reportado" a ≤150 m, `coordenadas_nivel`, honeypot, health check y modal de éxito con Compartir (solo el botón Cerrar navega al mapa)
- `web/src/pages/reportar.astro` — página delgada: renderiza FormularioPuntoAyuda sin tipo fijo (breadcrumb "Mapa / Reportar necesidad u oferta"); modo edición `/reportar?editar=<id>` con token en `localStorage` (`enlace-ayuda:tokens`)
- `web/src/components/ModalPuntoMapa.astro` — modal de punto del mapa (reemplaza los popups MapLibre): escucha `enlace:mapa:modal-punto` y renderiza ayuda (tarjeta `sinCabeza` + badges en el encabezado), jornada, zona o ciudad reportada + acciones (Cómo llegar, flag, actualizar/cerrar con token, declarar necesidad u oferta → quick-add); overlay + Escape + trampa de foco; diálogo centrado en todos los viewports
- `web/src/lib/ciudades.ts` — agrupa puntos de ayuda visibles por ciudad (centroide); `agruparCiudades(vivos, { soloCiudadanos: true })` excluye los `promovido` (ciudades reportadas = solo reportes comunitarios); fusiona el select con dedupe normalizado (sin acentos/caja)
- `web/src/lib/items-ayuda.ts` — catálogo de ítems (23 ítems; el alimento es SOLO `alimentos-no-perecederos`; incluye `alimentos-bebe` y `mascotas` del vocabulario del seed), `TIPOS_AYUDA`, `MODALIDADES`, `ESTADOS_AYUDA`, etiquetas y `PrecisionPin`; espejo de la whitelist del worker (`worker/src/ayuda.ts`)
- `web/src/lib/puntos-ayuda.ts` — `PuntoAyuda` (proyección pública, incluye campos del seed: subtipo/departamento/capacidad/urgencias_24h/…), `puntoAyudaVisible` (estado + flags; SIN degradación por antigüedad), `resumenCobertura`/`lineaCobertura` (ofertas del MISMO registro; los acopios sembrados ya están en vivos — sin catálogo aparte), `agregarItemsNecesarios`, `actualizadoHace`
- `web/src/lib/render-catalogos.ts` — render unificado del registro: `cardPuntoAyudaHTML` (UN badge de verificación en color + estado de moderación como texto apagado SOLO cuando aporta — espejo del panel; tipo una sola vez: badge del sub-tipo, texto del tipo SOLO con nombre, o nada —sin nombre el h3 ES el tipo—; opción `sinCabeza` para el modal de punto; rol modalidad + precisión en línea propia; ítems, destino, capacidad, urgencias, recolección, contacto, evidencia, flags, fuente; la descripción determinista del seed no se renderiza) y `renderCatalogoPagina(tipo, puntos)` (filtros + grupos por ciudad + CTA por tipo a la sub-página de la sección: "Agregar punto de acopio"/"Agregar albergue"/"Agregar centro de salud"); el SSG de las páginas y el refresco runtime usan la MISMA función; `badgeHTML` sigue para jornadas/canales
- `web/public/datos/reportes-puntos.json` — registro de rescates (backend conservado; lo commitea el worker; validado en CI contra `reporte-punto.schema.json`; el front NO lo consume)
- `web/public/datos/reportes-ayuda.json` — SNAPSHOT del registro único (proyección del API público); lo genera el deploy; validado en CI contra `punto-ayuda.schema.json`; NO se edita por PR (los datos viven en D1)
- `web/src/lib/color.ts` — conversión oklch→hex (MapLibre no soporta oklch)
- `web/src/pages/index.astro` — dashboard mapa-primero: en modo app (`.con-mapa`) el mapa llena el viewport (100dvh) y todo lo demás flota encima: nav translúcido que en móvil es una píldora colapsable (marca + toggle que despliega secciones y CTA; dropdown, no desplaza la barra), barra de evento como tarjeta graphite bajo el nav (cap 42rem en desktop), rail derecho con pestañas Zonas · Ayuda SOLO en desktop (tabs accesibles: roving tabindex; sin JS ambos paneles visibles; en móvil el rail NO se renderiza: mapa + modal de punto + tira inferior) y tira de leyenda en la base (una sola instancia en el DOM); sin footer en modo mapa; `.dash` base = contenido en flujo (fallback sin mapa); ancla `id="mapa"`; script de tabs con sync a `enlace:mapa:zona-activa|posicion|ciudad-reportada`; panel Ayuda con filas como cards (badge de verificación Oficial/Confirmado/Sin confirmar, rol necesita/recolecta/ambos, chips de ítems, línea de destino "Lleva a: …", cobertura "Cubierto por N punto(s) en tu ciudad", flags visibles, "actualizado hace X", acciones "Cómo llegar" + "Reportar punto falso" + "Actualizar"/"Cerrar punto" gated por token) y CTA "Reportar una necesidad u oferta" como barra sticky al inicio; diálogo de acción (flag/cerrar) con detalle (compartido con el modal de punto por delegación global); filtro por zona: la fila activa filtra el panel y salta a la pestaña Ayuda, el marcador/select/modal del mapa solo filtran sin cambiar de pestaña, y un segundo clic en la zona activa la deselecciona; refresco en runtime de jornadas, zonas, evento y del registro (poll 60 s + visibilitychange; SWR sobre SSG, evento `enlace:mapa:datos-frescos` al mapa; si el API cae, los puntos se cargan del snapshot estático y el filtro sigue funcionando)
- `web/src/components/DatosEvento.astro` — barra de estado (lectura SGC + distancia + badges de verificación + reporte); único momento oscuro por página
- `web/src/components/MapLegend.astro` — tira de chips: capas (checkboxes reales visualmente ocultos), chip "Ayuda (N)" (cubre acopios/albergues/salud del registro), chip "Donar sangre (N)", select de ciudad, chip "Ver todas" (visible SOLO con filtro de ciudad activo — deselecciona la zona) y chip "Cerca de mí" (8 estados, spinner con `aria-busy`; en móvil es botón flotante circular con icono SVG y "Cómo ayudar" se oculta); selectores `.leyenda-tira` usados por `Map.astro` y `ZonasLista.astro`
- `web/src/components/ZonasLista.astro` — filas de zonas como cards (borde del sistema, radio 8 px, nombre a ancho completo y meta en línea propia, sin salto de palabra), dot de intensidad Mercalli real, escala I–XII de referencia, chevron, `aria-pressed`; sección "Ciudades con reportes ciudadanos" (solo puntos no-promovidos, dedupe por nombre normalizado contra el registro + zonas); el rail filtra por las casillas de la tira y ordena por distancia con "Cerca de mí"; el clic en una fila filtra el panel Ayuda y salta a su pestaña (segundo clic deselecciona la zona)
- `web/public/_redirects` — `/mapa` → `/#mapa`; `/acopios/sugerir-acopio` · `/albergues/sugerir-albergue` · `/salud/sugerir-centro-salud` → la sub-página de su sección (`/acopios/reportar` etc.); `/desaparecidos` → `https://colombiatebusca.com` (301, Cloudflare Pages)
- `web/public/sw.js` — PWA offline; el `APP_SHELL` NO debe listar páginas borradas (rompe el install)
- `web/src/lib/geo.ts` — haversine + formateo de distancia (build y cliente)
- `worker/src/index.ts` — API; binding D1 `ENLACE_SISMO_DB`; `ADMIN_TOKEN` (secreto) para moderación del registro (`POST /api/puntos/:id/estado` y `POST /api/ayuda/:id/estado`); `GITHUB_TOKEN` (un solo fine-grained PAT: `contents:write`) commitea `web/public/datos/reportes-puntos.json` y sube el rate limit de lectura de catálogos; `GITHUB_REPO` opcional (env, solo deploys desde fork); `/api/datos/:catalogo` (en `src/datos.ts`) sirve SOLO los catálogos estáticos desde el repo con validación Ajv y caché KV (fresco 60 s, stale 6 h)
- `worker/src/ayuda.ts` — router del registro único (D1): `POST /api/ayuda` (honeypot, rate limit 5/h, validación Ajv, `token_edicion` + `token_hash`), `PATCH /api/ayuda/:id` (autor por token o IP; admite auto-cierre `cerrado`), `POST /api/ayuda/:id/flag` (1 por IP; 3+ ocultan), `POST /api/ayuda/:id/estado` (admin; `enlazado_a` opcional) y API público `GET /api/ayuda` + `/:id` (filtros `ciudad`/`tipo`/`modalidad`/`item`/`estado`; proyección SIN `ip_hash`/`token_hash`/`ediciones`; `flags` como conteo; booleans del seed normalizados 0/1 → true/false; CORS `*` en GET)
- `CONTRIBUTING.md` — modelo comunitario completo (reportar + auditar + promover; sin PRs de datos de lugares)

## Conventions

- **Los lugares entran por la plataforma** (API + moderación), NO por PRs: reportar desde los formularios por tipo de cada sección (`/acopios/reportar`, `/albergues/reportar`, `/salud/reportar`) o el genérico `/reportar`, auditar con flags, promover con fuente por API. Los catálogos estáticos (jornadas, zonas, contactos, canales, evento) sí se actualizan por PRs de mantenedores con fuente; los 3 archivos históricos del seed (acopios/albergues/centros-salud) NO se editan como vía de publicación (son registro histórico; el CI no los valida)
- **Seed de catálogos**: `worker/src/seed-catalogos.ts` (idempotente, INSERT OR IGNORE); una vez por entorno tras aplicar migraciones; en prod, después de sembrar, disparar el deploy manual para regenerar el snapshot SSG
- **Cambios grandes vía `.sdd/`** (spec-driven): `/sdd:propose` → `/sdd:apply` → `/sdd:archive`; las specs archivadas viven en `.sdd/specs/`
- **Zonas ↔ filtro de ciudad comparten estado**: clic en una fila de zona filtra los puntos del registro de esa ciudad y sincroniza el select; la fila activa además filtra el panel Ayuda y salta a la pestaña Ayuda (el marcador/select del mapa solo filtra, sin cambiar de pestaña); un SEGUNDO clic en la zona activa la deselecciona (toggle) y el chip "Ver todas" (visible solo con filtro activo) devuelve todos los puntos; el select resalta la fila y vuela; el epicentro vuelve a "Ciudad: Todas"; el select incluye la unión de ciudades del registro, zonas afectadas y ciudades de reportes (dedupe normalizado)
- **El único momento oscuro por página** es la barra de estado del evento (graphite); no añadir otras superficies oscuras sin tocar `design.md`
- **Fuentes**: `fuente` apunta a la ficha oficial (p. ej. SGC); una URL de prensa que la cita puede ir en `fuente_secundaria` (en el registro, el seed la mapea a `evidencia_links`)
- **Zonas sin `intensidad`** en `zonas-afectadas.json` se dibujan neutrales etiquetadas "Sin reporte" — nunca estimar intensidad sin fuente
- **Enlaces "Cómo llegar"** (Google Maps `dir/?api=1&destination=lat,lng`) en el modal de punto y tarjetas: no eliminar
- **Cuentas bancarias / enlaces de pago:** solo en `data/canales-ayuda.json` con `"estado": "oficial"` (publicados por la entidad) y 2 aprobaciones de mantenedores
- **Desaparecidos:** el registro se referencia a ColombiaTeBusca (https://colombiatebusca.com); no hay registro propio ni API de reportes en este proyecto
- **Ingresos hospitalarios: prohibidos.** No hay registro de pacientes en ningún formato (nombres, iniciales, hospital, fecha/hora). Los nombres de pacientes son datos sensibles (Ley 1581/2012); un paciente inconsciente no puede consentir y su familia no siempre es localizable. No existe fuente pública verificable por paciente, así que la regla de oro no se puede cumplir. Los PR que propongan esta funcionalidad se rechazan; derivar a ColombiaTeBusca
- **Estados:** `sin-confirmar | confirmado | cerrado | falso | promovido` (registro único D1 y rescates conservados — rescates añaden `en-curso | resuelto`), `activa | finalizada | sin-confirmar` (jornadas de sangre). El estado operativo de los catálogos históricos (abierto/operativo/limitado) NO se traduce al registro: todo lo curado entra `promovido` y la confianza la comunica `verificacion`
- **Registro en vivo de rescates (backend conservado, sin UI):** los endpoints (`POST /api/puntos`, confirmar, flag, estado) y `web/public/datos/reportes-puntos.json` siguen operativos para reutilización futura; el front ya no los consume (la fase de rescate se superó a las 72 h y las zonas de rescate necesitan silencio). No reincorporar la UI sin una decisión de producto
- **Registro único de lugares (D1):** los reportes entran por los formularios por tipo y el genérico `/reportar` → el worker valida (honeypot, rate limits, enums, ítems con whitelist + personalizados, `coordenadas_nivel`) y persiste en la tabla `puntos_ayuda` con Ajv contra `punto-ayuda.schema.json`. El autor recibe un `token_edicion` al crear (hash en la entrada; respaldo por IP) y con él puede editar y cerrar su punto (`PATCH /api/ayuda/:id` con `estado: cerrado`). 1 flag por IP; 3+ flags ocultan el punto. SIN degradación por antigüedad: la vigencia la renueva el autor al actualizar y la cierra él o el mantenedor. La validación comunitaria es visible: botón "Reportar punto falso" en cada tarjeta y conteo de flags
- **Promoción:** el `promovido` NO oculta el punto (a diferencia de rescates): un punto verificado sigue útil hasta cerrarse; el mantenedor agrega `fuente`/`verificado_por`/`fecha_verificacion`/`verificacion` vía `POST /api/ayuda/:id/estado` (admin; la fuente es OBLIGATORIA al promover) y puede fijar `enlazado_a` (obsoleto para puntos nuevos — la entidad es única; conservado por compatibilidad); el autor sigue editando su punto. Las entradas sembradas no tienen autor (token_hash NULL): solo el mantenedor las corrige; la comunidad las audita con flags
- **Ciudades reportadas:** el reporte guarda `ciudad` derivada del geocoder (normalizada: "Cali ciudad" → "Cali"); SOLO los puntos no-promovidos generan ciudades reportadas (los lugares curados ya son catalogados). Las ciudades sin catálogo aparecen en el select, en el mapa como marcador neutral ("Sin reporte de intensidad" — nunca estimar Mercalli sin fuente) y en la sección "Ciudades con reportes ciudadanos" del panel Zonas, con dedupe por nombre normalizado (sin acentos/caja); la ciudad pasa a zona SGC por PR con fuente oficial
- **El filtro de ciudad aplica también a los puntos del registro** (cada punto lleva su ciudad; sin ciudad se oculta bajo filtro activo); el chip "Ayuda" controla la capa
- **Alimento solo no perecedero:** en el registro la única categoría de alimento es `alimentos-no-perecederos` (misma id que los acopios verificados); el transporte entre ciudades lejanas exige durabilidad — nunca ofrecer comida perecedera como categoría
- **Ítems como forma estándar:** `items` es un arreglo de `{ tipo: catalogo|personalizado, id?/nombre?, cantidad?, unidad? }`; los personalizados reemplazan al texto libre y no participan de la cobertura automática (la cobertura matchea por id de catálogo + ciudad normalizada dentro del MISMO registro)
- **Coordenadas:** toda entrada lleva `coordenadas_nivel` (`premisa` = edificio/POI · `via` = calle · `barrio` = centroide); antes de publicar una coordenada nueva, correr `scripts/verificar-coordenadas.mjs` y publicar solo donde coinciden ≥2 fuentes independientes (Google embed + ArcGIS + POI OSM); un pin equivocado es peor que ningún pin
- **Redes sociales:** los posts oficiales de X se leen con `scripts/leer-redes.mjs`; Instagram/Facebook/WhatsApp requieren screenshot en `capturas/` con la URL en un `.txt`; las cuentas personales NO son fuente publicable (el gráfico oficial que difunden sí, verificado contra el original)
- **Etiquetas de verificación:** `oficial` (entidad oficial) · `confirmado` (2+ revisores) · `sin-confirmar` (cautela)
- El mapa es mejora progresiva: el contenido siempre se lee primero; nunca romper el fallback a lista

## Anti-Patterns

- **Inventar datos** (acopios, coordenadas, métricas, testimonios) — es un proyecto humanitario; la desinformación mata
- **Publicar datos personales de pacientes hospitalizados** (nombre, hospital, fecha/hora de ingreso) — dato sensible sin consentimiento posible; ver convención de ingresos hospitalarios
- **Publicar fuentes no oficiales** como si fueran oficiales (cadenas de WhatsApp, cuentas personales)
- **Resucitar el flujo de sugerencias por Issues/PRs** para lugares (acopios/albergues/salud) — el modelo es comunitario en la plataforma; los formularios y endpoints de sugerencia se ELIMINARON
- **Editar `data/acopios.json`/`albergues.json`/`centros-salud.json` como vía de publicación** — son el insumo del seed (vaciados el 2026-08-13: datos desactualizados); los datos viven en D1 y se moderan por el API
- **Dejar el mapa como única vía de acceso** a los datos — el fallback a lista es obligatorio
- **`git add .` / `git add -A`** — agrupar commits por preocupación lógica
- **Commitear `bun.lock`** — el proyecto usa npm (hay `package-lock.json`)
- **Valores de color/fuente sueltos** fuera de `tokens.css` en el frontend
- **Commitear `.sdd/`** (salvo pedido explícito) ni `.dev.vars` (secretos locales: `GITHUB_TOKEN` de desarrollo)
- **Editar `web/public/datos/reportes-puntos.json` a mano** sin validar contra `reporte-punto.schema.json` (el CI lo bloquea; el worker valida antes de cada commit)
- **Editar `web/public/datos/reportes-ayuda.json` por PR** — es un snapshot GENERADO por el deploy (fetch a `GET /api/ayuda`); los datos viven en D1 y se moderan por el API (flag/estado), no por PR
