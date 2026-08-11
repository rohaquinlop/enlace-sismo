---
name: redes-sociales
description: Extraer datos verificables (acopios, jornadas de sangre, albergues, anuncios oficiales) de publicaciones en redes sociales — X, Instagram, Facebook, WhatsApp, Telegram — para el proyecto enlace-sismo. Usar cuando el usuario comparte links de posts o capturas de pantalla con información humanitaria, o pide buscar anuncios oficiales de alcaldías/entidades en redes.
---

# Extracción de datos desde redes sociales — Enlace Sismo

Flujo validado en la sesión del 10-11/08/2026 (sismo M7.4). Regla de oro del proyecto:
**ningún dato se publica sin fuente verificable** — y una cuenta personal NO es fuente.
Esta es la versión canónica para enlace-sismo (vive en el repo); la guía para
contribuidores está en `docs/guia-redes-sociales.md`.

## 1. X / Twitter — leíble sin cuenta

```bash
node scripts/leer-redes.mjs "https://x.com/<usuario>/status/<id>" --descargar
```

- Extrae texto completo, autor, fecha e id del post (api.fxtwitter.com, con fallback a oEmbed de Twitter).
- `--descargar` baja las fotos a `capturas/redes/<id>-<usuario>.jpg`.
- Línea de tiempo de una entidad (buscar anuncios): `node scripts/leer-redes.mjs @handle` (máx. ~10 tweets cacheados; puede dar "Not found" si el usuario no está en caché — probar variantes del handle o pedir el link al usuario).

**Los posts oficiales suelen tener la información en la IMAGEN.** Descargar + OCR:

```bash
swiftc -O scripts/ocr.swift -o /tmp/ocr   # una vez por máquina (Vision de Apple, macOS)
/tmp/ocr capturas/redes/<archivo>.jpg --sorted
```

## 2. Instagram / Facebook / WhatsApp — NO leíbles

Detrás de login/antibot. Protocolo: el usuario guarda la captura en `capturas/` y la URL del post en un `.txt` con el mismo nombre. Los datos se extraen de la imagen (visión/OCR); la URL queda registrada como fuente.

## 3. Telegram — leíble

Canales públicos: `https://t.me/s/<nombre-canal>` (preview web).

## 4. Buscar anuncios oficiales (si el buscador falla)

- `web_search` puede devolver vacío temporalmente. Fallback probado: **Google News RSS**
  `https://news.google.com/rss/search?q=<query URL-encoded>&hl=es-419&gl=CO&ceid=CO:es-419` — devuelve títulos+fuentes+dates.
- Los links del RSS son wrappers cifrados (no resolubles por servidor): usar el id numérico del post con `leer-redes.mjs` o el artículo directo.
- Sitios oficiales directos: `cali.gov.co`, `bogota.gov.co` (buscar en el HTML las URLs de boletines), etc.

## 5. Protocolo de verificación (antes de tocar data/*.json)

| Caso | Tratamiento |
|---|---|
| Post de la cuenta oficial de la entidad | `verificacion: oficial`, fuente = URL del post |
| Gráfico oficial difundido por cuenta personal | `sin-confirmar`, fuente = URL donde se encontró; pedir el post original para subir a `oficial` |
| Cuenta personal sin gráfico oficial | NO publicable — documentar en `capturas/` |
| Prensa citando anuncio oficial | `sin-confirmar`, fuente = artículo |

**Coordenadas** (obligatorio antes de publicar):

```bash
node scripts/verificar-coordenadas.mjs   # Google embed (geocoder de "Cómo llegar") + ArcGIS
```

- Publicar solo donde coinciden ≥2 fuentes (<150 m); si no, `coordenadas_nivel: barrio` o no publicar.
- Los centroides de calle de Nominatim NO sirven para placas (ej. Banco de Alimentos Cali quedó a 2 km).
- Placas con sufijo (ej. "31-41 Sur") confunden a Google — verificar con ArcGIS + aritmética de placa.
- `coordenadas_nivel`: `premisa` (edificio/POI) · `via` (calle) · `barrio` (centroide).

**Datos de la entrada** (según schema del catálogo):
- `fuente` = URL del post/artículo; `fuente_secundaria` si hay corroboración.
- `verificado_por` = "equipo-enlacesismo (…fuente… 2026-08-11)"; `fecha_verificacion` = hoy.
- Estados: acopios/albergues `abierto|cerrado|sin-confirmar`; sangre `activa|finalizada|sin-confirmar`.
- Nunca inventar dirección, coordenada ni necesidad — solo lo que dice la fuente.

## 6. Cierre

1. `npm run validate:data` (los campos de verificación son obligatorios, CI bloquea).
2. `npm run build`.
3. Reportar al usuario qué quedó `oficial` vs `sin-confirmar` y qué necesita confirmación humana (p. ej. post original de la entidad).
