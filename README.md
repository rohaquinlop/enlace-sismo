# Enlace Sismo

> Información verificada para el sismo en Colombia.
> Acopios, albergues, donación de sangre, centros de salud, puntos de ayuda en vivo, personas desaparecidas y canales oficiales.

**Sitio: [https://enlacesismo.com](https://enlacesismo.com)** — en despliegue.

Plataforma open-source para centralizar información vital tras el sismo de magnitud 7.4
del 10 de agosto de 2026 (epicentro: San José del Palmar, Chocó). Proyecto humanitario:
**la desinformación mata**, por eso aquí solo hay datos reales con fuente verificable.

## Modelo comunitario

Los catálogos de lugares (acopios, albergues, centros de salud) y los puntos de ayuda
viven en **un solo registro en vivo** (base D1, API público): la comunidad los publica
y los audita; el equipo los verifica y los promueve con fuente. No hay cola de revisión
que retrase un dato útil: la corrección también es comunitaria.

**Ningún dato se publica sin fuente verificable.** La regla de oro se conserva: todo
dato publicado muestra su fuente, quién lo verificó y cuándo. Los lugares curados
(antes `data/acopios.json`, `data/albergues.json`, `data/centros-salud.json`) fueron
sembrados al registro con su fuente original; de ahí en adelante, los datos entran por
la plataforma (reporte ciudadano → confirmación con fuente por el equipo) y el CI
valida la forma de todo lo que se publica.

Cada dato muestra su nivel de verificación:

- **Oficial** — publicado por una entidad oficial (SGC, UNGRD, alcaldías, Cruz Roja).
- **Confirmado** — verificado contra fuente por el equipo.
- **Sin confirmar** — reporte ciudadano pendiente; se muestra con advertencia.

## Catálogos de datos

| Fuente | Contenido |
|---|---|
| `GET /api/ayuda` (D1) | **Lugares y puntos de ayuda en vivo** — acopios, albergues, hospitales y otros lugares que necesitan o recolectan. Arranca vacío (los catálogos históricos se vaciaron: datos desactualizados) y se llena con reportes comunitarios + promoción con fuente. API público abierto, proyección sin datos de IP |
| `data/donacion-sangre.json` | Jornadas de donación de sangre con fechas, horario y grupos |
| `data/contactos.json` | Líneas de emergencia oficiales |
| `data/canales-ayuda.json` | Canales oficiales de donación y voluntariado |
| `data/zonas-afectadas.json` | Epicentro SGC y ciudades con intensidad Mercalli (solo con fuente) |
| `data/acopios.json` · `albergues.json` · `centros-salud.json` | **Insumo del seed, vaciados** (2026-08-13): los datos históricos estaban desactualizados y se retiraron de producción; el contenido original queda en el historial de git para re-verificación |

Cada punto tiene enlace "Cómo llegar" (Google Maps) y coordenadas verificadas contra
≥2 geocodificadores independientes — **un pin equivocado envía donantes al lugar
equivocado**, así que la precisión es parte del protocolo.

## Cómo participar (todo en la plataforma)

- **Reportar** — desde `/reportar` (o el botón "Declarar necesidad u oferta" del mapa),
  cualquier persona publica un lugar o una necesidad con ubicación, ítems y destino.
- **Auditar** — el botón "Reportar punto falso" en cada tarjeta: 3 reportes de la
  comunidad ocultan el punto hasta que el equipo lo revise.
- **Actualizar** — el autor edita o cierra su punto con su token de edición; el equipo
  promueve con fuente los datos verificados (badge Oficial/Confirmado).
- **Código** — este repo sigue siendo open-source: issues, PRs y cambios spec-driven
  en `.sdd/` (propose → apply → archive).

Cada punto lleva ítems estandarizados (catálogo + ítems específicos como "insulina") con
cantidad y unidad opcionales; el alimento es solo **no perecedero**. Los datos viven en
una base D1 y se sirven por un **API público** (`GET https://api.enlacesismo.com/api/ayuda`,
con filtros por ciudad, tipo, modalidad e ítem) para que medios, organizaciones y otras
plataformas los consuman.

## Stack

| Capa | Tecnología | Despliegue |
|---|---|---|
| Web (estática, PWA offline) | Astro + MapLibre GL | Cloudflare Pages |
| API | Hono (TypeScript) | Cloudflare Workers |
| Lugares y puntos de ayuda en vivo | D1 (SQLite) — tabla `puntos_ayuda` | Cloudflare D1 (migraciones en el deploy) |
| Límites y caché | Cloudflare KV | Cloudflare KV |
| Catálogos estáticos (jornadas, zonas, contactos, canales, evento) | JSON en este repo, validados en CI | Repo (GitHub) + API `/api/datos/:catalogo` |

## Desarrollo local

```bash
npm install
npm run dev        # web → http://localhost:4321
npm run dev:api    # API → http://localhost:8787
npm run validate:data

# Seed de los catálogos históricos al registro D1 local (idempotente):
cd worker && npm run seed          # D1 local
cd worker && npm run seed:remote   # D1 remota (requiere auth de wrangler)
```

El seed se corre **una vez** por entorno (dev y prod) después de aplicar las
migraciones; en prod, tras sembrar, dispara el workflow `Deploy` manualmente para
regenerar el snapshot SSG con los lugares curados.

## Despliegue (mantenedores)

El push a `main` despliega automáticamente web y API (GitHub Actions → Cloudflare)
**solo cuando cambia código** (`web/src/`, `worker/`, workflows, `data/schema/**`). El
deploy aplica las migraciones D1, publica el worker y la web, y regenera el snapshot
SSG del registro (`web/public/datos/reportes-ayuda.json`) desde el API. Los cambios que
tocan únicamente datos (`data/**` sin schemas, o `web/public/datos/**`) **no despliegan**:
el API sirve los catálogos estáticos directo desde el repo con caché KV
(`GET /api/datos/:catalogo`) y los lugares en vivo vienen del API público. Para
refrescar la fotografía estática (SSG) que ven los usuarios sin JS y los crawlers,
dispara el workflow `Deploy` manualmente (botón *Run workflow*).

La configuración de KV/D1/secretos y los pasos manuales viven en
`.github/workflows/` y `worker/wrangler.toml`.

Secretos del worker: `ADMIN_TOKEN` (moderación del registro de lugares y rescates) y
`GITHUB_TOKEN` (un solo fine-grained PAT con `contents:write` sobre el repo — commitea
el registro de rescates `web/public/datos/reportes-puntos.json`, conservado en el
backend; los puntos de ayuda viven en D1 y no usan GitHub). Ver `CONTRIBUTING.md`.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Aviso

Esta plataforma complementa, no reemplaza, los canales oficiales: **123**,
SGC (`sgc.gov.co`), UNGRD (`gestiondelriesgo.gov.co`), Cruz Roja Colombiana.
