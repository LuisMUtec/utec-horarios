import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca el token de sesión y propaga las cookies actualizadas.
 *
 * Sin esto el access token caduca y el usuario se desloguea solo, porque los
 * Server Components no pueden escribir cookies.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sin credenciales no hay login: la app sigue funcionando sin sesión.
  if (!url || !key) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        // Cache-Control/Expires/Pragma: una respuesta que setea cookies de auth
        // no puede quedar en un CDN, o serviría la sesión de alguien a otro.
        Object.entries(headers).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value)
        );
      },
    },
  });

  // No metas código entre createServerClient y getClaims: cualquier cosa en
  // medio puede provocar deslogueos aleatorios difíciles de depurar.
  await supabase.auth.getClaims();

  // Devolver supabaseResponse tal cual. Construir otra respuesta sin copiarle
  // las cookies desincroniza navegador y servidor, y mata la sesión.
  return supabaseResponse;
}
