# Contribuir a Enlace Sismo

Gracias por ayudar. Este proyecto vive porque la información es **real y verificable**.

## La regla de oro

> **Ningún dato se publica sin fuente verificable.**
> Cada entrada en `data/` debe incluir:
> - `fuente` — URL o identificación de la fuente oficial (boletín de alcaldía, comunicado de UNGRD, cuenta oficial verificada, nota de prensa de medio serio).
> - `verificado_por` — tu nombre o handle real.
> - `fecha_verificacion` — cuándo lo confirmaste.

La validación automática (`npm run validate:data`) corre en cada PR y **bloquea el merge** si falta alguno de estos campos.

## Cómo agregar un punto de acopio (u otro dato)

1. Copia la plantilla de `data/acopios.example.json` al final del arreglo en `data/acopios.json`.
2. Reemplaza **todos** los valores de ejemplo con datos reales.
3. Verifica contra la fuente oficial antes de enviar:
   - Boletines de la alcaldía de la ciudad (sitios y cuentas oficiales).
   - Comunicados de UNGRD (`gestiondelriesgo.gov.co`).
   - Publicaciones de la Cruz Roja Colombiana, Defensa Civil o el SGC.
   - Notas de prensa de medios nacionales serios (El Tiempo, El Espectador, RCN, Caracol, etc.).
4. Abre el PR. Un mantenedor revisa contra la fuente y lo fusiona.
5. Al fusionar, los datos se publican en la plataforma en **~1–2 min sin esperar un deploy**:
   el API los sirve directo desde el repo con caché de 60 s (`GET /api/datos/:catalogo`).
   El deploy automático solo corre cuando cambia código (web, worker o schemas); no hace
   falta correr ningún comando local ni configurar nada (se reutiliza el KV existente).

> Al agregar un **albergue**, incluye `tipo: "albergue" | "refugio"` — es obligatorio en
> `data/schema/albergue.schema.json` y el CI lo exige (la card muestra el badge Refugio/Albergue).

## Reglas de seguridad (no negociables)

- **Cuentas bancarias y enlaces de pago**: solo se aceptan con `"verificacion": "oficial"` (publicados por la entidad oficial) y **2 aprobaciones de mantenedores**. Nunca publiques cuentas personales.
- **Personas desaparecidas**: el reporte y la búsqueda se referencia a ColombiaTeBusca (https://colombiatebusca.com); este proyecto no mantiene un registro propio.
- **No inventes coordenadas**: la dirección y el pin deben apuntar al MISMO lugar (el enlace "Cómo llegar" usa las coordenadas). Antes de publicar una coordenada nueva, corre `node scripts/verificar-coordenadas.mjs` y publica solo donde coinciden ≥2 fuentes independientes (Google Maps embed + ArcGIS + POI de OSM). Marca la precisión en `coordenadas_nivel` (`premisa` = edificio/POI · `via` = calle · `barrio` = centroide). Un pin equivocado es peor que ningún pin: si no puedes confirmarlo, deja el campo y pide ayuda en el PR.
- **Datos desde redes sociales**: los posts oficiales de X se leen con `node scripts/leer-redes.mjs <URL>` (texto + fotos); Instagram, Facebook y WhatsApp requieren captura de pantalla en `capturas/` con la URL del post en un `.txt` junto a la imagen. Las cuentas personales NO son fuente publicable; el gráfico oficial que difunden sí, verificado contra el original de la entidad. **Guía completa paso a paso: [docs/guia-redes-sociales.md](docs/guia-redes-sociales.md)**.
- **Estados**: usa `sin-confirmar` si no estás seguro. La web muestra la advertencia.

## Cómo ayudar sin código

- **Reporta errores**: abre un issue con el enlace del dato incorrecto.
- **Revisa PRs**: cualquier persona puede comentar "verifiqué contra [fuente], datos correctos".
- **Difunde canales oficiales**: comparte esta página, no capturas de dudosas cadenas.

## Estructura del repositorio

```
data/          Datos verificados (acopios, albergues, donación de sangre, salud, contactos, canales de ayuda)
scripts/       Validación de datos, verificación de coordenadas y lectura de redes
capturas/      Intake de redes (GITIGNORADA, nunca se publica)
web/           Frontend (Astro, Cloudflare Pages)
worker/        API (Hono, Cloudflare Workers)
.github/       CI, despliegue automático y procesamiento de sugerencias
```

## Puntos de ayuda en vivo (D1 + API público)

Pasadas las 72 h, la coordinación es entre **quién necesita** (hospitales, albergues) y
**quién recolecta y transporta** (acopios hacia otras ciudades). Cualquier persona publica
un punto de ayuda desde `/reportar` con **ubicación exacta**, **ítems** (catálogo o
personalizados con cantidad/unidad) y, para quienes recolectan, **destino** (a qué
ciudades llevarán la ayuda). El alimento es solo **no perecedero**.

**Cómo funciona:** el formulario envía a `POST /api/ayuda`; el worker valida (honeypot,
rate limits, enums, Ajv contra `data/schema/punto-ayuda.schema.json`) y persiste en la
base **D1** (tabla `puntos_ayuda`). El punto aparece de inmediato en el mapa, en el panel
Ayuda del dashboard y en el **API público** `GET /api/ayuda` (filtros por `ciudad`,
`tipo`, `modalidad`, `item` y `estado`; proyección sin datos de IP; CORS abierto — medios
y organizaciones pueden consumirlo sin clave). El deploy regenera el snapshot SSG
(`web/public/datos/reportes-ayuda.json`) desde el API; ese archivo es generado y **no se
edita por PR**.

**Estados y ciclo de vida:**

- Un punto nace `sin-confirmar`. El autor recibe un **token de edición** al crearlo
  (queda guardado en su navegador; el worker guarda solo el hash y admite respaldo por
  IP) y con él puede **actualizar** sus ítems/destino/horario y **cerrar su punto**
  (estado `cerrado`) cuando el lugar ya no necesita o dejó de recolectar.
- **La comunidad valida de forma visible:** cada tarjeta tiene "Reportar punto falso"
  (1 flag por IP, detalle obligatorio). **3 flags ocultan el punto**; el conteo se
  muestra en la tarjeta. Un admin puede marcar `confirmado`, `cerrado`, `falso` o
  `promovido` vía `POST /api/ayuda/:id/estado` con `ADMIN_TOKEN`.
- **Promoción:** cuando un punto se confirma contra fuente oficial, el mantenedor lo
  promueve con `fuente`/`verificado_por`/`fecha_verificacion`/`verificacion` y puede
  fijar `enlazado_a` (id de la entrada del catálogo oficial). A diferencia de los
  rescates, el `promovido` **no oculta** el punto: la necesidad verificada sigue útil
  hasta cerrarse.
- **Sin degradación automática:** la vigencia la renueva el autor al actualizar
  ("actualizado hace X") y la cierra él o el mantenedor.

**Requisitos de infraestructura (mantenedores):**

- Base D1 creada una vez: `cd worker && npx wrangler d1 create enlace-sismo` (copiar
  `database_id` a `worker/wrangler.toml`). Las migraciones se aplican en el deploy
  (`wrangler d1 migrations apply enlace-sismo --remote`); el token de Cloudflare del
  workflow necesita permiso D1 edit.
- `ADMIN_TOKEN` (moderación: `POST /api/ayuda/:id/estado` y rescates).
- Los puntos de ayuda **no usan** `GITHUB_TOKEN` (viven en D1); ese secreto sigue
  existiendo para sugerencias y el registro de rescates.

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
"Ciudades con reportes ciudadanos" del panel Zonas — **sin tocar el catálogo SGC**.

Cuando una ciudad reportada se confirma contra fuente oficial (SGC, UNGRD, alcaldía):

1. Añádela a `data/zonas-afectadas.json` con `fuente`, `verificado_por` y
   `fecha_verificacion` (regla de oro) y `detalle: "Sismo sentido"`.
2. `intensidad` Mercalli SOLO si la fuente la reporta (spec `zonas-intensidad.md`);
   sin ella, la ciudad se dibuja neutral como las demás sin reporte.
3. Abre el PR; al fusionar, el dashboard deduplica por nombre normalizado y la ciudad
   deja de listarse como "reportada" para pasar a zona SGC.

## Sugerencias de centros de salud

La plataforma permite al público sugerir centros de salud mediante un formulario web.
El flujo es: formulario → API → GitHub Issue → revisión del mantenedor → PR al catálogo → CI → merge.

**Secreto requerido**: el Worker usa el mismo `GITHUB_TOKEN` de las sugerencias y del
registro de rescates (un solo fine-grained PAT con `issues:write` y `contents:write`
sobre el repo) configurado como secreto de Cloudflare Worker. Rotación: crear PAT nuevo →
`wrangler secret put GITHUB_TOKEN` → smoke test → borrar el secreto viejo si es distinto.

El formulario crea un issue etiquetado `sugerencia-salud` · `sin-verificar`. No hay
procesamiento automático posterior: un mantenedor revisa el issue contra la fuente, añade
la entrada a `data/centros-salud.json` (todo entra como `verificacion: "sin-confirmar"`) y
abre el PR, que el CI valida antes del merge.

## Desarrollo local

```bash
npm install
npm run dev        # web en http://localhost:4321
npm run dev:api    # API en http://localhost:8787
npm run validate:data
```

## Mantenedores

Para ser mantenedor (aprobar PRs de datos), abre un issue. El equipo actual se
presenta en el README.
