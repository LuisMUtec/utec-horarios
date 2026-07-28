/**
 * Rate limiting en memoria: contador por cliente dentro de una ventana fija.
 *
 * En serverless el mapa se reinicia cada tanto y no se comparte entre
 * instancias, así que no es una defensa dura — alcanza para frenar abuso
 * casual sin sumar infraestructura.
 */

export const RATE_LIMIT = 1000;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Techo de clientes en seguimiento. Una entrada solo se reinicia cuando el
 * mismo cliente vuelve, así que sin techo el mapa crece con cada IP nueva y en
 * una instancia de larga vida (Fluid compute) termina comiéndose la memoria.
 */
export const MAX_TRACKED_CLIENTS = 10_000;

export type RateLimitEntry = { count: number; lastReset: number };

/** Identifica al cliente detrás del proxy de Vercel. */
export function getClientKey(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Hace lugar para una key nueva: primero las vencidas, después la más vieja. */
function makeRoom(store: Map<string, RateLimitEntry>, now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.lastReset >= RATE_LIMIT_WINDOW_MS) store.delete(key);
  }
  if (store.size < MAX_TRACKED_CLIENTS) return;

  // Todas vigentes: sale la del último reinicio más antiguo. Se desaloja de a
  // una porque cada llamada suma como mucho una entrada.
  let oldestKey: string | undefined;
  let oldest = Infinity;
  for (const [key, entry] of store) {
    if (entry.lastReset < oldest) {
      oldest = entry.lastReset;
      oldestKey = key;
    }
  }
  if (oldestKey !== undefined) store.delete(oldestKey);
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
  // Solo al llegar al techo, para que el camino normal siga siendo O(1).
  if (!store.has(key) && store.size >= MAX_TRACKED_CLIENTS) makeRoom(store, now);

  const entry = store.get(key) ?? { count: 0, lastReset: now };

  // `>=`: un request justo al cumplirse la ventana abre la siguiente, no cuenta
  // como el último de la anterior.
  if (now - entry.lastReset >= RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.lastReset = now;
  }

  entry.count++;
  store.set(key, entry);

  return entry.count > RATE_LIMIT;
}
