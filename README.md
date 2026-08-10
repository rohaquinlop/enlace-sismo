# Enlace Sismo

> Información verificada para el sismo en Colombia.
> Acopios, albergues, centros de salud, personas desaparecidas y canales oficiales de ayuda.

Plataforma open-source para centralizar información vital tras el sismo de magnitud 7.4
del 10 de agosto de 2026 (epicentro: San José del Palmar, Chocó).

## Principio rector

**Solo datos reales, con fuente verificable.** En un desastre, la desinformación mata.
Por eso los datos de esta plataforma se publican como PRs en este repositorio: cada
entrada debe incluir su fuente oficial, quién la verificó y cuándo. CI bloquea cualquier
dato sin fuente.

- `data/acopios.json` — puntos de acopio
- `data/albergues.json` — albergues y refugios
- `data/centros-salud.json` — hospitales, clínicas, primeros auxilios
- `data/contactos.json` — líneas de emergencia oficiales
- `data/canales-ayuda.json` — canales oficiales de donación y voluntariado

## Arquitectura

| Capa | Tecnología | Despliegue |
|---|---|---|
| Web (estática, PWA offline) | Astro + MapLibre GL | Cloudflare Pages |
| API | Hono (TypeScript) | Cloudflare Workers |
| Base de datos dinámica | D1 (SQLite) | Cloudflare D1 |
| Límites y caché | Cloudflare KV | Cloudflare KV |
| Datos verificados | JSON en este repo, validados en CI | Build |

## Estado de verificación

Cada dato muestra su nivel:

- **Oficial** — publicado por una entidad oficial (SGC, UNGRD, alcaldías, Cruz Roja).
- **Confirmado** — verificado contra fuente por 2+ revisores.
- **Sin confirmar** — pendiente; se muestra con advertencia.

## Desarrollo local

```bash
npm install
npm run dev        # web → http://localhost:4321
npm run dev:api    # API → http://localhost:8787
npm run validate:data
```

## Despliegue (Cloudflare)

1. `cd worker && npx wrangler d1 create enlace-sismo` → copiar `database_id` a `worker/wrangler.toml`
2. `npx wrangler kv namespace create ENLACE_SISMO` → copiar `id` a `worker/wrangler.toml`
3. `npx wrangler secret put ADMIN_TOKEN` (para publicar alertas oficiales)
4. Configurar secretos en GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
5. `cd worker && npx wrangler d1 migrations apply enlace-sismo --local && npx wrangler d1 migrations apply enlace-sismo --remote`
6. Push a `main` → CI valida y despliega web + API.

## Licencia

MIT — ver [LICENSE](LICENSE).

## Aviso

Esta plataforma complementa, no reemplaza, los canales oficiales: **123**,
SGC (`sgc.gov.co`), UNGRD (`gestiondelriesgo.gov.co`), Cruz Roja Colombiana.
