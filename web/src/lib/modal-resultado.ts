// Modal de resultado (éxito/error) compartido por los formularios de
// sugerencia (acopios, albergues, salud) y reporte de puntos de ayuda.
// El HTML lo renderiza <ModalResultado />; este módulo gestiona abrir,
// cerrar, foco y el botón de compartir. Un solo lugar para el patrón que
// antes vivía copiado en 4 páginas.
import { compartirSeccion } from "./compartir";

// Iconos SVG propios (design.md: sin emojis; los glifos ✓/✗ pueden
// renderizar como emoji en móvil). El color lo da el CSS del modal.
const ICONO_OK = `<svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" fill="none"><path d="M2.5 8.5 6 12l7.5-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_ERROR = `<svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" fill="none"><path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

export interface ModalResultadoConfig {
  /** Página a la que navega el botón Cerrar tras un envío exitoso
      (`data-enviado="true"` en el modal). */
  irTrasExito?: string;
  /** True en las sugerencias: el botón Cerrar navega también desde modales
      de error. Escape y el clic en el overlay nunca navegan. */
  navegarSiempre?: boolean;
  /** URL y título del botón secundario Compartir del modal de éxito. */
  compartir?: { url: string; titulo: string };
}

export function initModalResultado(config: ModalResultadoConfig): void {
  const modal = document.getElementById("modal-resultado") as HTMLDivElement | null;
  if (!modal) return;
  const modalCerrar = document.getElementById("modal-cerrar") as HTMLButtonElement | null;

  function cerrar(desdeBoton: boolean) {
    if (!modal) return;
    modal.dataset.open = "false";
    if (!desdeBoton || !config.irTrasExito) return;
    if (modal.dataset.enviado === "true" || config.navegarSiempre) {
      window.location.href = config.irTrasExito;
    }
  }

  // Tras un envío exitoso, solo el botón "Cerrar" navega; Escape o el clic
  // en el overlay solo cierran (no secuestran la navegación).
  modalCerrar?.addEventListener("click", () => cerrar(true));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) cerrar(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.dataset.open === "true") cerrar(false);
  });

  // Compartir: acción secundaria del modal de éxito.
  modal.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-compartir]");
    if (!btn || !config.compartir) return;
    void compartirSeccion(config.compartir.url, config.compartir.titulo).then((r) => {
      if (r === "copiado") {
        const previo = btn.textContent;
        btn.textContent = "Enlace copiado";
        setTimeout(() => (btn.textContent = previo), 2000);
      } else if (r === "error") {
        mostrarModalResultado(
          "error",
          "No se pudo compartir",
          "El navegador bloqueó el intercambio. Copia la dirección de la barra del navegador.",
        );
      }
    });
  });
}

export function marcarModalEnviado(): void {
  // Tras un envío exitoso, el botón Cerrar podrá navegar a irTrasExito.
  const modal = document.getElementById("modal-resultado") as HTMLDivElement | null;
  if (modal) modal.dataset.enviado = "true";
}

export function mostrarModalResultado(
  tipo: "ok" | "error",
  titulo: string,
  mensaje: string,
  accionesHtml = "",
): void {
  const modal = document.getElementById("modal-resultado") as HTMLDivElement | null;
  const modalIcono = document.getElementById("modal-icono");
  const modalTitulo = document.getElementById("modal-titulo");
  const modalMensaje = document.getElementById("modal-mensaje");
  const modalAcciones = document.getElementById("modal-acciones");
  const modalCerrar = document.getElementById("modal-cerrar") as HTMLButtonElement | null;
  if (!modal || !modalIcono || !modalTitulo || !modalMensaje || !modalAcciones) return;
  modal.dataset.tipo = tipo;
  modalIcono.innerHTML = tipo === "ok" ? ICONO_OK : ICONO_ERROR;
  modalTitulo.textContent = titulo;
  modalMensaje.textContent = mensaje;
  modalAcciones.innerHTML = accionesHtml;
  // Un solo CTA primario: si el modal de éxito trae acciones ("Ver en el
  // mapa"), "Cerrar" pasa a secundario — dos botones cobalto compiten.
  if (modalCerrar) {
    modalCerrar.className = tipo === "ok" && accionesHtml ? "btn" : "btn btn-primary";
  }
  modal.dataset.open = "true";
  // Diálogo modal: el foco entra al control de cierre.
  requestAnimationFrame(() => modalCerrar?.focus());
}
