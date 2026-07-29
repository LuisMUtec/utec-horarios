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
 * A quién se identificó ya en esta carga de página. `getClaims()` se vuelve a
 * resolver con cada evento de `onAuthStateChange`, y sin esto cada refresco de
 * token repetiría el `identify` sin aportar nada.
 */
let identificado: string | null = null;

/** Ata los eventos siguientes —y los anónimos previos— a la cuenta. */
export function identifyStudent(id: string, email: string): void {
  if (!isPostHogConfigured() || identificado === id) return;

  identificado = id;
  posthog.identify(id, email ? { email } : undefined);
}

/**
 * Corta el vínculo al cerrar sesión, para que quien use el navegador después no
 * herede la identidad del anterior. Hay que llamarlo antes de que el POST a
 * `/auth/signout` recargue la página.
 */
export function forgetStudent(): void {
  if (!isPostHogConfigured()) return;

  identificado = null;
  posthog.reset();
}
