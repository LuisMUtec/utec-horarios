/**
 * PostHog es opcional, igual que Supabase: sin las variables el job `build` del
 * CI sigue pasando sin secretos y la app renderiza idéntica, solo que sin medir
 * nada. Lo que no puede pasar es que falte en silencio, así que `initPostHog()`
 * avisa por consola cuando corre en desarrollo.
 *
 * Los nombres van literales y no por variable: Next reemplaza `NEXT_PUBLIC_*`
 * en tiempo de build por coincidencia textual, así que un acceso dinámico
 * llegaría al navegador como `undefined`.
 */
export function isPostHogConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST
  );
}
