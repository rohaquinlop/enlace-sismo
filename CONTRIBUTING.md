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
- **Datos desde redes sociales**: los posts oficiales de X se leen con `node scripts/leer-redes.mjs <URL>` (texto + fotos); Instagram, Facebook y WhatsApp requieren captura de pantalla en `capturas/` con la URL del post en un `.txt` junto a la imagen. Las cuentas personales NO son fuente publicable; el gráfico oficial que difunden sí, verificado contra el original de la entidad.
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
