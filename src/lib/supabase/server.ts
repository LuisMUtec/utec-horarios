import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 *
 * Es una función y no un cliente de módulo a propósito: con Fluid compute las
 * instancias se reusan entre requests y un cliente compartido filtraría la
 * sesión de un usuario a otro. Uno por request, siempre.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // El segundo argumento (cabeceras anti-caché) no se usa: las respuestas
        // de rutas dinámicas ya salen sin cachear, y el proxy sí las aplica.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component, donde no se pueden escribir
            // cookies. El proxy ya refresca la sesión, así que es inocuo.
          }
        },
      },
    }
  );
}
