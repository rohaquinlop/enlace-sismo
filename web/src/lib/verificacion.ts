// Derivación del estado de verificación de un punto de ayuda.
// Fuente única para el SSG y el render runtime (badge Oficial/Confirmado/
// Sin confirmar; el estado de verificación lo fija el mantenedor).
export function estadoVerificacion(p: { verificacion?: string; estado?: string }): string {
  if (p.verificacion === "oficial") return "oficial";
  if (p.verificacion === "confirmado" || p.estado === "confirmado") return "confirmado";
  return "sin-confirmar";
}

/** Etiqueta de la verificación para badges ("oficial" → "Oficial"). */
export function etiquetaVerificacion(p: { verificacion?: string; estado?: string }): string {
  const v = estadoVerificacion(p);
  return v === "oficial" ? "Oficial" : v === "confirmado" ? "Confirmado" : "Sin confirmar";
}
