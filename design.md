# Design — Enlace Sismo

Sistema de diseño bloqueado para la plataforma de información verificada
del sismo en Colombia. Cada página se rediseña leyendo este archivo.

## Genre

modern-minimal — registro de instrumento, no de portal. Calma técnica,
datos legibles en segundos, cero metáforas editoriales.

## Macrostructure family

- **Página de inicio:** Workbench (dashboard mapa-primero) — la superficie
  de datos (mapa) ES la página. Panel superpuesto con lectura del evento
  y acceso a secciones. Variación por archetypes: mapa + panel + sheet móvil.
- **Páginas de app** (mapa, acopios, albergues, salud, ayuda,
  contactos, alertas): familia Index-First / tabular — filas hairline,
  filtros, listas. Sin hero, sin marketing.
- **Desaparecidos**: página de referencia que enlaza a ColombiaTeBusca
  (https://colombiatebusca.com), el registro ciudadano de personas
  desaparecidas. CTA externo, sin formulario ni listas propias.
- **Ninguna página:** hero centrado, testimonios, pricing, FAQ de ventas.

## Theme — Cobalt

- `--color-paper`     oklch(98.5% 0.004 250)
- `--color-paper-2`   oklch(96%   0.006 250)
- `--color-paper-3`   oklch(93%   0.008 250)
- `--color-ink`       oklch(24%   0.02  258)
- `--color-ink-2`     oklch(34%   0.018 257)
- `--color-rule`      oklch(90%   0.008 250)
- `--color-rule-2`    oklch(80%   0.01  250)
- `--color-accent`    oklch(54%   0.19  256)  (cobalto eléctrico, señal única)
- `--color-accent-ink` oklch(99%  0.003 250)
- `--color-focus`     oklch(54%   0.19  256)
- `--color-graphite`  oklch(22%   0.016 260)  (la única franja oscura por página)

Sin `#fff` puro, sin `#000`. Sin serif en ninguna parte.

## Typography

- Display: Space Grotesk, 500/600/700, normal (nunca itálica)
- Body: Inter, 400/500/600
- Mono (registro de lectura de máquina): JetBrains Mono 400/500/600 —
  etiquetas, meta, estados, tablas, teclas ⌘K
- Tracking display: -0.02em a -0.035em · escala mayor-tercera 1.25
- `--text-display` = clamp(2rem, 3.5vw + 0.75rem, 3.25rem)

## Spacing

Escala 4 pt nombrada en `tokens.css`. Nunca valores sueltos.

## Motion

- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) y variantes en tokens
- Reveal: un único fade + 10px rise (600 ms, ease-out), una sola vez
- Sin parallax, sin bounce, sin autoplay. `prefers-reduced-motion` → estático

## Microinteractions stance

- Éxito silencioso; sin toasts celebratorios
- Hover: underline-grow en enlaces, shift de color de borde en superficies
- Foco: anillo cobalto instantáneo, 2px, `:focus-visible`
- Targets táctiles ≥ 44 px

## CTA voice

- Primario: botón cobalto sólido, radio 6px, texto `--color-accent-ink`,
  verbo concreto ("Reportar desaparecido", "Ver el código")
- Secundario: link tipográfico con subrayado o botón delineado

## Per-page allowances

- Página de inicio: NINGUNA decoración — el mapa es la superficie
- Páginas de app: sin enriquecimiento — la función lleva la página
- El único momento oscuro por página: la tarjeta graphite de lectura
  del evento (datos SGC en mono)

## What pages MUST share

- Wordmark "Enlace Sismo" en Space Grotesk con punto cobalto
- El acento cobalto y su colocación (≤ 5 % por viewport)
- Tipografía display + body + mono
- Voz de CTA, radios 6px, ritmo de padding
- La barra de navegación con borde hairline + paleta ⌘K funcional

## What pages MAY differ on

- Archetypes dentro de la familia (mapa, filas, tablas, formularios)
- Ninguna variación de tema

## Exports

### tokens.css
Ver `/tokens.css` — fuente única de verdad del sistema.

### Tailwind v4 `@theme`
```css
@theme {
  --color-paper: oklch(98.5% 0.004 250);
  --color-ink:   oklch(24% 0.02 258);
  --color-accent: oklch(54% 0.19 256);
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

### DTCG `tokens.json`
```json
{
  "color": {
    "paper":  { "$value": "oklch(98.5% 0.004 250)", "$type": "color" },
    "ink":    { "$value": "oklch(24% 0.02 258)", "$type": "color" },
    "accent": { "$value": "oklch(54% 0.19 256)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk", "$type": "fontFamily" },
    "body":    { "$value": "Inter", "$type": "fontFamily" },
    "mono":    { "$value": "JetBrains Mono", "$type": "fontFamily" }
  }
}
```
