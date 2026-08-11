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
- **No inventes coordenadas**: usa la dirección real y, si no sabes las coordenadas, deja el campo y pide ayuda en el PR (un revisor las calcula).
- **Estados**: usa `sin-confirmar` si no estás seguro. La web muestra la advertencia.

## Cómo ayudar sin código

- **Reporta errores**: abre un issue con el enlace del dato incorrecto.
- **Revisa PRs**: cualquier persona puede comentar "verifiqué contra [fuente], datos correctos".
- **Difunde canales oficiales**: comparte esta página, no capturas de dudosas cadenas.

## Estructura del repositorio

```
data/          Datos verificados (acopios, albergues, salud, contactos, canales de ayuda)
scripts/       Validación automática de datos
web/           Frontend (Astro, Cloudflare Pages)
worker/        API (Hono, Cloudflare Workers, D1)
.github/       CI y despliegue automático
```

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
