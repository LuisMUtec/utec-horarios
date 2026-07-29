/**
 * Arranque de PostHog en el navegador.
 *
 * Vive acá y no en `instrumentation-client.ts` porque ese archivo es un punto de
 * entrada de Next que corre por su efecto al importarse: como función se puede
 * probar, y el trinquete de coverage lo agradece.
 */
import posthog from 'posthog-js';
import { isPostHogConfigured } from './config';

/**
 * Nombra la que falta, que puede ser cualquiera de las dos. Los accesos van
 * literales por lo mismo que en `config.ts`: Next los reemplaza por texto.
 */
function faltantes(): string {
  return [
    !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
    !process.env.NEXT_PUBLIC_POSTHOG_HOST && 'NEXT_PUBLIC_POSTHOG_HOST',
  ]
    .filter(Boolean)
    .join(' and ');
}

export function initPostHog(): void {
  if (!isPostHogConfigured()) {
    // En producción quedarse callado es lo correcto: la app funciona sin
    // PostHog. En desarrollo no, porque «no llega ningún evento» se confunde
    // con «todavía no lo probé».
    if (process.env.NODE_ENV === 'development') {
      const falta = faltantes();
      console.error(
        `${falta} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${falta} is configured`
      );
    }
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // El App Router navega sin recargar la página: sin esto solo contaría la
    // primera vista de cada pestaña.
    capture_pageview: 'history_change',
  });
}
