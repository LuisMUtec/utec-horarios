/**
 * Rate limiting en memoria: contador por cliente dentro de una ventana fija.
 *
 * En serverless el mapa se reinicia cada tanto y no se comparte entre
 * instancias, así que no es una defensa dura — alcanza para frenar abuso
 * casual sin sumar infraestructura.
 */

export const RATE_LIMIT = 1000;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type RateLimitEntry = { count: number; lastReset: number };

/** Identifica al cliente detrás del proxy de Vercel. */
export function getClientKey(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Registra un request y devuelve true si el cliente superó el límite.
 * Muta `store`: el contador vive entre llamadas.
 */
export function isRateLimited(
  store: Map<string, RateLimitEntry>,
  key: string,
  now: number
): boolean {
  const entry = store.get(key) ?? { count: 0, lastReset: now };

  if (now - entry.lastReset > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.lastReset = now;
  }

  entry.count++;
  store.set(key, entry);

  return entry.count > RATE_LIMIT;
}
