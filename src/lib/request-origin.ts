import type { NextRequest } from 'next/server';

/**
 * Origen público de la app, para armar las URLs de redirección de OAuth.
 *
 * No sale de `x-forwarded-host`: esa cabecera la puede fijar quien haga el
 * request, y un host inyectado convertiría `/auth/callback` y `/auth/signout`
 * en open redirects. Peor todavía en `/auth/login`, donde el host viaja en el
 * `redirectTo` y con un comodín `*.vercel.app` en las Redirect URLs de Supabase
 * el `code` de OAuth terminaría en un origen ajeno.
 *
 * Por eso el origen sale de la configuración del deploy, que el cliente no
 * toca. `nextUrl.origin` queda solo para local, donde no hay proxy delante.
 */
export function requestOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  // Las inyecta Vercel. En producción manda el dominio del proyecto, no la URL
  // del deploy; en previews sí es la del deploy, que es la que resuelve.
  const host =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (host) return `https://${host}`;

  return request.nextUrl.origin;
}
