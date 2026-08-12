// Derivación del estado de verificación de un punto de rescate.
// Fuente única para el SSG y el render runtime (antes duplicada en
// index.astro como badgeVerificacion y badgeVerificacionHTML).
export function estadoVerificacion(p: { verificacion?: string; estado?: string }): string {
  if (p.verificacion === "oficial") return "oficial";
  if (p.verificacion === "confirmado" || p.estado === "confirmado") return "confirmado";
  return "sin-confirmar";
}
