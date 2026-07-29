/**
 * Arranque de PostHog en el navegador.
 *
 * Vive acá y no en `instrumentation-client.ts` porque ese archivo es un punto de
 * entrada de Next que corre por su efecto al importarse: como función se puede
 * probar, y el trinquete de coverage lo agradece.
 */
import posthog from 'posthog-js';
import { isPostHogConfigured } from './config';

const FALTA_CONFIG =
  'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured';

export function initPostHog(): void {
  if (!isPostHogConfigured()) {
    // En producción quedarse callado es lo correcto: la app funciona sin
    // PostHog. En desarrollo no, porque «no llega ningún evento» se confunde
    // con «todavía no lo probé».
    if (process.env.NODE_ENV === 'development') console.error(FALTA_CONFIG);
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // El App Router navega sin recargar la página: sin esto solo contaría la
    // primera vista de cada pestaña.
    capture_pageview: 'history_change',
  });
}
