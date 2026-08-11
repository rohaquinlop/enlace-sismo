# Capturas sin verificar — NO PUBLICAR

Carpeta de trabajo para el flujo de recolección desde redes sociales.

**Nada de lo que está aquí se publica.** Esta carpeta está en `.gitignore`.
Los datos solo entran a `data/*.json` después de pasar el protocolo de CONTRIBUTING.md.

## Flujo (captura → extracción → verificación → PR)

1. **Captura** — guarda la captura de pantalla aquí con nombre descriptivo:
   `acopio-<ciudad>-<fuente>.png`, p. ej. `acopio-calarca-instagram.png`.
   - Nombra siempre la red social y la cuenta en el nombre o en un `.txt` junto a la imagen.
   - Incluye también el enlace del post si lo tienes (`acopio-calarca-instagram.txt` con la URL).

2. **Extracción** — pídele al agente (pi) que lea la carpeta `capturas/`:
   - Extrae nombre, dirección, horario, necesidades, contacto y estado de cada imagen.
   - Genera las entradas con `"verificacion": "sin-confirmar"` y la URL del post como `fuente`.

3. **Coordenadas (OBLIGATORIO antes de publicar)** — un pin equivocado manda donantes al lugar equivocado:
   - Corre `node scripts/verificar-coordenadas.mjs` después de agregar entradas.
   - El script cruza Google Maps embed (el MISMO geocoder de los enlaces "Cómo llegar") con ArcGIS.
   - Solo se publica la coordenada en la que coinciden ≥2 fuentes independientes (Google, ArcGIS, POI de OSM/Nominatim).
   - Marca cada entrada con `"coordenadas_nivel": "premisa" | "via" | "barrio"` según la precisión.
   - Si las fuentes NO coinciden (< 150 m de tolerancia) o solo existe el barrio: no publiques la coordenada sin aprobación del mantenedor.

4. **Verificación** — ANTES de tocar `data/*.json`:
   - Confirma contra la publicación oficial de la entidad (alcaldía, UNGRD, cuenta oficial).
   - `verificacion: oficial` solo si lo publicó la entidad; `confirmado` requiere 2 revisores.
   - Sin fuente verificable → el dato no entra. Nunca inventar datos ni coordenadas.

5. **PR** — los datos verificados entran por PR a `data/*.json`; CI corre `npm run validate:data`.

## Acceso a redes sociales (X, Instagram, Facebook, WhatsApp, Telegram)

**X/Twitter — leíble sin cuenta:** `node scripts/leer-redes.mjs <URL del post>` extrae el texto completo, fecha, autor y las fotos del post (vía api.fxtwitter.com + oEmbed de Twitter). Con `--descargar` baja las fotos a `capturas/redes/` para OCR (`scripts/ocr.swift` — Vision de Apple; compilar: `swiftc -O scripts/ocr.swift -o /tmp/ocr`). Los posts oficiales de las alcaldías suelen tener las direcciones en la IMAGEN: descarga + OCR + verificación cruzada con geocoders.

**Instagram, Facebook, WhatsApp — NO leíbles desde aquí:** los anuncios están detrás de login/antibot. Protocolo: screenshot en `capturas/` + la URL del post en un `.txt` con el mismo nombre. El agente extrae los datos de la imagen y registra la URL como fuente.

**Telegram — leíble:** los canales públicos se ven en `https://t.me/s/<nombre-canal>` (preview web).

**Reglas de oro al usar posts:**
- El post debe ser de la CUENTA OFICIAL de la entidad (verificar el handle en el perfil).
- Un post citado por prensa no reemplaza la verificación del post mismo.
- `verificacion: oficial` solo cuando el dato salió de la cuenta oficial de la entidad.
- Las imágenes de los posts se guardan en `capturas/redes/` como evidencia (gitignorada).

## Reglas duras

- Cuentas bancarias / enlaces de pago: solo `"verificacion": "oficial"` + 2 aprobaciones.
- Cadenas de WhatsApp y cuentas personales NO son fuente publicable.
- Si la imagen no tiene dirección completa, no inventes la dirección ni la coordenada.
- Los borradores extraídos de esta carpeta se pueden escribir en `data/*.json` solo con
  `"verificacion": "sin-confirmar"` y la URL del post como `fuente` (la UI muestra la advertencia).
