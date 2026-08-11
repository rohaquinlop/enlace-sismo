# Enlace Sismo

> Información verificada para el sismo en Colombia.
> Acopios, albergues, donación de sangre, centros de salud, personas desaparecidas y canales oficiales de ayuda.

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

Cada punto tiene enlace "Cómo llegar" (Google Maps) y coordenadas verificadas contra
≥2 geocodificadores independientes — **un pin equivocado envía donantes al lugar
equivocado**, así que la precisión es parte del protocolo.

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
| Base de datos dinámica | D1 (SQLite) | Cloudflare D1 |
| Límites y caché | Cloudflare KV | Cloudflare KV |
| Datos verificados | JSON en este repo, validados en CI | Build |

## Desarrollo local

```bash
npm install
npm run dev        # web → http://localhost:4321
npm run dev:api    # API → http://localhost:8787
npm run validate:data
```

## Despliegue (mantenedores)

El push a `main` despliega automáticamente web y API (GitHub Actions → Cloudflare).
La configuración de D1/KV/secretos y los pasos manuales viven en
`.github/workflows/` y `worker/wrangler.toml`.

Secretos del worker: `ADMIN_TOKEN` (alertas oficiales), `GITHUB_TOKEN` (issues de
sugerencias) y `GITHUB_BOT_TOKEN` (PAT con `contents:write` — commitea el registro en
vivo de puntos de rescate `web/public/datos/reportes-puntos.json`). Ver `CONTRIBUTING.md`.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Aviso

Esta plataforma complementa, no reemplaza, los canales oficiales: **123**,
SGC (`sgc.gov.co`), UNGRD (`gestiondelriesgo.gov.co`), Cruz Roja Colombiana.
