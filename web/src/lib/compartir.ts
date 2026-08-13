// Compartir una sección de la plataforma (review de diseño): API de
// compartir nativa con fallback de portapapeles.
export type ResultadoCompartir = "share" | "copiado" | "cancelado" | "error";

export async function compartirSeccion(url: string, titulo: string): Promise<ResultadoCompartir> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: `Enlace Sismo — ${titulo}`, url });
      return "share";
    } catch (err) {
      // AbortError = el usuario canceló la hoja de compartir; no es un fallo.
      if ((err as Error)?.name === "AbortError") return "cancelado";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copiado";
  } catch {
    return "error";
  }
}
