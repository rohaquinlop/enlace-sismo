# Contribuir a Enlace Sismo

Gracias por ayudar. Este proyecto vive porque la información es **real y verificable**.

## Modelo comunitario (catalogos-comunitarios)

Los lugares (acopios, albergues, centros de salud) y los puntos de ayuda viven en **un
solo registro en vivo** (base D1 + API público). La contribución de datos es **100 %
en la plataforma**: reportar, auditar y corregir no requiere GitHub ni PRs.

- **Reportar** — los formularios por tipo de cada sección (`/acopios/reportar`,
  `/albergues/reportar`, `/salud/reportar`), el formulario genérico `/reportar` o el
  botón "Declarar necesidad u oferta" del modal de punto en el mapa. El punto se
  publica al instante (sin cola de revisión) con ubicación, ítems y destino.
- **Auditar** — "Reportar punto falso" en cada tarjeta: 3 reportes de la comunidad
  ocultan el punto hasta que el equipo lo revisa.
- **Actualizar / cerrar** — el autor con su token de edición; el equipo promueve con
  fuente los datos verificados (badge Oficial/Confirmado).

Los PRs de datos de lugares ya **no existen**: `data/acopios.json`, `data/albergues.json`
y `data/centros-salud.json` son el insumo del seed (vaciados el 2026-08-13: datos
desactualizados retirados de producción; el contenido original queda en el
historial de git para re-verificación). Los
catálogos que sí se actualizan por PR son los de fuentes oficiales estáticas (jornadas
de sangre, zonas, contactos, canales de ayuda, evento) — los mantiene el equipo con
fuente verificable, sin formularios comunitarios.

## La regla de oro

> **Ningún dato se publica sin fuente verificable.**

En el registro en vivo la regla la aplica el mantenedor al **promover** un punto
(`POST /api/ayuda/:id/estado` con `fuente`, `verificado_por`, `fecha_verificacion` y
`verificacion`); el API rechaza una promoción sin fuente. En los catálogos estáticos del
repo, `npm run validate:data` bloquea cualquier entrada sin esos campos.

## Cómo reportar un dato correcto en la plataforma

1. Abre el formulario de la sección (`/acopios/reportar`, `/albergues/reportar`,
   `/salud/reportar`), el formulario genérico `/reportar` o el quick-add del modal de
   punto en el mapa, y publica el lugar con su ubicación. El formulario detecta
   duplicados a ≤150 m del registro.
2. El punto aparece al instante como **sin confirmar** en la página de su tipo
   (`/acopios`, `/albergues`, `/salud`), en el panel Ayuda y en el mapa.
3. Si tienes la fuente oficial, compártela (campo "fuente" en la verificación del
   mantenedor, o en el detalle del reporte): el equipo promueve el dato con badge
   Oficial/Confirmado.

## Cómo señalar un dato incorrecto

Usa **"Reportar punto falso"** en la tarjeta del punto (detalle obligatorio, 1 por IP).
Con 3 reportes el punto se oculta y queda en la bandeja del equipo. Si un lugar ya
cerró o cambió, el autor puede actualizarlo o cerrarlo con su token.

## Reglas de seguridad (no negociables)

- **Cuentas bancarias y enlaces de pago**: solo en `data/canales-ayuda.json` con
  `"estado": "oficial"` (publicados por la entidad) y **2 aprobaciones de mantenedores**.
  Nunca publiques cuentas personales.
- **Personas desaparecidas**: se referencia a ColombiaTeBusca (https://colombiatebusca.com)
  desde el botón del encabezado; este proyecto no mantiene un registro propio ni una
  API de reportes.
- **Ingresos hospitalarios: prohibidos.** No hay registro de pacientes en ningún formato
  (nombres, iniciales, hospital, fecha/hora): dato sensible sin consentimiento posible
  (Ley 1581/2012). Los PRs que lo propongan se rechazan.
- **No inventes coordenadas**: antes de publicar una coordenada nueva (seed o PR),
  corre `node scripts/verificar-coordenadas.mjs` y publica solo donde coinciden ≥2
  fuentes independientes (Google Maps embed + ArcGIS + POI de OSM). Marca la precisión
  en `coordenadas_nivel` (`premisa` = edificio/POI · `via` = calle · `barrio` =
  centroide). Un pin equivocado es peor que ningún pin.
- **Datos desde redes sociales**: los posts oficiales de X se leen con
  `node scripts/leer-redes.mjs <URL>` (texto + fotos); Instagram, Facebook y WhatsApp
  requieren captura de pantalla en `capturas/` con la URL del post en un `.txt` junto a
  la imagen. Las cuentas personales NO son fuente publicable; el gráfico oficial que
  difunden sí, verificado contra el original de la entidad. **Guía completa paso a
  paso: [docs/guia-redes-sociales.md](docs/guia-redes-sociales.md)**.
- **Estados**: usa `sin-confirmar` si no estás seguro. La web muestra la advertencia.

## Cómo ayudar sin código

- **Reporta errores**: abre un issue con el enlace del dato incorrecto (o usa "Reportar
  punto falso" en la plataforma).
- **Revisa PRs de catálogos estáticos**: cualquier persona puede comentar "verifiqué
  contra [fuente], datos correctos".
- **Difunde canales oficiales**: comparte esta página, no capturas de dudosas cadenas.

## Estructura del repositorio

```
data/          Catálogos estáticos (jornadas de sangre, contactos, canales, zonas,
               evento) + insumo del seed de lugares (acopios, albergues, centros
               de salud — vaciados: datos desactualizados retirados 2026-08-13)
scripts/       Validación de datos, verificación de coordenadas y lectura de redes
capturas/      Intake de redes (GITIGNORADA, nunca se publica)
web/           Frontend (Astro, Cloudflare Pages)
worker/        API (Hono, Cloudflare Workers) — incluye seed-catalogos.ts
.github/       CI, despliegue automático
```

## El registro en vivo (D1 + API público)

Todo lugar (acopio, albergue, hospital u otro) es una entrada de la tabla `puntos_ayuda`
en **D1**, servida por el **API público** `GET /api/ayuda` (filtros por `ciudad`,
`tipo`, `modalidad`, `item` y `estado`; proyección sin datos de IP; CORS abierto — medios
y organizaciones pueden consumirlo sin clave). Las páginas `/acopios`, `/albergues` y
`/salud` son vistas del registro filtradas por tipo (SSG desde el snapshot +
refresco runtime). El deploy regenera el snapshot `web/public/datos/reportes-ayuda.json`
desde el API; ese archivo es generado y **no se edita por PR**.

**Estados y ciclo de vida:**

- Un punto nace `sin-confirmar`. El autor recibe un **token de edición** al crearlo
  (hash en el worker; respaldo por IP) y con él puede **actualizar** sus
  ítems/destino/horario y **cerrar su punto** (estado `cerrado`).
- **La comunidad valida de forma visible:** "Reportar punto falso" (1 flag por IP,
  detalle obligatorio). **3 flags ocultan el punto**; el conteo se muestra en la
  tarjeta. Un admin puede marcar `confirmado`, `cerrado`, `falso` o `promovido` vía
  `POST /api/ayuda/:id/estado` con `ADMIN_TOKEN`.
- **Promoción:** el mantenedor promueve con `fuente`/`verificado_por`/
  `fecha_verificacion`/`verificacion` (la fuente es obligatoria al promover — regla de
  oro). El `promovido` **no oculta** el punto: la necesidad verificada sigue útil hasta
  cerrarse. `enlazado_a` quedó obsoleto (la entidad es única) y se conserva por
  compatibilidad con el historial.
- **Sin degradación automática:** la vigencia la renueva el autor al actualizar
  ("actualizado hace X") y la cierra él o el mantenedor.
- **Entradas sembradas** (cuando el seed corre con datos re-verificados):
  `promovido` con su fuente original,
  sin autor ciudadano (solo el mantenedor las corrige vía API; la comunidad las audita
  con flags).

**Seed de catálogos (mantenedores, una vez por entorno):**

```bash
cd worker
npx wrangler d1 migrations apply enlace-sismo --local   # dev (el deploy lo hace en prod)
npm run seed          # D1 local — idempotente (INSERT OR IGNORE por id)
npm run seed:remote   # D1 remota — tras desplegar la migración 0002
```

Tras sembrar en prod, dispara el workflow `Deploy` manualmente (workflow_dispatch) para
regenerar el snapshot SSG con los lugares curados.

**Requisitos de infraestructura (mantenedores):**

- Base D1 creada una vez: `cd worker && npx wrangler d1 create enlace-sismo` (copiar
  `database_id` a `worker/wrangler.toml`). Las migraciones se aplican en el deploy
  (`wrangler d1 migrations apply enlace-sismo --remote`); el token de Cloudflare del
  workflow necesita permiso D1 edit.
- `ADMIN_TOKEN` (moderación: `POST /api/ayuda/:id/estado` y rescates).
- `GITHUB_TOKEN` (fine-grained PAT con `contents:write` sobre el repo): **solo** para el
  registro de rescates (github.ts) y el rate limit de lectura de catálogos. Los puntos
  de ayuda no lo usan (viven en D1). Rotación: crear PAT nuevo → `wrangler secret put
  GITHUB_TOKEN` → smoke test → borrar el secreto viejo si es distinto.

## Registro de rescates (backend conservado)

La fase de rescate se superó a las 72 h (las zonas de rescate necesitan silencio y menos
personas), así que el front ya no muestra puntos de rescate. El backend se conserva
intacto para reutilización futura: `POST /api/puntos` (crear/confirmar/flag/estado),
`web/public/datos/reportes-puntos.json` como registro (lo commitea el worker con
`GITHUB_TOKEN`, write-through a `GET /api/datos/registro`). El archivo ES el registro:
verlo, corregirlo o archivarlo por PR sigue funcionando; la UI simplemente no lo consume.
No reincorporar la UI sin una decisión de producto.

### Ciudades con reportes ciudadanos

Cada reporte guarda la `ciudad` derivada del geocoder (normalizada: "Cali ciudad" → "Cali").
Las ciudades sin presencia en `zonas-afectadas.json` aparecen al instante en el select de
ciudad, en el mapa como marcador neutral ("Sin reporte de intensidad") y en la sección
"Ciudades con reportes ciudadanos" del panel Zonas — **sin tocar el catálogo SGC**. Los
puntos sembrados (promovidos) no generan ciudades reportadas: sus ciudades ya son
catalogadas.

Cuando una ciudad reportada se confirma contra fuente oficial (SGC, UNGRD, alcaldía):

1. Añádela a `data/zonas-afectadas.json` con `fuente`, `verificado_por` y
   `fecha_verificacion` (regla de oro) y `detalle: "Sismo sentido"`.
2. `intensidad` Mercalli SOLO si la fuente la reporta; sin ella, la ciudad se dibuja
   neutral como las demás sin reporte.
3. Abre el PR; al fusionar, el dashboard deduplica por nombre normalizado y la ciudad
   deja de listarse como "reportada" para pasar a zona SGC.

## Catálogos estáticos (PRs de mantenedores)

`data/donacion-sangre.json`, `data/contactos.json`, `data/canales-ayuda.json`,
`data/zonas-afectadas.json` y `data/evento.json` se actualizan por PR con fuente
verificable (regla de oro; el CI los valida y bloquea el merge sin fuente). Los cambios
de datos no despliegan: el API los sirve desde el repo con caché KV de 60 s
(`GET /api/datos/:catalogo`) en ~1–2 min.

## Desarrollo local

```bash
npm install
npm run dev        # web en http://localhost:4321
npm run dev:api    # API en http://localhost:8787
npm run validate:data
```

## Mantenedores

Para ser mantenedor (promover puntos con fuente y aprobar PRs de catálogos estáticos),
abre un issue. El equipo actual se presenta en el README.
