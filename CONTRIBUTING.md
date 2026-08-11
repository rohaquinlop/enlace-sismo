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
5. Al fusionar, CI despliega automáticamente la web y el API.

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
worker/        API (Hono, Cloudflare Workers, D1)
.github/       CI, despliegue automático y procesamiento de sugerencias
```

## Puntos de rescate (registro en vivo)

La plataforma permite al público reportar puntos donde se necesita ayuda (derrumbe,
deslizamiento, rescate en curso) con **ubicación exacta** y **necesidades**, desde `/reportar`.

**Cómo funciona:** el formulario envía a `POST /api/puntos`; el worker valida, geocodifica
(Nominatim con caché KV) y commitea la entrada a `web/public/datos/reportes-puntos.json` con
un token de bot (`GITHUB_BOT_TOKEN`, PAT con scope `contents:write`). El push a main dispara
el deploy Pages (~1-3 min) y el punto aparece en el mapa y en la pestaña Rescates del
dashboard. No hay D1 nuevo: el archivo ES el registro, y cualquier contribuidor puede verlo,
corregirlo o archivarlo por PR.

**Estados y ciclo de vida:**

- Un reporte nace `sin-confirmar`. Cualquiera puede **confirmarlo desde el lugar** (la API
  verifica cercanía ≤1 km con la geolocalización del navegador; 1 confirmación por IP por
  punto). Un punto sin reconfirmación en **72 h** deja de mostrarse (la degradación se calcula
  en el cliente; el archivo conserva todo).
- **3 reportes de falso** (`flags` en la entrada) ocultan el punto del mapa; sigue visible en
  el archivo para auditoría. Un admin puede marcarlo `falso`, `resuelto` o `promovido`.
- **Promoción a catálogo verificado:** cuando un punto se confirma contra fuente oficial,
  cópialo a `data/puntos-rescate.json` con `fuente`, `verificado_por`, `fecha_verificacion`
  y `reporte_id` (regla de oro; CI lo exige), abre el PR y, al fusionar, marca la entrada
  original `promovido` (deja de mostrarse en vivo). El punto verificado sobrevive a una API
  caída porque se renderiza desde el build.

**Secreto requerido:** `GITHUB_BOT_TOKEN` (PAT con scope `contents:write` sobre el repo) como
secreto del worker:

```bash
cd worker && npx wrangler secret put GITHUB_BOT_TOKEN
```

Nota: si `main` tiene branch protection, el token necesita bypass para pushear.

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
El flujo es: formulario → API → GitHub Issue → GitHub Action → PR → CI → revisión de mantenedor.

**Secreto requerido**: el Worker necesita un `GITHUB_TOKEN` (PAT con scope `issues:write`)
configurado como secreto de Cloudflare Worker para crear issues desde la API.

```bash
cd worker && npx wrangler secret put GITHUB_TOKEN
```

Las sugerencias se procesan automáticamente: el Action crea un PR con los datos validados
contra el esquema. Todo entra como `verificacion: "sin-confirmar"` — un mantenedor debe
verificar contra la fuente antes de hacer merge.

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
