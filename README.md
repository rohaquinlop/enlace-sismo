# Enlace Sismo

> Información verificada para el sismo en Colombia.
> Acopios, albergues, donación de sangre, centros de salud, puntos de ayuda en vivo, personas desaparecidas y canales oficiales.

**Sitio: [https://enlacesismo.com](https://enlacesismo.com)** — en despliegue.

Plataforma open-source para centralizar información vital tras el sismo de magnitud 7.4
del 10 de agosto de 2026 (epicentro: San José del Palmar, Chocó). Proyecto humanitario:
**la desinformación mata**, por eso aquí solo hay datos reales con fuente verificable.

## Principio rector

**Ningún dato se publica sin fuente verificable.** Los datos entran como PRs a este
repositorio: cada entrada incluye su fuente oficial, quién la verificó y cuándo.
CI valida (`npm run validate:data`) y bloquea cualquier dato sin fuente.

Cada dato muestra su nivel de verificación:

- **Oficial** — publicado por una entidad oficial (SGC, UNGRD, alcaldías, Cruz Roja).
- **Confirmado** — verificado contra fuente por 2+ revisores.
- **Sin confirmar** — pendiente; se muestra con advertencia.

## Catálogos de datos

| Catálogo | Contenido |
|---|---|
| `data/acopios.json` | 36 puntos de acopio verificados (18 con fuente oficial de alcaldías) |
| `data/albergues.json` | 6 refugios de Pereira (oficiales) |
| `data/donacion-sangre.json` | Jornadas de donación de sangre con fechas, horario y grupos |
| `data/centros-salud.json` | 7 hospitales de las zonas afectadas |
| `data/contactos.json` | Líneas de emergencia oficiales |
| `data/canales-ayuda.json` | Canales oficiales de donación y voluntariado |
| `data/zonas-afectadas.json` | Epicentro SGC y ciudades con intensidad Mercalli (solo con fuente) |
| `GET /api/ayuda` (D1) | **Puntos de ayuda en vivo** — lugares que necesitan (hospitales, albergues) o que recolectan y transportan a otras zonas (acopios). API público abierto, proyección sin datos de IP |

Cada punto tiene enlace "Cómo llegar" (Google Maps) y coordenadas verificadas contra
≥2 geocodificadores independientes — **un pin equivocado envía donantes al lugar
equivocado**, así que la precisión es parte del protocolo.

## Puntos de ayuda en vivo

Pasadas las primeras 72 h del sismo, la coordinación pasó de la búsqueda y rescate a la
**oferta y demanda de ayuda** entre ciudades. Cualquier persona puede publicar desde
`/reportar` un punto de ayuda:

- **Quién necesita** — un hospital que requiere insumos, un albergue que necesita camas o ropa.
- **Quién recolecta** — un acopio que reúne ítems y declara **a qué ciudades los llevará**.

Cada punto lleva ítems estandarizados (catálogo + ítems específicos como "insulina") con
cantidad y unidad opcionales; el alimento es solo **no perecedero**. Los puntos se
publican como *sin confirmar*; la comunidad los valida con el botón "Reportar punto falso"
(3 reportes los ocultan) y el autor puede actualizar o cerrar su punto con su token de
edición. Los datos viven en una base D1 y se sirven por un **API público**
(`GET https://api.enlacesismo.com/api/ayuda`, con filtros por ciudad, tipo, modalidad e
ítem) para que medios, organizaciones y otras plataformas los consuman.

## Contribuir

**Este proyecto vive de contribuciones.** Todo dato pasa por PR y revisión de mantenedor:

- **Datos** (acopios, jornadas de sangre, albergues…): lee [CONTRIBUTING.md](CONTRIBUTING.md)
  y abre un PR con `data/*.json` actualizado. El protocolo incluye cómo verificar
  coordenadas y cómo tratar datos que circulan en redes sociales — guía práctica en
  [docs/guia-redes-sociales.md](docs/guia-redes-sociales.md).
- **Código**: abre un issue para proponer cambios grandes; los cambios siguen el flujo
  spec-driven en `.sdd/` (propose → apply → archive).
- **Revisar**: cualquier persona puede comentar en un PR "verifiqué contra [fuente],
  datos correctos".

## Stack

| Capa | Tecnología | Despliegue |
|---|---|---|
| Web (estática, PWA offline) | Astro + MapLibre GL | Cloudflare Pages |
| API | Hono (TypeScript) | Cloudflare Workers |
| Puntos de ayuda en vivo | D1 (SQLite) — tabla `puntos_ayuda` | Cloudflare D1 (migraciones en el deploy) |
| Límites y caché | Cloudflare KV | Cloudflare KV |
| Datos verificados | JSON en este repo, validados en CI | Repo (GitHub) + API `/api/datos/:catalogo` |

## Desarrollo local

```bash
npm install
npm run dev        # web → http://localhost:4321
npm run dev:api    # API → http://localhost:8787
npm run validate:data
```

## Despliegue (mantenedores)

El push a `main` despliega automáticamente web y API (GitHub Actions → Cloudflare)
**solo cuando cambia código** (`web/src/`, `worker/`, workflows, `data/schema/**`). El
deploy aplica las migraciones D1, publica el worker y la web, y regenera el snapshot
SSG de los puntos de ayuda (`web/public/datos/reportes-ayuda.json`) desde el API. Los
cambios que tocan únicamente datos (`data/**` sin schemas, o `web/public/datos/**`)
**no despliegan**: el API sirve los catálogos directo desde el repo con caché KV
(`GET /api/datos/:catalogo`), así que un PR de datos es visible en ~1–2 min sin deploy.
Para refrescar la fotografía estática (SSG) que ven los usuarios sin JS y los crawlers,
dispara el workflow `Deploy` manualmente (botón *Run workflow* → el baseline se
reconstruye con los datos actuales).

La configuración de KV/D1/secretos y los pasos manuales viven en
`.github/workflows/` y `worker/wrangler.toml`.

Secretos del worker: `ADMIN_TOKEN` (moderación de puntos de ayuda y rescates) y
`GITHUB_TOKEN` (un solo fine-grained PAT con `issues:write` + `contents:write` sobre el
repo — crea issues de sugerencias y commitea el registro de rescates
`web/public/datos/reportes-puntos.json`, conservado en el backend; los puntos de ayuda
viven en D1 y no usan GitHub). Ver `CONTRIBUTING.md`.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Aviso

Esta plataforma complementa, no reemplaza, los canales oficiales: **123**,
SGC (`sgc.gov.co`), UNGRD (`gestiondelriesgo.gov.co`), Cruz Roja Colombiana.
