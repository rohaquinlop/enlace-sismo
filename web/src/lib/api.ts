// URL base del API (Cloudflare Workers).
// En desarrollo local (localhost) se usa el worker local en :8787.
export function apiUrl(path: string): string {
  const isLocal =
    typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1");
  const base =
    isLocal && !import.meta.env.PUBLIC_API_URL
      ? "http://localhost:8787"
      : (import.meta.env.PUBLIC_API_URL as string) || "https://api.enlacesismo.com";
  return `${base}${path}`;
}

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // Sin conexión o API caída: la web estática sigue funcionando.
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
