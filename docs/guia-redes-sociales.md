# Guía: verificar información que circula en redes sociales

Durante la emergencia, la información útil (acopios, jornadas de sangre, albergues)
se publica primero en redes sociales, a menudo como **imágenes**. Esta guía te permite
convertir un post o una captura en una entrada válida del repositorio, sin romper la
regla de oro: **ningún dato se publica sin fuente verificable**.

## Qué puedes hacer según la red

| Red | Método | Herramienta |
|---|---|---|
| X / Twitter | Leer el post (texto + fecha + autor) y bajar las fotos | `scripts/leer-redes.mjs` |
| Telegram (canales públicos) | Ver el preview web | `https://t.me/s/<canal>` |
| Instagram / Facebook / WhatsApp | Captura de pantalla + URL del post en un `.txt` | `capturas/` + OCR |

## Paso a paso

### 1. Leer un post de X

```bash
node scripts/leer-redes.mjs "https://x.com/<usuario>/status/<id>"
node scripts/leer-redes.mjs "https://x.com/<usuario>/status/<id>" --descargar   # baja las fotos
node scripts/leer-redes.mjs @handle                                             # últimos tweets (buscar anuncios)
```

El script devuelve el texto completo, autor, fecha y las URLs de las imágenes.
Las fotos caen en `capturas/redes/` (carpeta gitignorada — nunca se publica).

### 2. Extraer el texto de la imagen (OCR)

Los anuncios oficiales suelen llevar las direcciones **dentro de la imagen**:

```bash
swiftc -O scripts/ocr.swift -o /tmp/ocr          # una vez por máquina (macOS)
/tmp/ocr capturas/redes/<archivo>.jpg --sorted
```

> ¿Sin macOS? Pide ayuda en el PR: cualquier revisor puede transcribir la imagen.

### 3. Verificar las coordenadas (obligatorio)

```bash
node scripts/verificar-coordenadas.mjs
```

El script cruza Google Maps (el mismo geocoder de los enlaces "Cómo llegar")
con ArcGIS. **Solo se publica una coordenada cuando coinciden ≥2 fuentes
independientes** (<150 m de tolerancia).

- Si la dirección tiene sufijo (ej. "Av. 68 #31-41 **Sur**"), Google la malinterpreta:
  confirma con ArcGIS o con la aritmética de placa.
- Los centroides de calle (Nominatim) NO sirven para placas: el pin puede quedar a
  kilómetros del lugar real. Un pin equivocado envía donantes al lugar equivocado.
- Marca la precisión en `coordenadas_nivel`:
  - `premisa` — edificio/POI confirmado
  - `via` — calle confirmada, número sin verificar
  - `barrio` — solo centroide de barrio (pide confirmación en el PR)

### 4. Clasificar la fuente

| Caso | Verificación | Fuente |
|---|---|---|
| Post de la cuenta **oficial** de la entidad (alcaldía, Cruz Roja, UNGRD…) | `oficial` | URL del post |
| **Gráfico oficial** difundido por una cuenta personal | `sin-confirmar` | URL donde lo encontraste; avisa en el PR para localizar el original |
| Cuenta personal sin respaldo oficial | **NO publicable** | — |
| Prensa seria citando anuncio oficial | `sin-confirmar` | URL del artículo |

### 5. Armar la entrada

Usa el formato del catálogo correspondiente (`data/schema/*.json`):

- `fuente` = URL del post o artículo; `fuente_secundaria` si hay corroboración.
- `verificado_por` = tu nombre o handle real.
- `fecha_verificacion` = hoy (YYYY-MM-DD).
- Estados: acopios/albergues `abierto|cerrado|sin-confirmar`;
  jornadas de sangre `activa|finalizada|sin-confirmar`.
- Solo escribe lo que dice la fuente: nunca inventes dirección, horario ni necesidades.

### 6. Cerrar

```bash
npm run validate:data   # CI bloquea si falta fuente, verificado_por o fecha
npm run build
```

Abre el PR y describe la fuente en el cuerpo. Un mantenedor revisa y fusiona.

## Reglas de seguridad (no negociables)

- Cuentas bancarias / enlaces de pago: solo `verificacion: oficial` + 2 aprobaciones de mantenedores.
- Cadenas de WhatsApp y cuentas personales no son fuente publicable.
- Los datos de `capturas/` no se publican: solo entran a `data/*.json` verificados.
- Si algo no está claro, deja el dato fuera del PR y pregunta: mejor faltar que errar.
