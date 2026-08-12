// Compartir una sección de la plataforma: API de compartir nativa con
// fallback de portapapeles.
export type ResultadoCompartir = "share" | "copiado" | "error";

export async function compartirSeccion(url: string, titulo: string): Promise<ResultadoCompartir> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: `Enlace Sismo — ${titulo}`, url });
      return "share";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "error";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copiado";
  } catch {
    return "error";
  }
}
