/**
 * Vincular los eventos del navegador con la cuenta que los produjo.
 *
 * El identificador es `sub` (el UUID de Supabase), no el correo: el correo es un
 * dato personal que además puede cambiar, y PostHog lo guarda mejor como
 * propiedad de la persona que como clave.
 */
import posthog from 'posthog-js';
import { isPostHogConfigured } from './config';

/**
 * Con qué datos se identificó ya en esta carga de página. `getClaims()` se
 * vuelve a resolver con cada evento de `onAuthStateChange`, y sin esto cada
 * refresco de token repetiría el `identify` sin aportar nada.
 *
 * La clave incluye el correo y no solo la cuenta: si cambia hay que reenviarlo,
 * que para eso es una propiedad de la persona.
 */
let identificado: string | null = null;

/**
 * El separador es un NUL, que no puede aparecer ni en un UUID ni en un correo:
 * así no hay dos pares distintos que colapsen en la misma clave.
 */
const clave = (id: string, email: string) => `${id}\u0000${email}`;

/** Ata los eventos siguientes —y los anónimos previos— a la cuenta. */
export function identifyStudent(id: string, email: string): void {
  const actual = clave(id, email);
  if (!isPostHogConfigured() || identificado === actual) return;

  identificado = actual;
  posthog.identify(id, email ? { email } : undefined);
}

/**
 * Corta el vínculo, para que quien use el navegador después no herede la
 * identidad del anterior. Hay que llamarlo antes de que el POST a
 * `/auth/signout` recargue la página, y también cuando la sesión se cae sola
 * —otra pestaña que cierra, un token revocado—, que es lo que avisa
 * `onAuthStateChange`.
 *
 * No hace nada si no había nadie identificado: `reset()` estrena el id anónimo,
 * así que llamarlo en cada carga sin sesión partiría en pedazos a la misma
 * persona anónima.
 */
export function forgetStudent(): void {
  if (!isPostHogConfigured() || identificado === null) return;

  identificado = null;
  posthog.reset();
}
